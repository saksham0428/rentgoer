'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, ArrowLeft, ShieldCheck, ShieldX, User, Mail, Phone, Calendar, Home, FileText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any }>(`/admin/users/${id}`);
        setUser(res.data);
      } catch (err) {
        console.error('Failed to load user:', err);
        setError('Failed to load user details');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-danger p-8 bg-red-50 rounded-xl border border-red-100">
          <p className="font-medium">{error || 'User not found'}</p>
          <Link href="/admin/users" className="mt-4 inline-block">
            <Button variant="outline">Back to Users</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-5xl mx-auto space-y-6">
      <Link href="/admin/users" className="inline-flex items-center text-sm font-medium text-muted hover:text-foreground mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Users
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{user.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                user.role === 'OWNER' ? 'bg-indigo-100 text-indigo-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {user.role}
              </span>
              {user.isVerified ? (
                <span className="inline-flex items-center text-sm font-medium text-success">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Identity Verified
                </span>
              ) : (
                <span className="inline-flex items-center text-sm text-muted">
                  <ShieldX className="w-4 h-4 mr-1 opacity-50" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm md:col-span-1 space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Profile Details</h3>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted">Email Address</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted">Phone Number</p>
              <p className="text-sm font-medium">{user.phone || 'Not provided'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted">Registered On</p>
              <p className="text-sm font-medium">{format(new Date(user.createdAt), 'MMMM d, yyyy')}</p>
            </div>
          </div>
          {user.verifiedAt && (
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-success" />
              <div>
                <p className="text-xs text-muted">Verified On</p>
                <p className="text-sm font-medium">{format(new Date(user.verifiedAt), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Activity & Stats */}
        <div className="bg-white border border-border rounded-xl shadow-sm md:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border bg-gray-50/50">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Activity Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {user.role === 'OWNER' && (
                <div className="bg-white p-4 rounded-lg border border-border text-center">
                  <Home className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{user._count.properties}</p>
                  <p className="text-xs text-muted uppercase tracking-wider mt-1">Properties</p>
                </div>
              )}
              <div className="bg-white p-4 rounded-lg border border-border text-center">
                <FileText className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{user._count.rentalRequests}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">Requests</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-border text-center">
                <User className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{user._count.tenantReviews}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">Reviews</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-border text-center">
                <Activity className="h-5 w-5 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{user._count.reports}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">Reports Filed</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {user.role === 'OWNER' && (
              <div className="p-6">
                <h4 className="text-sm font-semibold text-foreground mb-4">Recent Properties ({user.properties.length})</h4>
                {user.properties.length === 0 ? (
                  <p className="text-sm text-muted">No properties listed yet.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {user.properties.map((p: any) => (
                      <li key={p.id} className="p-3 hover:bg-muted/20 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted">{p.city} • ₹{p.rent}/mo</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.isVerified && <ShieldCheck className="h-4 w-4 text-success"  />}
                          <Link href={`/admin/properties/${p.id}`} className="text-primary hover:underline">
                            View
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {user.role === 'TENANT' && (
              <div className="p-6">
                <h4 className="text-sm font-semibold text-foreground mb-4">Recent Rental Requests ({user.rentalRequests.length})</h4>
                {user.rentalRequests.length === 0 ? (
                  <p className="text-sm text-muted">No rental requests submitted.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {user.rentalRequests.map((r: any) => (
                      <li key={r.id} className="p-3 hover:bg-muted/20 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium text-foreground line-clamp-1">Property: {r.property?.title}</p>
                          <p className="text-xs text-muted">{format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-3 pl-4">
                          <Link href={`/admin/properties/${r.property?.id}`} className="text-primary hover:underline whitespace-nowrap">
                            View Property
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
