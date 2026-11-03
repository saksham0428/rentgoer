'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loader2, Building2, User, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  
  const roleParam = searchParams.get('role');
  const isOwnerIntent = roleParam === 'OWNER';
  const initialRole: 'TENANT' | 'OWNER' = isOwnerIntent ? 'OWNER' : 'TENANT';

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
    const { name, value } = e.target;
    if (name === 'role') {
      const sanitizedRole = value === 'OWNER' ? 'OWNER' : 'TENANT';
      setFormData(prev => ({ ...prev, role: sanitizedRole }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      await refreshUser();
      
      if (res.user?.role === 'OWNER') {
        router.push('/owner');
      } else {
        router.push('/properties');
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already in use') || err.message?.toLowerCase().includes('duplicate')) {
        setError(
          'An account with this email already exists. Note: RentGoer maintains separate accounts for Tenants and Owners. If you already registered this email, please log in.'
        );
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isOwnerSelected = formData.role === 'OWNER';

  return (
    <div className="flex-grow flex items-center justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-card p-7 sm:p-10 rounded-2xl border border-border/80 shadow-md">
        
        {/* Header Section */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-4 font-black text-xl shadow-2xs">
            {isOwnerSelected ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
          </div>

          <h1 className="text-center text-3xl font-extrabold text-foreground tracking-tight">
            Create an account
          </h1>

          {/* Prominent Role Identification Badge */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-light text-primary border border-primary/20">
            <span>Registering as:</span>
            <span className="font-bold uppercase tracking-wider">
              {isOwnerSelected ? 'Property Owner' : 'Tenant'}
            </span>
          </div>

          <p className="mt-2 text-center text-xs sm:text-sm text-muted leading-relaxed">
            {isOwnerSelected
              ? 'List residential properties and connect directly with verified renters with zero brokerage.'
              : 'Join RentGoer as a tenant looking for a place.'}
          </p>
        </div>

        {/* Existing Session Awareness Notice */}
        {user && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">
                Currently signed in as {user.name} ({user.role})
              </div>
              <p className="mt-1 leading-relaxed">
                {user.role === 'TENANT' && isOwnerSelected
                  ? 'RentGoer requires a separate email address for Property Owner accounts. Your existing tenant data will remain intact.'
                  : 'You have an active session. Registering will switch your active session to the new account.'}
              </p>
              {user.role === 'TENANT' && isOwnerSelected && (
                <div className="mt-2">
                  <Link
                    href="/owner/onboarding"
                    className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Read Owner Onboarding Guide</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error / Success Alerts */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm font-medium" role="alert">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm font-medium" role="alert">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              label={isOwnerSelected ? 'Owner / Organization Full Name' : 'Full Name'}
              placeholder={isOwnerSelected ? 'e.g. Ramesh Sharma' : 'e.g. John Doe'}
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
              placeholder={isOwnerSelected ? 'owner@example.com' : 'you@example.com'}
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
              label="Password (min. 8 characters)"
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
                { label: 'Property Owner listing rentals', value: 'OWNER' },
              ]}
            />
          </div>

          <div>
            <Button type="submit" fullWidth size="lg" disabled={loading} className="bg-primary hover:bg-primary-hover">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : isOwnerSelected ? (
                'Sign up as Property Owner'
              ) : (
                'Sign up'
              )}
            </Button>
          </div>
        </form>

        {/* Alternate Navigation */}
        <div className="pt-2 text-center text-xs sm:text-sm text-muted space-y-2 border-t border-border/60">
          <div>
            Already have an account?{' '}
            <Link
              href={isOwnerSelected ? '/login?role=OWNER' : '/login'}
              className="font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              {isOwnerSelected ? 'Owner Log in' : 'Log in'}
            </Link>
          </div>

          <div>
            {isOwnerSelected ? (
              <Link href="/register" className="text-muted hover:text-foreground text-xs transition-colors">
                Looking to rent instead? Register as a Tenant
              </Link>
            ) : (
              <Link href="/register?role=OWNER" className="text-muted hover:text-foreground text-xs transition-colors">
                Own a residential property? Register as an Owner
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-grow flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
