import { EventEmitter } from 'events';

export const chatEventEmitter = new EventEmitter();
chatEventEmitter.setMaxListeners(1000);

export const initRealtime = () => {
  // No-op. Previously initialized Supabase Realtime Broadcast.
};

export const broadcastMessage = async (message: any) => {
  if (message && message.conversationId) {
    chatEventEmitter.emit(`message:${message.conversationId}`, message);
  }
};
