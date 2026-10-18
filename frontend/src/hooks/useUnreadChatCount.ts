'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const useUnreadChatCount = () => {
  const { user } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const hasFetchedRef = useRef(false);

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
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      hasFetchedRef.current = false;
      setUnreadChatCount(0);
      return;
    }

    // Only count on mount (once per authenticated session without re-fetching on simple renders)
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUnreadCount();
    }
  }, [user?.id, fetchUnreadCount]);

  return { unreadChatCount, refreshUnreadCount: fetchUnreadCount };
};
