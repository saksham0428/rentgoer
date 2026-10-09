/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface RentalRequestFormProps {
  propertyId: string;
}

export const RentalRequestForm = ({ propertyId }: RentalRequestFormProps) => {
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // existing request state
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [checkingState, setCheckingState] = useState(true);

  useEffect(() => {
    // Only check if user is tenant
    if (user?.role !== 'TENANT') {
      setCheckingState(false);
      return;
    }

    const checkExistingRequest = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/rental-requests/me');
        if (res.success) {
          // Find the latest request for this property
          const reqs = res.data.filter(r => r.propertyId === propertyId);
          if (reqs.length > 0) {
            // Sort by newest first just in case
            reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setExistingStatus(reqs[0].status);
          }
        }
      } catch (err) {
        console.error('Failed to check existing request:', err);
      } finally {
        setCheckingState(false);
      }
    };

    checkExistingRequest();
  }, [user, propertyId]);

  if (checkingState) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  // If Guest
  if (!user) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm text-center">
        <h3 className="text-lg font-bold text-foreground mb-2">Interested in renting?</h3>
        <p className="text-muted text-sm mb-6">Log in to send a rental request directly to the owner.</p>
        <Button onClick={() => router.push('/login')} className="w-full">
          Login to request this property
        </Button>
      </div>
    );
  }

  // If Owner
  if (user.role === 'OWNER') {
    return null; // Owners don't request properties from the frontend UI
  }

  // If Tenant already has PENDING or ACCEPTED
  if (existingStatus === 'PENDING') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm text-center">
        <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Request Pending</h3>
        <p className="text-muted text-sm mb-6">You have already submitted a rental request for this property. The owner is reviewing it.</p>
        <Button variant="outline" onClick={() => router.push('/rental-requests')} className="w-full">
          View My Requests
        </Button>
      </div>
    );
  }

  if (existingStatus === 'ACCEPTED') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm text-center">
        <div className="mx-auto w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-success mb-2">Request Accepted</h3>
        <p className="text-muted text-sm">Congratulations! The owner has accepted your rental request.</p>
      </div>
    );
  }

  // Default state: Can submit (never requested, or previous was REJECTED/CANCELLED)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post(`/properties/${propertyId}/rental-requests`, { message: message.trim() });
      setExistingStatus('PENDING'); // Optimistically show pending state
    } catch (err: any) {
      setError(err.message || 'Failed to submit rental request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-foreground mb-4">Send a Rental Request</h3>
      
      {existingStatus === 'REJECTED' && (
        <div className="mb-4 bg-danger/10 text-danger text-sm p-3 rounded-md border border-danger/20 flex items-start gap-2">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Your previous request was rejected. You may submit a new request if circumstances have changed.</span>
        </div>
      )}

      {existingStatus === 'CANCELLED' && (
        <div className="mb-4 bg-muted/10 text-muted text-sm p-3 rounded-md border border-border">
          You previously cancelled your request. You can submit a new one below.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">
            Message to Owner
          </label>
          <textarea
            id="message"
            rows={4}
            required
            placeholder="Hi, I am interested in this property. Can we schedule a visit?"
            className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-primary focus:border-primary bg-background text-foreground text-sm resize-none"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError('');
            }}
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted">Minimum 10 characters</span>
            <span className={`text-xs ${message.length > 1000 ? 'text-danger' : 'text-muted'}`}>
              {message.length}/1000
            </span>
          </div>
        </div>

        {error && (
          <div className="text-sm text-danger font-medium">{error}</div>
        )}

        <Button 
          type="submit" 
          fullWidth 
          disabled={loading || message.trim().length < 10 || message.length > 1000}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sending...
            </span>
          ) : (
            'Send Rental Request'
          )}
        </Button>
      </form>
    </div>
  );
};
