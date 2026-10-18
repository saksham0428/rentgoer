/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
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
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const hasFetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ data: Notification[] }>('/notifications');
      setNotifications(res.data);
      const resCount = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(resCount.count);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      // Fetch initial notifications and unread count strictly on mount
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchNotifications();
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';
      const eventSource = new EventSource(`${API_URL}/notifications/realtime`, {
        withCredentials: true
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle real-time read synchronization events
          if (data && data.type === 'NOTIFICATION_READ_SYNC') {
            if (typeof data.unreadNotificationCount === 'number') {
              setUnreadCount(data.unreadNotificationCount);
            }
            if (data.action === 'CONVERSATION_READ' && data.conversationId) {
              setNotifications(prev =>
                prev.map(n =>
                  n.type === 'CHAT_MESSAGE' && n.referenceId === data.conversationId
                    ? { ...n, isRead: true }
                    : n
                )
              );
            } else if (data.action === 'NOTIFICATION_READ' && data.notificationId) {
              setNotifications(prev =>
                prev.map(n =>
                  n.id === data.notificationId || (data.conversationId && n.type === 'CHAT_MESSAGE' && n.referenceId === data.conversationId)
                    ? { ...n, isRead: true }
                    : n
                )
              );
            } else if (data.action === 'ALL_READ') {
              setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: data }));
            }
            return;
          }

          // Regular incoming notification
          const notification: Notification = data;
          setNotifications(prev => {
            if (prev.some(n => n.id === notification.id)) return prev;
            setUnreadCount(c => c + 1);
            return [notification, ...prev];
          });
        } catch (err) {
          console.error('Failed to parse notification SSE', err);
        }
      };

      return () => {
        eventSource.close();
      };
    } else {
      hasFetchedRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id, fetchNotifications]);

  const markConversationAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    // Optimistically mark notifications for this conversation as read
    setNotifications(prev => {
      let markedCount = 0;
      const updated = prev.map(n => {
        if (n.type === 'CHAT_MESSAGE' && n.referenceId === conversationId && !n.isRead) {
          markedCount++;
          return { ...n, isRead: true };
        }
        return n;
      });
      if (markedCount > 0) {
        setUnreadCount(c => Math.max(0, c - markedCount));
      }
      return updated;
    });

    // Notify unread chat count hook immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: { conversationId } }));
    }

    try {
      const res = await api.patch<{
        success: boolean;
        unreadNotificationCount?: number;
        unreadChatCount?: number;
      }>(`/conversations/${conversationId}/read`, {});

      if (res && typeof res.unreadNotificationCount === 'number') {
        setUnreadCount(res.unreadNotificationCount);
      }
    } catch (err) {
      console.error('Failed to mark conversation notifications as read:', err);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const target = notifications.find(n => n.id === id);
    const convId = target?.type === 'CHAT_MESSAGE' ? target.referenceId : null;

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => {
        if (n.id === id || (convId && n.type === 'CHAT_MESSAGE' && n.referenceId === convId)) {
          return { ...n, isRead: true };
        }
        return n;
      }));
      setUnreadCount(prev => Math.max(0, prev - 1));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: { conversationId: convId } }));
      }

      const res = await api.put<{ success: boolean; data: any; unreadNotificationCount?: number }>(`/notifications/${id}/read`, {});
      if (res && typeof res.unreadNotificationCount === 'number') {
        setUnreadCount(res.unreadNotificationCount);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    markConversationAsRead,
  }), [notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications, markConversationAsRead]);

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
