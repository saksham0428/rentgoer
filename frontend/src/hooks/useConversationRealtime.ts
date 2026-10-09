/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export const useConversationRealtime = (conversationId: string, onNewMessage: (message: any) => void) => {
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Do not open SSE if auth is still hydrating or user is unauthenticated
    if (authLoading || !user || !conversationId) return;

    // Use Server-Sent Events (SSE) against our authenticated backend endpoint.
    // The browser automatically attaches HttpOnly cookies (`rentgoer_token`) to this request
    // if withCredentials is true. EventSource supports withCredentials.
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const eventSource = new EventSource(`${API_URL}/conversations/${conversationId}/realtime`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onNewMessage(message);
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      // EventSource automatically attempts to reconnect on errors.
    };

    return () => {
      eventSource.close();
    };
  }, [conversationId, onNewMessage, user, authLoading]);

  // Return a dummy channel object for backwards compatibility with any UI relying on it
  return { channel: { unsubscribe: () => {} } };
};
