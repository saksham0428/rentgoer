import { EventEmitter } from 'events';

export const notificationEventEmitter = new EventEmitter();
notificationEventEmitter.setMaxListeners(1000);

export const emitNotification = (userId: string, notification: any) => {
  if (userId && notification) {
    notificationEventEmitter.emit(`notification:${userId}`, notification);
  }
};
