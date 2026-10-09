'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  
  const initialRole = searchParams.get('role') === 'OWNER' ? 'OWNER' : 'TENANT';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: initialRole,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post<{ success: boolean; user: any }>('/auth/register', formData);
      
      // Some backends return the user object directly, some might require a separate login.
      // Assuming it establishes a session based on the backend regression test ("Testing LOGOUT... /me after logout"):
      // Wait, the backend registration creates the token cookie immediately.
      
      await refreshUser();
      
      if (res.user?.role === 'OWNER') {
        router.push('/owner');
      } else {
        router.push('/properties');
      }
    } catch (err: any) {
      // Clean up duplicate email error
      if (err.message?.toLowerCase().includes('already in use') || err.message?.toLowerCase().includes('duplicate')) {
        setError('An account with this email already exists.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-foreground tracking-tight">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Join RentGoer as a tenant or property owner.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-md text-sm font-medium" role="alert">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-md text-sm font-medium" role="alert">
            {successMsg}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              label="Full Name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
            />
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
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              label="Phone Number (Optional)"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={handleChange}
            />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              label="Password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
            />
            <Select
              id="role"
              name="role"
              label="I am a..."
              required
              value={formData.role}
              onChange={handleChange}
              options={[
                { label: 'Tenant looking for a place', value: 'TENANT' },
                { label: 'Owner listing a property', value: 'OWNER' },
              ]}
            />
          </div>

          <div>
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Sign up'}
            </Button>
          </div>
        </form>
        <div className="text-center text-sm text-muted mt-4">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover transition-colors">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
