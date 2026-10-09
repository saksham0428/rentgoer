/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface ReviewsProps {
  propertyId: string;
  averageRating: number;
  reviewCount: number;
  onReviewSubmitted?: () => void;
}

export const PropertyReviews = ({ propertyId, averageRating, reviewCount, onReviewSubmitted }: ReviewsProps) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [eligibleRequest, setEligibleRequest] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: any[], pagination: any }>(`/properties/${propertyId}/reviews?page=${page}`);
      setReviews(res.data);
      if (res.pagination) setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId, page]);

  const checkEligibility = useCallback(async () => {
    if (!user || user.role !== 'TENANT') return;
    try {
      const res = await api.get<{ data: any[] }>('/rental-requests/me');
      const completedRequests = res.data.filter((r: any) => r.propertyId === propertyId && r.status === 'COMPLETED');
      if (completedRequests.length > 0) {
        setEligibleRequest(completedRequests[0]);
      }
    } catch (err) {
      console.error('Failed to check eligibility', err);
    }
  }, [user, propertyId]);

  useEffect(() => {
    fetchReviews();
    checkEligibility();
  }, [fetchReviews, checkEligibility]);

  const handleEdit = (review: any) => {
    setEditingId(review.id);
    setRating(review.rating);
    setTitle(review.title || '');
    setComment(review.comment);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await api.delete(`/reviews/${id}`);
      fetchReviews();
      if (onReviewSubmitted) onReviewSubmitted();
      setEditingId(null);
      setShowForm(false);
      checkEligibility();
    } catch (err) {
      console.error('Failed to delete review', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (comment.length < 5) {
      setError('Comment must be at least 5 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      if (editingId) {
        await api.put(`/reviews/${editingId}`, { rating, title, comment });
      } else {
        await api.post(`/properties/${propertyId}/reviews`, {
          rentalRequestId: eligibleRequest.id,
          rating,
          title,
          comment
        });
      }
      
      setRating(0);
      setTitle('');
      setComment('');
      setShowForm(false);
      setEditingId(null);
      fetchReviews();
      checkEligibility();
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const hasReviewed = reviews.some(r => r.tenantId === user?.id);
  const canWriteReview = eligibleRequest && !hasReviewed && !showForm;

  return (
    <div className="mt-12 bg-card border border-border rounded-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Reviews
            {reviewCount > 0 && (
              <span className="text-sm font-normal text-muted bg-muted/10 px-2.5 py-0.5 rounded-full border border-border">
                {reviewCount}
              </span>
            )}
          </h2>
          {reviewCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`h-5 w-5 ${star <= Math.round(averageRating) ? 'fill-current' : 'text-muted'}`} />
                ))}
              </div>
              <span className="text-lg font-semibold text-foreground">{averageRating?.toFixed(1)}</span>
              <span className="text-muted">average rating</span>
            </div>
          )}
        </div>
        
        {canWriteReview && (
          <button
            onClick={() => {
              setEditingId(null);
              setRating(0);
              setTitle('');
              setComment('');
              setShowForm(true);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Write a Review
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-muted/30 border border-border rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit your review' : 'Write a review'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= (hoverRating || rating) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Summarize your experience"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                required
                minLength={5}
                maxLength={1000}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="What did you like or dislike?"
              />
            </div>
            
            {error && <div className="text-destructive text-sm font-medium">{error}</div>}
            
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="px-6 py-2 border border-border text-foreground font-semibold rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 flex flex-col items-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No reviews yet</h3>
          <p className="text-muted mt-1">This property doesn&apos;t have any reviews.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-border last:border-0 last:pb-0">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {review.tenant?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{review.tenant?.name || 'Anonymous'}</div>
                    <div className="text-xs text-muted">
                      {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                {user?.id === review.tenantId && (
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(review)} className="text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => handleDelete(review.id)} className="text-xs text-destructive hover:underline">Delete</button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center text-amber-500 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-current' : 'text-muted'}`} />
                ))}
              </div>
              
              {review.title && <h4 className="font-semibold text-foreground mb-1">{review.title}</h4>}
              <p className="text-muted-foreground whitespace-pre-line">{review.comment}</p>
            </div>
          ))}
          
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded disabled:opacity-50 text-sm"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-muted">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-border rounded disabled:opacity-50 text-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
