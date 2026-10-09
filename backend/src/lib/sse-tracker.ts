const notificationConnections = new Map<string, number>();
const chatConnections = new Map<string, number>();

export const NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER = parseInt(process.env.NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER || '3');
export const CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER = parseInt(process.env.CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER || '5');

export const sseTracker = {
  addNotificationConnection(userId: string): boolean {
    const current = notificationConnections.get(userId) || 0;
    if (current >= NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER) return false;
    notificationConnections.set(userId, current + 1);
    return true;
  },

  removeNotificationConnection(userId: string): void {
    const current = notificationConnections.get(userId) || 0;
    if (current <= 1) {
      notificationConnections.delete(userId);
    } else {
      notificationConnections.set(userId, current - 1);
    }
  },

  addChatConnection(userId: string): boolean {
    const current = chatConnections.get(userId) || 0;
    if (current >= CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER) return false;
    chatConnections.set(userId, current + 1);
    return true;
  },

  removeChatConnection(userId: string): void {
    const current = chatConnections.get(userId) || 0;
    if (current <= 1) {
      chatConnections.delete(userId);
    } else {
      chatConnections.set(userId, current - 1);
    }
  }
};
