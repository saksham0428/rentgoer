'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface RentalRequestChatButtonProps {
  requestId: string;
  conversationId?: string | null;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RentalRequestChatButton: React.FC<RentalRequestChatButtonProps> = ({
  requestId,
  conversationId,
  label = 'Chat',
  variant = 'primary',
  size = 'sm',
  className = '',
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If conversation ID is already available, use a direct Link for instant prefetching and routing
  if (conversationId) {
    return (
      <Link href={`/chat/${conversationId}`} className="inline-block">
        <Button variant={variant} size={size} className={`gap-1.5 shadow-sm ${className}`}>
          <MessageSquare className="h-4 w-4" />
          <span>{label}</span>
        </Button>
      </Link>
    );
  }

  // Fallback: If conversation ID is not yet available in the parent request object,
  // query/create the conversation on-demand when clicked and navigate to it.
  const handleOpenChat = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post<{ success: boolean; data: { id: string } }>('/conversations', {
        rentalRequestId: requestId,
      });

      if (res.data?.id) {
        router.push(`/chat/${res.data.id}`);
      } else {
        throw new Error('No conversation ID returned');
      }
    } catch (err: any) {
      console.error('Failed to open or initialize chat:', err);
      setError(err.message || 'Failed to start chat');
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenChat}
        disabled={loading}
        className={`gap-1.5 shadow-sm ${className}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        <span>{loading ? 'Opening...' : label}</span>
      </Button>
      {error && <span className="text-[11px] text-danger mt-1">{error}</span>}
    </div>
  );
};
