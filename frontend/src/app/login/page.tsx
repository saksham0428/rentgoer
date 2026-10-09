'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
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
    <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Log in to manage your properties or rental requests.
          </p>
        </div>
        
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-md text-sm font-medium" role="alert">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              label="Email address"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
            />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              label="Password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <div>
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Sign in'}
            </Button>
          </div>
        </form>
        <div className="text-center text-sm text-muted mt-4">
          Don&apos;t have an account??{' '}
          <Link href="/register" className="font-medium text-primary hover:text-primary-hover transition-colors">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
