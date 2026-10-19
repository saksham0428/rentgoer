'use client';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId: string | null;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadChatCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchUnreadChatCount: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const notificationsRef = useRef<Notification[]>(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Manual refresh helper for notifications list & count (used by notifications screen)
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [notifListRes, notifCountRes] = await Promise.all([
        api.get<{ data: Notification[] }>('/notifications').catch(() => ({ data: [] })),
        api.get<{ count: number }>('/notifications/unread-count').catch(() => ({ count: 0 })),
      ]);
      setNotifications(notifListRes.data || []);
      setUnreadCount(notifCountRes.count ?? 0);
    } catch (err) {
      console.error('Failed to refresh notifications', err);
    }
  }, [user?.id]);

  // Manual refresh helper for chat unread count
  const fetchUnreadChatCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get<{ success: boolean; count: number }>('/conversations/unread-count');
      if (typeof res.count === 'number') {
        setUnreadChatCount(res.count);
      }
    } catch (err) {
      console.error('Failed to refresh unread chat count', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setUnreadChatCount(0);
      return;
    }

    let isCancelled = false;

    // 1. Initial count & notifications fetch for this authenticated session
    Promise.all([
      api.get<{ data: Notification[] }>('/notifications').catch(() => ({ data: [] })),
      api.get<{ count: number }>('/notifications/unread-count').catch(() => ({ count: 0 })),
      api.get<{ count: number }>('/conversations/unread-count').catch(() => ({ count: 0 })),
    ]).then(([notifRes, notifCountRes, chatCountRes]) => {
      if (!isCancelled) {
        setNotifications(notifRes.data || []);
        setUnreadCount(notifCountRes.count ?? 0);
        setUnreadChatCount(chatCountRes.count ?? 0);
      }
    });

    // 2. Real-time Server-Sent Events stream for notifications and read synchronization
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';
    const eventSource = new EventSource(`${API_URL}/notifications/realtime`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      if (isCancelled) return;
      try {
        const data = JSON.parse(event.data);

        // Handle real-time read synchronization events
        if (data && data.type === 'NOTIFICATION_READ_SYNC') {
          if (typeof data.unreadNotificationCount === 'number') {
            setUnreadCount(data.unreadNotificationCount);
          }
          if (typeof data.unreadChatCount === 'number') {
            setUnreadChatCount(data.unreadChatCount);
          }
          if (data.action === 'CONVERSATION_READ' && data.conversationId) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.type === 'CHAT_MESSAGE' && n.referenceId === data.conversationId
                  ? { ...n, isRead: true }
                  : n
              )
            );
          } else if (data.action === 'NOTIFICATION_READ' && data.notificationId) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === data.notificationId ||
                (data.conversationId &&
                  n.type === 'CHAT_MESSAGE' &&
                  n.referenceId === data.conversationId)
                  ? { ...n, isRead: true }
                  : n
              )
            );
          } else if (data.action === 'ALL_READ') {
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: data }));
          }
          return;
        }

        // Regular incoming notification
        const notification: Notification = data;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          setUnreadCount((c) => c + 1);
          return [notification, ...prev];
        });

        // Increment unread chat count when a new chat message notification arrives
        if (notification.type === 'CHAT_MESSAGE') {
          setUnreadChatCount((c) => c + 1);
        }
      } catch (err) {
        console.error('Failed to parse notification SSE', err);
      }
    };

    // 3. Local tab synchronization via custom event
    const handleChatUnreadSync = (e: Event) => {
      if (isCancelled) return;
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.unreadChatCount === 'number') {
        setUnreadChatCount(detail.unreadChatCount);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chat:unread_sync', handleChatUnreadSync);
    }

    return () => {
      isCancelled = true;
      eventSource.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('chat:unread_sync', handleChatUnreadSync);
      }
    };
  }, [user?.id]);

  const markConversationAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    // Optimistically mark notifications for this conversation as read
    setNotifications((prev) => {
      let markedCount = 0;
      const updated = prev.map((n) => {
        if (n.type === 'CHAT_MESSAGE' && n.referenceId === conversationId && !n.isRead) {
          markedCount++;
          return { ...n, isRead: true };
        }
        return n;
      });
      if (markedCount > 0) {
        setUnreadCount((c) => Math.max(0, c - markedCount));
      }
      return updated;
    });

    try {
      const res = await api.patch<{
        success: boolean;
        unreadNotificationCount?: number;
        unreadChatCount?: number;
      }>(`/conversations/${conversationId}/read`, {});

      if (res) {
        if (typeof res.unreadNotificationCount === 'number') {
          setUnreadCount(res.unreadNotificationCount);
        }
        if (typeof res.unreadChatCount === 'number') {
          setUnreadChatCount(res.unreadChatCount);
        }
      }
    } catch (err) {
      console.error('Failed to mark conversation notifications as read:', err);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id);
    const convId = target?.type === 'CHAT_MESSAGE' ? target.referenceId : null;

    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === id || (convId && n.type === 'CHAT_MESSAGE' && n.referenceId === convId)) {
            return { ...n, isRead: true };
          }
          return n;
        })
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: { conversationId: convId } }));
      }

      const res = await api.put<{ success: boolean; data: any; unreadNotificationCount?: number }>(
        `/notifications/${id}/read`,
        {}
      );
      if (res && typeof res.unreadNotificationCount === 'number') {
        setUnreadCount(res.unreadNotificationCount);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chat:unread_sync'));
      }
      await api.put('/notifications/read-all', {});
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  }, []);

  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    unreadChatCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    fetchUnreadChatCount,
    markConversationAsRead,
  }), [
    notifications,
    unreadCount,
    unreadChatCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    fetchUnreadChatCount,
    markConversationAsRead,
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
