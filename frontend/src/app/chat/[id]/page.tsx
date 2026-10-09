/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ReportMessageButton } from '@/components/report/ReportMessageButton';
import { api } from '@/lib/api';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ChatWindowPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  // Fetch initial data
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const init = async () => {
      try {
        const [convRes, msgRes] = await Promise.all([
          api.get<{ data: any[] }>('/conversations'),
          api.get<{ data: any[] }>(`/conversations/${params.id}/messages`)
        ]);

        const currentConv = convRes.data?.find(c => c.id === params.id);
        if (!currentConv) {
          router.replace('/chat');
          return;
        }

        setConversation(currentConv);
        setMessages(msgRes.data || []);
      } catch (err) {
        console.error('Failed to load chat:', err);
        router.replace('/chat');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, authLoading, params.id, router]);

  // Realtime subscription
  useConversationRealtime(params.id, (newMsg) => {
    // Only append if it's not our own message (which we add optimistically)
    setMessages(prev => {
      if (prev.find(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  });

  // Auto scroll
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
      const res = await api.post<{ data: any }>(`/conversations/${params.id}/messages`, { content: currentContent });
      // We append it locally immediately
      setMessages(prev => [...prev, res.data]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setContent(currentContent); // restore content
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

  if (loading || authLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) return null;

  const isTenant = user?.role === 'TENANT';
  const otherUser = isTenant ? conversation.owner : conversation.tenant;
  const property = conversation.property;

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-64px)] sm:h-[calc(100vh-120px)] sm:my-6 bg-card sm:border border-border sm:rounded-xl shadow-sm flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="bg-muted/10 border-b border-border p-4 flex items-center gap-4 flex-shrink-0">
        <Link href="/chat" className="text-muted hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-gray-200 hidden sm:block">
          <Image src={property.images?.[0]?.url || '/placeholder-property.jpg'} alt={property.title} fill className="object-cover" />
        </div>
        <div className="flex-grow min-w-0">
          <h2 className="font-bold text-foreground truncate">{otherUser.name}</h2>
          <Link href={`/properties/${property.id}`} className="text-xs text-primary hover:underline truncate block">
            {property.title}
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow p-4 overflow-y-auto bg-muted/5 flex flex-col gap-4">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id || idx} className={`group flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
              <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border text-foreground rounded-tl-none'}`}>
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                </div>
                {!isMe && msg.id && <ReportMessageButton messageId={msg.id} senderId={msg.senderId} />}
              </div>
              <span className="text-[10px] text-muted mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="p-4 bg-card border-t border-border flex-shrink-0">
        {error && <div className="text-xs text-danger mb-2">{error}</div>}
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for newline)"
            className="flex-grow resize-none rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-h-32 min-h-[44px]"
            rows={1}
            maxLength={2000}
            disabled={sending}
          />
          <Button type="submit" disabled={!content.trim() || sending} className="h-11 w-11 rounded-full p-0 flex-shrink-0">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
