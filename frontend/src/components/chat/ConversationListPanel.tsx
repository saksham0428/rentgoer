'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, Search, MapPin, Loader2, RefreshCw, X, ClipboardList, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConversationListPanelProps {
  conversations: any[];
  activeConversationId?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  currentUserRole?: string;
  currentUserId?: string;
}

export const ConversationListPanel: React.FC<ConversationListPanelProps> = ({
  conversations,
  activeConversationId,
  loading = false,
  error = '',
  onRefresh,
  currentUserRole,
  currentUserId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isTenant = currentUserRole === 'TENANT';

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();

    return conversations.filter((conv) => {
      const otherUser = isTenant ? conv.owner : conv.tenant;
      const userName = (otherUser?.name || '').toLowerCase();
      const propTitle = (conv.property?.title || '').toLowerCase();
      const locality = (conv.property?.locality || '').toLowerCase();
      const city = (conv.property?.city || '').toLowerCase();
      const lastMsg = (conv.messages?.[0]?.content || '').toLowerCase();

      return (
        userName.includes(term) ||
        propTitle.includes(term) ||
        locality.includes(term) ||
        city.includes(term) ||
        lastMsg.includes(term)
      );
    });
  }, [conversations, searchTerm, isTenant]);

  const formatMessageTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border w-full select-none">
      {/* Header & Search */}
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </h1>
            {conversations.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted font-semibold">
                {conversations.length}
              </span>
            )}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors"
              title="Refresh conversations"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, property, or message..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted/10 border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-grow overflow-y-auto divide-y divide-border/60">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Loading conversations...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-danger space-y-3">
            <p>{error}</p>
            {onRefresh && (
              <Button size="sm" variant="outline" onClick={onRefresh} className="mx-auto">
                Try Again
              </Button>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-muted flex flex-col items-center justify-center h-64">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-foreground text-sm mb-1">No conversations yet</h3>
            <p className="text-xs text-muted mb-4 max-w-xs leading-relaxed">
              When a rental request is accepted, your chat will automatically appear here.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Link href={isTenant ? '/rental-requests' : '/owner/requests'}>
                <Button size="sm" variant="outline" fullWidth className="gap-2 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" /> View Rental Requests
                </Button>
              </Link>
              <Link href={isTenant ? '/properties' : '/owner'}>
                <Button size="sm" fullWidth className="gap-2 text-xs">
                  <Home className="h-3.5 w-3.5" /> {isTenant ? 'Browse Properties' : 'My Properties'}
                </Button>
              </Link>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            <p>No conversations match &ldquo;{searchTerm}&rdquo;</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-2 text-xs text-primary font-semibold hover:underline"
            >
              Clear Search
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const otherUser = isTenant ? conv.owner : conv.tenant;
            const property = conv.property;
            const propertyImage = property?.images?.[0]?.url || '/placeholder-property.jpg';
            const lastMessage = conv.messages?.[0];
            const isActive = conv.id === activeConversationId;
            const unreadCount = conv._count?.messages || 0;

            return (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`block transition-colors p-3.5 sm:p-4 hover:bg-muted/10 relative ${
                  isActive
                    ? 'bg-primary/5 border-l-4 border-primary text-foreground'
                    : 'text-foreground'
                }`}
              >
                <div className="flex gap-3 items-center">
                  <div className="relative h-12 w-12 flex-shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                    <Image
                      src={propertyImage}
                      alt={property?.title || 'Property'}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-0.5 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4
                          className={`truncate text-sm ${
                            isActive || unreadCount > 0 ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          {otherUser?.name || 'User'}
                        </h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted font-medium flex-shrink-0">
                          {isTenant ? 'Owner' : 'Tenant'}
                        </span>
                      </div>
                      {lastMessage && (
                        <span className="text-[11px] text-muted flex-shrink-0 whitespace-nowrap">
                          {formatMessageTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-primary font-medium truncate mb-0.5">
                      {property?.title}
                    </p>

                    <div className="flex justify-between items-center gap-2">
                      <p
                        className={`text-xs truncate ${
                          unreadCount > 0 ? 'text-foreground font-semibold' : 'text-muted'
                        }`}
                      >
                        {lastMessage ? (
                          <>
                            <span className="opacity-75">
                              {lastMessage.senderId === currentUserId ? 'You: ' : ''}
                            </span>
                            {lastMessage.content}
                          </>
                        ) : (
                          <span className="italic opacity-70">No messages yet</span>
                        )}
                      </p>

                      {unreadCount > 0 && (
                        <span className="flex-shrink-0 h-5 min-w-[1.25rem] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};
