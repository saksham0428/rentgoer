/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface ReportModalProps {
  targetType: 'PROPERTY' | 'USER' | 'MESSAGE';
  targetId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASONS = [
  'FRAUD',
  'SCAM',
  'FAKE_LISTING',
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'SPAM',
  'MISLEADING_INFORMATION',
  'SAFETY_CONCERN',
  'OTHER'
];

export const ReportModal = ({ targetType, targetId, onClose, onSuccess }: ReportModalProps) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      setError('Description must be at least 5 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let url = '/reports';
      if (targetType === 'PROPERTY') url = `/properties/${targetId}/report`;
      else if (targetType === 'USER') url = `/users/${targetId}/report`;
      else if (targetType === 'MESSAGE') url = `/messages/${targetId}/report`;

      await api.post(url, { reason, description });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-border bg-muted/5">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-danger" />
            Report {targetType.toLowerCase()}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center mb-4 text-success">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Report Submitted</h3>
            <p className="text-muted">Thank you for helping us keep the community safe. Our team will review this report shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <p className="text-sm text-muted">
              Please provide details about why you are reporting this {targetType.toLowerCase()}. False reports may result in account suspension.
            </p>

            <div>
              <label className="block text-sm font-semibold mb-1 text-foreground">Reason</label>
              <select 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              >
                {REASONS.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                minLength={5}
                maxLength={1000}
                placeholder="Please provide specific details..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-none"
              />
              <div className="text-right text-xs text-muted mt-1">
                {description.length}/1000
              </div>
            </div>

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
