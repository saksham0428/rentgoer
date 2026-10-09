'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { PropertyForm } from '@/components/property/PropertyForm';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function NewPropertyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-danger mb-2">Access Denied</h2>
          <p className="text-muted mb-6">Only registered Property Owners can list properties.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow bg-background px-4 sm:px-6 lg:px-8">
      <PropertyForm isEdit={false} />
    </div>
  );
}
