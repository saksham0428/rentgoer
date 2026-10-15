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

    // Listen to storage/focus events to refresh unread count when returning to tab
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUnreadCount]);

  return { unreadChatCount, refreshUnreadCount: fetchUnreadCount };
};
