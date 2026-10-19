'use client';

import { useNotifications } from '@/context/NotificationContext';

export const useUnreadChatCount = () => {
  const { unreadChatCount, fetchUnreadChatCount } = useNotifications();
  return { unreadChatCount, refreshUnreadCount: fetchUnreadChatCount };
};
