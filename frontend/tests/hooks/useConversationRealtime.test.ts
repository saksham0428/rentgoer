import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { api } from '@/lib/api';

// --- Mocks ---

// Mock AuthContext
let mockUser: { id: string; name: string; email: string; role: 'TENANT' | 'OWNER' | 'ADMIN' } | null = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'TENANT',
};
let mockAuthLoading = false;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
  }),
}));

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// --- Mock EventSource Implementation ---

class MockEventSource {
  static instances: MockEventSource[] = [];
  static throwOnConstruct = false;

  url: string;
  options?: { withCredentials?: boolean };
  readyState: number = 0; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
  withCredentials?: boolean;

  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  listeners: Record<string, ((event: any) => void)[]> = {};

  constructor(url: string, options?: { withCredentials?: boolean }) {
    if (MockEventSource.throwOnConstruct) {
      throw new Error('EventSource construction failed');
    }
    this.url = url;
    this.options = options;
    this.withCredentials = options?.withCredentials;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  close = vi.fn(() => {
    this.readyState = 2;
  });

  // Test helpers to simulate events
  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen({ type: 'open' });
    }
    if (this.listeners['open']) {
      this.listeners['open'].forEach((l) => l({ type: 'open' }));
    }
  }

  simulateMessage(data: any) {
    const evt = { type: 'message', data };
    if (this.onmessage) {
      this.onmessage(evt);
    }
    if (this.listeners['message']) {
      this.listeners['message'].forEach((l) => l(evt));
    }
  }

  simulateError(error: any = new Error('SSE connection error')) {
    this.readyState = 2;
    if (this.onerror) {
      this.onerror(error);
    }
    if (this.listeners['error']) {
      this.listeners['error'].forEach((l) => l(error));
    }
  }
}

