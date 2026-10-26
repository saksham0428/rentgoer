'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { ReportMessageButton } from '@/components/report/ReportMessageButton';
import { api } from '@/lib/api';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { ConversationListPanel } from '@/components/chat/ConversationListPanel';
import { resolvePrimaryPropertyImage } from '@/lib/property-images';
import { 
  Loader2, 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  ExternalLink, 
  ShieldCheck, 
  MapPin, 
  ChevronDown, 
  AlertCircle, 
  RotateCw,
  Clock,
  WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  status?: 'sending' | 'sent' | 'failed';
  tempId?: string;
  error?: string;
}

export default function ChatWindowPage() {
  const { user, loading: authLoading } = useAuth();
  const { markConversationAsRead } = useNotifications();
  const router = useRouter();
  const params = useParams();
  const conversationId = (params?.id as string) || '';

  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeConversationIdRef = useRef(conversationId);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  // 1. Fetch conversations list for left panel
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      setConversationsLoading(true);
      const res = await api.get<{ data: any[] }>('/conversations');
      setConversations(res.data || []);
    } catch (err) {
      console.error('Failed to load conversations list:', err);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  // 2. Container-scoped scroll to bottom (never shifts window/document)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
    setShowNewMessagesIndicator(false);
  }, []);

  // 3. Track scroll position to know if user is reading older messages
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 120; // 120px from bottom
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isNearBottomRef.current = isNear;
    if (isNear && showNewMessagesIndicator) {
      setShowNewMessagesIndicator(false);
    }
  };

  // 4. Fetch active conversation details and messages
  const fetchActiveChat = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError('');
      isInitialLoadRef.current = true;

      let currentConv: any = null;
      try {
        const directRes = await api.get<{ data: any }>(`/conversations/${conversationId}`);
        if (directRes.data) {
          currentConv = directRes.data;
        }
      } catch {
        // Fallback to conversation list lookup
        const listRes = await api.get<{ data: any[] }>('/conversations');
        currentConv = listRes.data?.find((c) => c.id === conversationId);
      }

      // Check if conversation switched while fetching metadata
      if (activeConversationIdRef.current !== conversationId) return;

      if (!currentConv) {
        router.replace('/chat');
        return;
      }

      const msgRes = await api.get<{ data: any[] }>(`/conversations/${conversationId}/messages`);

      // Check if conversation switched while fetching messages
      if (activeConversationIdRef.current !== conversationId) return;

      setConversation(currentConv);

      const serverMessages: ChatMessage[] = (msgRes.data || []).map((m) => ({
        ...m,
        status: 'sent',
      }));

      setMessages(serverMessages);

      // Refresh left panel conversations so unread counts update
      fetchConversations();

      // Synchronize read status with notification center immediately upon successful load
      markConversationAsRead(conversationId);
    } catch (err: any) {
      console.error('Failed to load chat details:', err);
      if (activeConversationIdRef.current === conversationId) {
        router.replace('/chat');
      }
    } finally {
      if (activeConversationIdRef.current === conversationId) {
        setLoading(false);
      }
    }
  }, [conversationId, router, fetchConversations, markConversationAsRead]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    fetchActiveChat();
  }, [user, authLoading, conversationId, fetchActiveChat, router]);

  // Initial scroll to bottom immediately after messages load
  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      // Instant auto-scroll without animation on initial load
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    }
  }, [loading, messages, scrollToBottom]);

  // 5. Incoming Realtime Message Handler with Deduplication & Reconciliation
  const handleIncomingMessage = useCallback(
    (newMsg: any) => {
      if (!newMsg || !newMsg.id) return;

      setMessages((prev) => {
        // Already present by server ID
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }

        // If sent by current user, reconcile any optimistic message with matching content and status='sending'
        const optimisticIndex = prev.findIndex(
          (m) =>
            m.status === 'sending' &&
            m.senderId === newMsg.senderId &&
            m.content.trim() === (newMsg.content || '').trim()
        );

        if (optimisticIndex !== -1) {
          const updated = [...prev];
          updated[optimisticIndex] = {
            ...newMsg,
            status: 'sent',
          };
          return updated;
        }

        return [...prev, { ...newMsg, status: 'sent' }];
      });

      // Update conversation's last message in left panel
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, messages: [newMsg] } : c))
      );

      // Scroll logic for incoming message
      if (newMsg.senderId === user?.id || isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('smooth'));
      } else {
        // User is scrolled up reading history; do not move viewport, show indicator
        setShowNewMessagesIndicator(true);
      }

      // If incoming message is from the other party and recipient is actively viewing this conversation,
      // mark it as read immediately so notification bell count and notification center stay synchronized
      if (newMsg.senderId !== user?.id) {
        markConversationAsRead(conversationId);
      }
    },
    [conversationId, user?.id, scrollToBottom, markConversationAsRead]
  );

  // Hook handles connection, stable callbacks, and fallback polling while disconnected
  const { status: realtimeStatus } = useConversationRealtime(
    conversationId,
    handleIncomingMessage
  );

  // 6. Optimistic Send Handler (Instant UX, non-blocking input)
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const currentContent = content.trim();
    if (!currentContent || sending) return;

    // Clear input immediately so user can type next message
    setContent('');
    setError('');

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      conversationId,
      senderId: user?.id || '',
      content: currentContent,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    // Immediately show in UI
    setMessages((prev) => [...prev, optimisticMessage]);

    // Update left panel preview
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, messages: [optimisticMessage] } : c))
    );

    // Always scroll to bottom when user sends
    requestAnimationFrame(() => scrollToBottom('smooth'));

    setSending(true);

    try {
      const res = await api.post<{ data: any }>(`/conversations/${conversationId}/messages`, {
        content: currentContent,
      });

      if (res.data) {
        const persisted = { ...res.data, status: 'sent' as const };
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId || m.tempId === tempId ? persisted : m))
        );

        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, messages: [persisted] } : c))
        );
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // Mark as failed in UI with retry ability
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId || m.tempId === tempId
            ? { ...m, status: 'failed', error: err.message || 'Failed to send' }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // 7. Retry a failed message
  const handleRetry = async (failedMsg: ChatMessage) => {
    // Re-mark as sending
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMsg.id ? { ...m, status: 'sending', error: undefined } : m
      )
    );

    try {
      const res = await api.post<{ data: any }>(`/conversations/${conversationId}/messages`, {
        content: failedMsg.content,
      });

      if (res.data) {
        const persisted = { ...res.data, status: 'sent' as const };
        setMessages((prev) =>
          prev.map((m) => (m.id === failedMsg.id ? persisted : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id
            ? { ...m, status: 'failed', error: err.message || 'Retry failed' }
            : m
        )
      );
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTenant = user?.role === 'TENANT';
  const otherUser = isTenant ? conversation?.owner : conversation?.tenant;
  const property = conversation?.property;
  const propertyImage = resolvePrimaryPropertyImage(property?.images, property?.id).url;

  // Helper to format date headers
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100dvh-4rem)] w-full flex overflow-hidden sm:p-4 md:p-6">
      <div className="w-full h-full bg-card sm:border border-border sm:rounded-2xl shadow-sm flex overflow-hidden">
        
        {/* Left Panel: Conversation List (Desktop only) */}
        <div className="hidden md:flex md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-border flex-col">
          <ConversationListPanel
            conversations={conversations}
            activeConversationId={conversationId}
            loading={conversationsLoading}
            onRefresh={fetchConversations}
            currentUserRole={user?.role}
            currentUserId={user?.id}
          />
        </div>

        {/* Right Panel: Active Conversation Window */}
        <div className="flex-grow h-full flex flex-col min-w-0 bg-card overflow-hidden relative">
          {loading || authLoading ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-muted gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading conversation...</p>
            </div>
          ) : !conversation ? null : (
            <>
              {/* Chat Header */}
              <div className="bg-card border-b border-border p-3 sm:p-4 flex items-center justify-between gap-3 flex-shrink-0 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button (Mobile view) */}
                  <Link
                    href="/chat"
                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors md:hidden"
                    title="Back to inbox"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Link>

                  <div className="relative h-11 w-11 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
                    <Image
                      src={propertyImage}
                      alt={property?.title || 'Property'}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-foreground text-sm sm:text-base truncate">
                        {otherUser?.name || 'User'}
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary flex-shrink-0">
                        {isTenant ? 'Property Owner' : 'Tenant'}
                      </span>
                    </div>

                    {property && (
                      <div className="flex items-center gap-2 text-xs text-muted truncate mt-0.5">
                        <Link
                          href={`/properties/${property.id}`}
                          target="_blank"
                          className="hover:text-primary transition-colors truncate font-medium flex items-center gap-1"
                        >
                          <span>{property.title}</span>
                          <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                        </Link>
                        {property.city && (
                          <span className="text-[11px] hidden sm:inline-flex items-center gap-0.5 text-muted/70 flex-shrink-0">
                            • <MapPin className="h-3 w-3 inline" /> {property.locality ? `${property.locality}, ` : ''}{property.city}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Subtle Realtime Status Badge */}
                  {realtimeStatus === 'disconnected' && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                      <WifiOff className="h-3 w-3 animate-pulse" />
                      <span>Reconnecting • Polling active</span>
                    </span>
                  )}

                  <Link href={isTenant ? '/rental-requests' : '/owner/requests'}>
                    <Button variant="ghost" size="sm" className="hidden lg:inline-flex text-xs text-muted hover:text-primary">
                      Rental Requests
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Message Feed (Container-scoped scroll, never scrolls viewport) */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-grow p-4 sm:p-6 overflow-y-auto bg-muted/5 flex flex-col gap-2 relative overscroll-contain"
                style={{ scrollBehavior: 'smooth' }}
              >
                {messages.length === 0 ? (
                  <div className="my-auto flex flex-col items-center justify-center p-6 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg mb-1">
                      Start chatting with {otherUser?.name || 'them'}
                    </h3>
                    {conversation?.rentalRequest?.status === 'ACCEPTED' ? (
                      <>
                        <p className="text-sm text-muted max-w-sm mb-3">
                          This verified conversation was created for your accepted rental request on{' '}
                          <span className="font-semibold text-foreground">{property?.title}</span>.
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 px-3 py-1.5 rounded-full">
                          <ShieldCheck className="h-4 w-4" />
                          <span>Rental Request Accepted & Verified</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted max-w-sm mb-3">
                          Connect directly regarding{' '}
                          <span className="font-semibold text-foreground">{property?.title}</span>.
                          Ask questions about rent, security deposit, furnishing, visits, or availability.
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span>Direct Pre-Rental Communication</span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;

                    const showDateSeparator =
                      !prevMsg ||
                      new Date(prevMsg.createdAt).toDateString() !==
                        new Date(msg.createdAt).toDateString();

                    const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <React.Fragment key={msg.id || msg.tempId || idx}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-2.5 select-none">
                            <span className="bg-card/90 backdrop-blur-sm border border-border/70 text-muted px-3 py-0.5 rounded-full text-[11px] font-medium shadow-2xs">
                              {getDateLabel(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div
                          className={`group flex flex-col max-w-[85%] sm:max-w-[75%] ${
                            isMe ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
                                isMe
                                  ? 'bg-primary text-white rounded-tr-xs shadow-xs'
                                  : 'bg-card border border-border text-foreground rounded-tl-xs shadow-xs'
                              } ${msg.status === 'failed' ? 'border-danger/40 ring-1 ring-danger/30' : ''}`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                              {/* Timestamp and status marker */}
                              <div
                                className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                                  isMe ? 'text-white/80' : 'text-muted'
                                }`}
                              >
                                <span>{timeString}</span>
                                {isMe && (
                                  <>
                                    {msg.status === 'sending' && (
                                      <Clock className="h-2.5 w-2.5 animate-pulse text-white/80" />
                                    )}
                                    {msg.status === 'failed' && (
                                      <AlertCircle className="h-3 w-3 text-red-200" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Report message action for recipient */}
                            {!isMe && msg.id && !msg.id.startsWith('temp-') && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ReportMessageButton messageId={msg.id} senderId={msg.senderId} />
                              </div>
                            )}
                          </div>

                          {/* Failed Send Actions */}
                          {msg.status === 'failed' && (
                            <div className="flex items-center gap-2 mt-1 px-1 text-xs text-danger">
                              <span>Failed to send.</span>
                              <button
                                onClick={() => handleRetry(msg)}
                                className="font-semibold underline hover:text-danger/80 inline-flex items-center gap-1"
                              >
                                <RotateCw className="h-3 w-3" /> Retry
                              </button>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Floating "New Messages" Jump Indicator */}
              {showNewMessagesIndicator && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <button
                    onClick={() => scrollToBottom('smooth')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold shadow-lg hover:bg-primary/95 transition-all active:scale-95"
                  >
                    <span>New messages</span>
                    <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
                  </button>
                </div>
              )}

              {/* Message Composer (Fixed at bottom of chat panel, not entire document) */}
              <div className="p-3 sm:p-4 bg-card border-t border-border flex-shrink-0 z-10">
                {error && (
                  <div className="text-xs text-danger mb-2 bg-danger/10 p-2 rounded-md border border-danger/20 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="font-bold ml-2">×</button>
                  </div>
                )}

                <form onSubmit={handleSend} className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                    className="flex-grow resize-none rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-h-32 min-h-[44px] transition-all leading-relaxed"
                    rows={1}
                    maxLength={2000}
                  />

                  <Button
                    type="submit"
                    disabled={!content.trim()}
                    className="h-11 w-11 rounded-full p-0 flex-shrink-0 shadow-xs"
                    title="Send Message (Enter)"
                    aria-label="Send Message"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
