'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface ChatWithOwnerButtonProps {
  propertyId: string;
  ownerId?: string;
  isAvailable?: boolean;
  className?: string;
}

export const ChatWithOwnerButton: React.FC<ChatWithOwnerButtonProps> = ({
  propertyId,
  ownerId,
  isAvailable = true,
  className = '',
}) => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. If currently authenticated user is the owner of this property, do not expose self-chat
  if (user && ownerId && user.id === ownerId) {
    return null;
  }

  // 2. If user is an OWNER role in general, do not show tenant inquiry action
  if (user && user.role === 'OWNER') {
    return null;
  }

  const handleChat = async () => {
    // 3. For unauthenticated visitors, redirect to login preserving return path
    if (!user) {
      router.push(`/login?redirect=/properties/${propertyId}`);
      return;
    }

    // 4. Prevent duplicate clicks while pending
    if (loading) return;

    try {
      setLoading(true);
      setError('');

      const res = await api.post<{ success: boolean; data: { id: string } }>('/conversations', {
        propertyId,
      });

      if (res.data?.id) {
        router.push(`/chat/${res.data.id}`);
      } else {
        throw new Error('Failed to retrieve conversation ID');
      }
    } catch (err: any) {
      console.error('Failed to initiate pre-rental conversation:', err);
      setError(err.message || 'Unable to connect with the owner. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <Button
        type="button"
        variant="outline"
        fullWidth
        size="md"
        onClick={handleChat}
        disabled={loading || authLoading}
        className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 font-semibold gap-2 py-2.5 transition-all shadow-xs"
        title="Ask questions about rent, deposit, visits, or availability directly with the owner"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Connecting to owner...</span>
          </>
        ) : (
          <>
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Chat with Owner</span>
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger mt-2 bg-danger/5 p-2 rounded-md border border-danger/20">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
