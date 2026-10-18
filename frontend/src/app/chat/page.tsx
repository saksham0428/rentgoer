'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ConversationListPanel } from '@/components/chat/ConversationListPanel';
import { MessageSquare, ShieldCheck, ClipboardList, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get<{ data: any[] }>('/conversations');
      setConversations(res.data || []);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError(err.message || 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    fetchConversations();
  }, [user, authLoading, router, fetchConversations]);

  const isTenant = user?.role === 'TENANT';

  return (
    <div className="max-w-7xl mx-auto h-[calc(100dvh-4rem)] w-full flex overflow-hidden sm:p-4 md:p-6">
      <div className="w-full h-full bg-card sm:border border-border sm:rounded-2xl shadow-sm flex overflow-hidden">
        
        {/* Left Panel: Conversation List (Full width on mobile, fixed width on desktop) */}
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-border flex flex-col">
          <ConversationListPanel
            conversations={conversations}
            loading={loading}
            error={error}
            onRefresh={fetchConversations}
            currentUserRole={user?.role}
            currentUserId={user?.id}
          />
        </div>

        {/* Right Panel: WhatsApp-style placeholder on desktop (hidden on mobile) */}
        <div className="hidden md:flex flex-grow flex-col items-center justify-center p-8 bg-muted/5 text-center">
          <div className="max-w-md flex flex-col items-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm ring-8 ring-primary/5">
              <MessageSquare className="h-10 w-10" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              RentGoer Messaging
            </h2>

            <p className="text-sm text-muted mb-6 leading-relaxed">
              Connect directly with {isTenant ? 'property owners' : 'tenants'} to discuss properties, ask questions, and coordinate rental agreements in a safe, verified channel.
            </p>

            <div className="flex items-center gap-2 text-xs text-muted/80 bg-muted/20 px-3.5 py-2 rounded-full mb-8 border border-border">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>End-to-end verified rental marketplace communication</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={isTenant ? '/rental-requests' : '/owner/requests'}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  View Rental Requests
                </Button>
              </Link>
              <Link href={isTenant ? '/properties' : '/owner'}>
                <Button size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  {isTenant ? 'Browse Properties' : 'My Properties'}
                </Button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
