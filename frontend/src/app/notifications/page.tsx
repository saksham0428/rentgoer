/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Bell, CheckCircle2, MessageSquare, ClipboardList, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();

  if (authLoading) return <div className="p-8 text-center text-muted">Loading...</div>;
  if (!user) {
    router.push('/login');
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'RENTAL_REQUEST':
        return <ClipboardList className="h-5 w-5 text-blue-500" />;
      case 'REQUEST_ACCEPTED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'REQUEST_REJECTED':
        return <ClipboardList className="h-5 w-5 text-red-500" />;
      case 'CHAT_MESSAGE':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getLink = (notification: any) => {
    if (!notification.referenceId) return '#';
    switch (notification.type) {
      case 'RENTAL_REQUEST':
      case 'REQUEST_ACCEPTED':
      case 'REQUEST_REJECTED':
        return user.role === 'OWNER' ? '/owner/requests' : '/rental-requests';
      case 'CHAT_MESSAGE':
        return `/chat/${notification.referenceId}`;
      default:
        return '#';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    const link = getLink(notification);
    if (link !== '#') {
      router.push(link);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-muted mt-2">
            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="mt-4 sm:mt-0">
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Bell className="h-12 w-12 mx-auto text-muted mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground">All caught up!</p>
            <p className="text-muted">You don't have any notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-5 rounded-lg border cursor-pointer transition-colors flex items-start gap-4 ${
                n.isRead 
                  ? 'bg-card border-border hover:bg-muted/5' 
                  : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
              }`}
            >
              <div className="mt-1 flex-shrink-0 bg-background p-2 rounded-full border border-border">
                {getIcon(n.type)}
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className={`font-medium ${n.isRead ? 'text-foreground' : 'text-primary'}`}>
                    {n.title}
                  </h3>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
                <p className="text-muted text-sm mt-1">{n.message}</p>
                <div className="flex items-center text-xs text-muted-foreground mt-3">
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(n.createdAt).toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
