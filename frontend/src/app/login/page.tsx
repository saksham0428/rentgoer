'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
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
      if (role === 'OWNER') {
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
    <div className="flex-grow flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-card p-6 sm:p-8 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Log in to manage your properties or rental requests.
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

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary-hover">
              Sign up
            </Link>
          </p>
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
