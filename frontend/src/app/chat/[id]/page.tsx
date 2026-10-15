'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ReportMessageButton } from '@/components/report/ReportMessageButton';
import { api } from '@/lib/api';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { ConversationListPanel } from '@/components/chat/ConversationListPanel';
import { Loader2, ArrowLeft, Send, MessageSquare, ExternalLink, ShieldCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ChatWindowPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = (params?.id as string) || '';

  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

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

  // 2. Fetch active conversation details and its messages
  const fetchActiveChat = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError('');

      let currentConv: any = null;
      try {
        const directRes = await api.get<{ data: any }>(`/conversations/${conversationId}`);
        if (directRes.data) {
          currentConv = directRes.data;
        }
      } catch {
        // Fallback to conversation list search
        const listRes = await api.get<{ data: any[] }>('/conversations');
        currentConv = listRes.data?.find((c) => c.id === conversationId);
      }

      if (!currentConv) {
        router.replace('/chat');
        return;
      }

      const msgRes = await api.get<{ data: any[] }>(`/conversations/${conversationId}/messages`);
      setConversation(currentConv);
      setMessages(msgRes.data || []);

      // Also refresh left panel conversations so unread counts update
      fetchConversations();
    } catch (err: any) {
      console.error('Failed to load chat details:', err);
      router.replace('/chat');
    } finally {
      setLoading(false);
    }
  }, [conversationId, router, fetchConversations]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    fetchActiveChat();
  }, [user, authLoading, conversationId, fetchActiveChat, router]);

  // Realtime subscription for incoming messages
  useConversationRealtime(conversationId, (newMsg) => {
    setMessages((prev) => {
      if (prev.find((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    // Update conversation's last message in left panel
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, messages: [newMsg] } : c))
    );
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || sending) return;

    const currentContent = content.trim();
    setContent('');
    setSending(true);
    setError('');

    try {
      const res = await api.post<{ data: any }>(`/conversations/${conversationId}/messages`, {
        content: currentContent,
      });

      if (res.data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });

        // Update last message in left panel list
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, messages: [res.data] } : c))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setContent(currentContent);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTenant = user?.role === 'TENANT';
  const otherUser = isTenant ? conversation?.owner : conversation?.tenant;
  const property = conversation?.property;
  const propertyImage = property?.images?.[0]?.url || '/placeholder-property.jpg';

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-64px)] w-full flex overflow-hidden sm:p-4 md:p-6">
      <div className="w-full h-full bg-card sm:border border-border sm:rounded-2xl shadow-sm flex overflow-hidden">
        
        {/* Left Panel: Conversation List (Desktop only; on mobile, user is in full-screen conversation) */}
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

        {/* Right Panel: Active Conversation Window (Full screen on mobile, right panel on desktop) */}
        <div className="flex-grow h-full flex flex-col min-w-0 bg-card overflow-hidden">
          {loading || authLoading ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-muted gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading conversation...</p>
            </div>
          ) : !conversation ? null : (
            <>
              {/* Chat Header */}
              <div className="bg-card border-b border-border p-3 sm:p-4 flex items-center justify-between gap-3 flex-shrink-0">
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
                  <Link href={isTenant ? '/rental-requests' : '/owner/requests'}>
                    <Button variant="ghost" size="sm" className="hidden lg:inline-flex text-xs text-muted hover:text-primary">
                      Rental Requests
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-grow p-4 sm:p-6 overflow-y-auto bg-muted/5 flex flex-col gap-3 sm:gap-4">
                {messages.length === 0 ? (
                  <div className="my-auto flex flex-col items-center justify-center p-6 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg mb-1">
                      Start chatting with {otherUser?.name || 'them'}
                    </h3>
                    <p className="text-sm text-muted max-w-sm mb-3">
                      This secure conversation was created for your accepted rental request on{' '}
                      <span className="font-semibold text-foreground">{property?.title}</span>.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 px-3 py-1.5 rounded-full">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Rental Request Accepted & Verified</span>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id || idx}
                        className={`group flex flex-col max-w-[85%] sm:max-w-[75%] ${
                          isMe ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? 'bg-primary text-white rounded-tr-none shadow-sm'
                                : 'bg-card border border-border text-foreground rounded-tl-none shadow-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          {!isMe && msg.id && (
                            <ReportMessageButton messageId={msg.id} senderId={msg.senderId} />
                          )}
                        </div>
                        <span className="text-[10px] text-muted mt-1 px-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer (WhatsApp style) */}
              <div className="p-3 sm:p-4 bg-card border-t border-border flex-shrink-0">
                {error && (
                  <div className="text-xs text-danger mb-2 bg-danger/10 p-2 rounded-md border border-danger/20">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2 items-end">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                    className="flex-grow resize-none rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-h-32 min-h-[44px]"
                    rows={1}
                    maxLength={2000}
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    disabled={!content.trim() || sending}
                    className="h-11 w-11 rounded-full p-0 flex-shrink-0"
                    title="Send Message"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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
