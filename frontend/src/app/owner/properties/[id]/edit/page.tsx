'use client';

import React, { useEffect, useState } from 'react';
import { notFound, useRouter, useParams } from 'next/navigation';
import { PropertyForm } from '@/components/property/PropertyForm';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function EditPropertyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [property, setProperty] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchProperty = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any }>(`/properties/${id}`);
        setProperty(res.data);
      } catch (err: any) {
        console.error('Failed to fetch property details for edit:', err);
        setError('not-found');
      } finally {
        setDataLoading(false);
      }
    };

    fetchProperty();
  }, [id, user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'not-found' || !property) {
    return notFound();
  }

  // Ensure only the true owner can load the edit form
  if (property.owner?.id !== user?.id) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-danger mb-2">Access Denied</h2>
          <p className="text-muted mb-6">You do not have permission to edit this property.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow bg-background px-4 sm:px-6 lg:px-8">
      <PropertyForm initialData={property} isEdit={true} />
    </div>
  );
}
