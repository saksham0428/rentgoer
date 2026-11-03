'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2, CheckCircle2, Building2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const roleParam = searchParams.get('role');
  const isOwnerIntent = roleParam === 'OWNER' || searchParams.get('redirect')?.startsWith('/owner');
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post<{ success: boolean; user: any; message: string }>('/auth/login', formData);

      // Update context user state
      await refreshUser();

      const role = res.user?.role;
      const redirectUrl = searchParams.get('redirect');
      const isSafeInternalRedirect =
        redirectUrl &&
        redirectUrl.startsWith('/') &&
        !redirectUrl.startsWith('//') &&
        !redirectUrl.startsWith('/\\');

      if (isSafeInternalRedirect) {
        // If a non-admin user somehow had an admin redirect, route them to their designated dashboard
        if (redirectUrl.startsWith('/admin') && role !== 'ADMIN') {
          router.push(role === 'OWNER' ? '/owner' : '/tenant');
        } else {
          router.push(redirectUrl);
        }
      } else if (role === 'ADMIN') {
        router.push('/admin');
      } else if (role === 'OWNER') {
        router.push('/owner');
      } else if (role === 'TENANT') {
        router.push('/properties');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-card p-7 sm:p-10 rounded-2xl border border-border/80 shadow-md">
        
        {/* Header Section */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-4 font-black text-xl shadow-2xs">
            {isOwnerIntent ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
          </div>

          {isOwnerIntent && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-muted/10 text-primary">
              <span>Owner Portal</span>
            </div>
          )}

          <h1 className="text-center text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {isOwnerIntent ? 'Owner Sign In' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-muted leading-relaxed">
            {isOwnerIntent
              ? 'Sign in to access your Owner Dashboard and manage your properties.'
              : 'Log in to manage your properties, saved listings, or rental requests.'}
          </p>
        </div>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2" role="status">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm font-medium" role="alert">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Input
                label="Email address"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
              className="bg-primary hover:bg-primary-hover"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Logging in...
                </>
              ) : isOwnerIntent ? (
                'Sign In as Owner'
              ) : (
                'Log in'
              )}
            </Button>
          </div>
        </form>

        {/* Footer Navigation */}
        <div className="pt-2 text-center text-xs sm:text-sm text-muted space-y-2 border-t border-border/60">
          <p>
            Don&apos;t have an account?{' '}
            <Link
              href={isOwnerIntent ? '/register?role=OWNER' : '/register'}
              className="font-semibold text-primary hover:text-primary-hover"
            >
              {isOwnerIntent ? 'Register as Property Owner' : 'Sign up'}
            </Link>
          </p>

          <div>
            {isOwnerIntent ? (
              <Link href="/login" className="text-muted hover:text-foreground text-xs transition-colors">
                Looking to rent instead? Tenant Sign In
              </Link>
            ) : (
              <Link href="/login?role=OWNER" className="text-muted hover:text-foreground text-xs transition-colors">
                Are you a property owner? Owner Sign In
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-grow flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
