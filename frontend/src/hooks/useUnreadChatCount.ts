'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const useUnreadChatCount = () => {
  const { user } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadChatCount(0);
      return;
    }

    try {
      const res = await api.get<{ success: boolean; count: number }>('/conversations/unread-count');
      if (typeof res.count === 'number') {
        setUnreadChatCount(res.count);
      }
    } catch {
      // Silently ignore if unauthenticated or network error
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();

    // Listen to focus and custom sync events to refresh unread count immediately
    const handleSync = () => fetchUnreadCount();
    window.addEventListener('focus', handleSync);
    window.addEventListener('chat:unread_sync', handleSync);

    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('chat:unread_sync', handleSync);
    };
  }, [fetchUnreadCount]);

  return { unreadChatCount, refreshUnreadCount: fetchUnreadCount };
};