describe('useConversationRealtime hook', () => {
  const originalEnvApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    MockEventSource.instances = [];
    MockEventSource.throwOnConstruct = false;
    (global as any).EventSource = MockEventSource;
    (window as any).EventSource = MockEventSource;

    mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'TENANT',
    };
    mockAuthLoading = false;

    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (originalEnvApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalEnvApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  describe('1. Initial state and SSE connection creation', () => {
    it('creates an EventSource with default /api/proxy URL and credentials when authenticated', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const onNewMessage = vi.fn();

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);
      const es = MockEventSource.instances[0];
      expect(es.url).toBe('/api/proxy/conversations/conv-1/realtime');
      expect(es.withCredentials).toBe(true);
      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnected).toBe(false);
      expect(typeof result.current.channel.unsubscribe).toBe('function');
    });

    it('creates an EventSource using process.env.NEXT_PUBLIC_API_URL when configured', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.rentgoer.com';
      const onNewMessage = vi.fn();

      renderHook(() => useConversationRealtime('conv-99', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0].url).toBe('https://api.rentgoer.com/conversations/conv-99/realtime');
    });

    it('does not create EventSource and stays disconnected when unauthenticated (user is null)', () => {
      mockUser = null;
      const onNewMessage = vi.fn();

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(0);
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('does not create EventSource and stays disconnected when auth is loading', () => {
      mockAuthLoading = true;
      const onNewMessage = vi.fn();

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(0);
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('does not create EventSource and stays disconnected when conversationId is empty', () => {
      const onNewMessage = vi.fn();

      const { result } = renderHook(() => useConversationRealtime('', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(0);
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('connects when auth transitions from loading to authenticated', () => {
      mockAuthLoading = true;
      const onNewMessage = vi.fn();

      const { result, rerender } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(0);
      expect(result.current.status).toBe('disconnected');

      mockAuthLoading = false;
      rerender();

      expect(MockEventSource.instances).toHaveLength(1);
      expect(result.current.status).toBe('connecting');
    });
  });

  describe('2. Successful connection and connection-state changes', () => {
    it('transitions status to connected and isConnected to true on open', () => {
      const onNewMessage = vi.fn();
      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnected).toBe(false);

      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    it('stops active polling fallback when onopen fires after an error', () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      // SSE error engages polling
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      expect(result.current.status).toBe('disconnected');

      // Reconnection triggers onopen
      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });
      expect(result.current.status).toBe('connected');

      // Advancing timer should not trigger api.get
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(api.get).not.toHaveBeenCalled();
    });

    it('ignores onopen if component has unmounted', () => {
      const onNewMessage = vi.fn();
      const { result, unmount } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const es = MockEventSource.instances[0];
      unmount();

      act(() => {
        es.simulateOpen();
      });

      // Status should remain what it was before unmount and not throw
      expect(result.current.status).toBe('connecting');
    });
  });

  describe('3. Incoming message handling and JSON parsing', () => {
    it('parses valid JSON message and invokes onNewMessage callback', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const payload = {
        id: 'msg-1',
        content: 'Hello world',
        createdAt: '2026-10-24T00:00:00.000Z',
      };

      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify(payload));
      });

      expect(onNewMessage).toHaveBeenCalledTimes(1);
      expect(onNewMessage).toHaveBeenCalledWith(payload);
    });

    it('carries over message.createdAt to subsequent fallback polling', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const customTimestamp = '2026-10-24T05:30:00.000Z';
      act(() => {
        MockEventSource.instances[0].simulateMessage(
          JSON.stringify({ id: 'msg-ts', createdAt: customTimestamp })
        );
      });

      // Disconnect SSE
      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      // Advance by 5000ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining(`after=${encodeURIComponent(customTimestamp)}`)
      );
    });

    it('sets timestamp to current time when message has an id but no createdAt', async () => {
      vi.useFakeTimers();
      const fakeNow = new Date('2026-10-24T12:00:00.000Z');
      vi.setSystemTime(fakeNow);

      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify({ id: 'msg-no-ts' }));
      });

      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining(`after=${encodeURIComponent(fakeNow.toISOString())}`)
      );
    });

    it('ignores payloads that lack an id property', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify({ type: 'notification' }));
      });

      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('safely handles non-object JSON values such as "null" or numbers without throwing', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage('null');
        MockEventSource.instances[0].simulateMessage('123');
        MockEventSource.instances[0].simulateMessage('true');
      });

      expect(onNewMessage).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('uses the latest onNewMessage callback without recreating EventSource', () => {
      const initialCallback = vi.fn();
      const updatedCallback = vi.fn();

      let callback = initialCallback;
      const { rerender } = renderHook(() => useConversationRealtime('conv-1', callback));

      expect(MockEventSource.instances).toHaveLength(1);

      callback = updatedCallback;
      rerender();

      // Ensure no new EventSource instance was created
      expect(MockEventSource.instances).toHaveLength(1);

      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify({ id: 'msg-2', content: 'Updated' }));
      });

      expect(initialCallback).not.toHaveBeenCalled();
      expect(updatedCallback).toHaveBeenCalledTimes(1);
      expect(updatedCallback).toHaveBeenCalledWith({ id: 'msg-2', content: 'Updated' });
    });
  });

  describe('4. Keepalive or ping event suppression', () => {
    it('suppresses raw "ping" messages without calling onNewMessage', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage('ping');
      });

      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('suppresses empty string message data', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage('');
      });

      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('suppresses null or undefined event data without throwing', () => {
      const onNewMessage = vi.fn();
      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage(null);
        MockEventSource.instances[0].simulateMessage(undefined);
      });

      expect(onNewMessage).not.toHaveBeenCalled();
    });
  });

  describe('5. Malformed payload handling', () => {
    it('catches invalid JSON without crashing or throwing, and logs console.error', () => {
      const onNewMessage = vi.fn();
      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateMessage('invalid-json{');
      });

      expect(onNewMessage).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to parse incoming SSE message:',
        expect.any(SyntaxError)
      );
      // Status remains unchanged
      expect(result.current.status).toBe('connecting');
    });
  });

  describe('6. SSE errors and connection closure', () => {
    it('handles onerror by setting status to disconnected, logging warning, and engaging polling fallback', () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateError(new Error('Connection lost'));
      });

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        'Chat SSE disconnected; engaging polling fallback:',
        expect.any(Error)
      );
    });

    it('handles EventSource constructor throwing by catching, setting status to disconnected, and engaging polling', () => {
      MockEventSource.throwOnConstruct = true;
      const onNewMessage = vi.fn();

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to initialize EventSource:',
        expect.any(Error)
      );
    });

    it('ignores onerror if component has unmounted', () => {
      const onNewMessage = vi.fn();
      const { unmount } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const es = MockEventSource.instances[0];
      unmount();

      act(() => {
        es.simulateError(new Error('Post-unmount error'));
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('7. Fallback polling activation after SSE failure or disconnection', () => {
    it('polls /conversations/:id/messages every 5000ms after disconnection and notifies callback', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      const polledMessages = [
        { id: 'polled-1', content: 'Polled message 1', createdAt: '2026-10-24T00:01:00.000Z' },
        { id: 'polled-2', content: 'Polled message 2', createdAt: '2026-10-24T00:01:05.000Z' },
      ];
      vi.mocked(api.get).mockResolvedValue({ data: polledMessages });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      expect(api.get).not.toHaveBeenCalled();

      // Advance by 5000ms to trigger first poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv-1/messages?after=')
      );
      expect(onNewMessage).toHaveBeenCalledTimes(2);
      expect(onNewMessage).toHaveBeenNthCalledWith(1, polledMessages[0]);
      expect(onNewMessage).toHaveBeenNthCalledWith(2, polledMessages[1]);
    });

    it('updates timestamp on successful poll so next poll uses updated timestamp', async () => {
      vi.useFakeTimers();
      const time1 = new Date('2026-10-24T01:00:00.000Z');
      vi.setSystemTime(time1);

      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValueOnce({
        data: [{ id: 'p-1', content: 'First' }],
      });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      // Poll 1
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(api.get).toHaveBeenCalledTimes(1);

      // Poll 1 completed at time1 + 5000ms, so lastPollTimestamp is updated to that moment
      const expectedUpdatedTime = new Date('2026-10-24T01:00:05.000Z').toISOString();
      vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

      // Poll 2
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(api.get).toHaveBeenLastCalledWith(
        expect.stringContaining(`after=${encodeURIComponent(expectedUpdatedTime)}`)
      );
    });

    it('handles api.get returning empty or null data without invoking onNewMessage', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('handles api.get failure during polling silently without crashing', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockRejectedValue(new Error('Polling network error'));

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      act(() => {
        MockEventSource.instances[0].simulateError();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(onNewMessage).not.toHaveBeenCalled();
    });
  });

  describe('8. Polling cleanup or deactivation after successful reconnection', () => {
    it('stops fallback polling when EventSource reconnects and fires onopen', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      // Disconnect -> starts polling
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      expect(result.current.status).toBe('disconnected');

      // Reconnect -> fires onopen
      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });
      expect(result.current.status).toBe('connected');

      // Fast forward time - polling interval should have been cleared
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });

      expect(api.get).not.toHaveBeenCalled();
    });

    it('resumes polling if EventSource fails again after previous reconnection', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      // 1. First error
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      expect(result.current.status).toBe('disconnected');

      // 2. Reconnect
      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });
      expect(result.current.status).toBe('connected');

      // 3. Second error
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      expect(result.current.status).toBe('disconnected');

      // 4. Polling resumes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('9. Cleanup on component unmount', () => {
    it('closes EventSource and stops polling interval on unmount', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      const { unmount } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const es = MockEventSource.instances[0];

      // Disconnect so polling starts
      act(() => {
        es.simulateError();
      });

      // Unmount hook
      unmount();

      expect(es.close).toHaveBeenCalledTimes(1);

      // Advance timers to verify polling interval was cleared
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(api.get).not.toHaveBeenCalled();
    });

    it('does not process messages or state updates after unmount (isMounted check)', () => {
      const onNewMessage = vi.fn();
      const { result, unmount } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const es = MockEventSource.instances[0];
      unmount();

      act(() => {
        es.simulateOpen();
        es.simulateMessage(JSON.stringify({ id: 'msg-post-unmount', content: 'test' }));
        es.simulateError();
      });

      expect(result.current.status).toBe('connecting');
      expect(onNewMessage).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('10. Cleanup and reconnection when user or conversation changes', () => {
    it('closes previous connection and opens new connection when conversationId changes', () => {
      const onNewMessage = vi.fn();
      let conversationId = 'conv-1';

      const { rerender } = renderHook(() => useConversationRealtime(conversationId, onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);
      const firstEs = MockEventSource.instances[0];
      expect(firstEs.url).toContain('/conversations/conv-1/realtime');

      conversationId = 'conv-2';
      rerender();

      expect(firstEs.close).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(2);
      const secondEs = MockEventSource.instances[1];
      expect(secondEs.url).toContain('/conversations/conv-2/realtime');
    });

    it('closes connection and reconnects when user.id changes', () => {
      const onNewMessage = vi.fn();

      const { rerender } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);
      const firstEs = MockEventSource.instances[0];

      mockUser = { id: 'user-2', name: 'User 2', email: 'u2@example.com', role: 'TENANT' };
      rerender();

      expect(firstEs.close).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(2);
    });

    it('does not reconnect when user object reference changes but user.id remains the same', () => {
      const onNewMessage = vi.fn();

      const { rerender } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);

      // Same id, new reference and updated name
      mockUser = { id: 'user-1', name: 'Updated Name', email: 'test@example.com', role: 'TENANT' };
      rerender();

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it('closes connection and disconnects when user logs out', () => {
      const onNewMessage = vi.fn();

      const { result, rerender } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);
      const firstEs = MockEventSource.instances[0];

      mockUser = null;
      rerender();

      expect(firstEs.close).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(1);
      expect(result.current.status).toBe('disconnected');
    });
  });

  describe('11. Prevention of duplicate connections, timers, or handlers', () => {
    it('does not create duplicate connections on irrelevant re-renders', () => {
      const onNewMessage = vi.fn();
      const { rerender } = renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      expect(MockEventSource.instances).toHaveLength(1);

      rerender();
      rerender();

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it('prevents multiple polling intervals when multiple onerror events fire consecutively', async () => {
      vi.useFakeTimers();
      const onNewMessage = vi.fn();
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      renderHook(() => useConversationRealtime('conv-1', onNewMessage));

      const es = MockEventSource.instances[0];

      // Fire error multiple times consecutively
      act(() => {
        es.simulateError();
        es.simulateError();
        es.simulateError();
      });

      // Advance by 5000ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Exactly 1 call, not 3
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });
});
