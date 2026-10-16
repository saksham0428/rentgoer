/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export const useConversationRealtime = (
  conversationId: string,
  onNewMessage: (message: any) => void
) => {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  // Keep a stable ref to the callback to prevent recreation of EventSource on every render
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  useEffect(() => {
    // Do not open SSE if auth is still hydrating, unauthenticated, or conversationId is missing
    if (authLoading || !user || !conversationId) {
      setStatus('disconnected');
      return;
    }

    let isMounted = true;
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let lastPollTimestamp: string = new Date().toISOString();

    const startPollingFallback = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        if (!isMounted) return;
        try {
          const res = await api.get<{ data: any[] }>(
            `/conversations/${conversationId}/messages?after=${encodeURIComponent(lastPollTimestamp)}&limit=20`
          );
          if (res.data && res.data.length > 0) {
            lastPollTimestamp = new Date().toISOString();
            res.data.forEach((msg) => {
              onNewMessageRef.current(msg);
            });
          }
        } catch {
          // Silent polling error handling while disconnected
        }
      }, 5000);
    };

    const stopPollingFallback = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const connectSSE = () => {
      try {
        setStatus('connecting');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';
        eventSource = new EventSource(`${API_URL}/conversations/${conversationId}/realtime`, {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          if (!isMounted) return;
          setStatus('connected');
          stopPollingFallback();
        };

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            // Ignore keepalive ping or empty events
            if (!event.data || event.data === 'ping') return;
            const message = JSON.parse(event.data);
            if (message && message.id) {
              lastPollTimestamp = message.createdAt || new Date().toISOString();
              onNewMessageRef.current(message);
            }
          } catch (err) {
            console.error('Failed to parse incoming SSE message:', err);
          }
        };

        eventSource.onerror = (err) => {
          if (!isMounted) return;
          console.warn('Chat SSE disconnected; engaging polling fallback:', err);
          setStatus('disconnected');
          startPollingFallback();
        };
      } catch (err) {
        console.error('Failed to initialize EventSource:', err);
        setStatus('disconnected');
        startPollingFallback();
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      stopPollingFallback();
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [conversationId, user?.id, authLoading]);

  return {
    status,
    isConnected: status === 'connected',
    channel: { unsubscribe: () => {} }, // backwards compatibility
  };
};
