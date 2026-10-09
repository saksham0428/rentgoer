/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Loader2, MessageSquare, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchConversations = async () => {
      try {
        const res = await api.get<{ data: any[] }>('/conversations');
        setConversations(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <MessageSquare className="h-16 w-16 mx-auto text-muted/30 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-foreground">No conversations yet</h2>
        <p className="text-muted mb-8">
          When a rental request is accepted, you can chat here.
        </p>
        <Link href={user?.role === 'TENANT' ? '/properties' : '/owner'}>
          <Button>{user?.role === 'TENANT' ? 'Browse Properties' : 'View My Properties'}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-foreground flex items-center gap-3">
        <MessageSquare className="h-8 w-8 text-primary" />
        Messages
      </h1>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {conversations.map(conv => {
          const isTenant = user?.role === 'TENANT';
          const otherUser = isTenant ? conv.owner : conv.tenant;
          const propertyImage = conv.property.images?.[0]?.url || '/placeholder-property.jpg';
          const lastMessage = conv.messages?.[0];

          return (
            <Link href={`/chat/${conv.id}`} key={conv.id} className="block border-b border-border last:border-b-0 hover:bg-muted/5 transition-colors p-4 sm:p-6">
              <div className="flex gap-4 items-center">
                <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                  <Image src={propertyImage} alt={conv.property.title} fill className="object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-foreground text-sm sm:text-base truncate pr-4">{otherUser.name}</h3>
                    {lastMessage && (
                      <span className="text-xs text-muted flex-shrink-0 whitespace-nowrap">
                        {new Date(lastMessage.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-primary mb-1 truncate">{conv.property.title}</p>
                  <p className="text-sm text-muted truncate">
                    {lastMessage ? (
                      <>
                        {lastMessage.senderId === user?.id ? 'You: ' : ''}
                        {lastMessage.content}
                      </>
                    ) : (
                      <span className="italic text-muted/70">No messages yet. Say hi!</span>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
