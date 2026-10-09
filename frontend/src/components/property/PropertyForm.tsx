'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { Trash2, Loader2, UploadCloud, X, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface PropertyFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export const PropertyForm = ({ initialData, isEdit = false }: PropertyFormProps) => {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Property Form State
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    rent: initialData?.rent || '',
    securityDeposit: initialData?.securityDeposit !== undefined ? initialData.securityDeposit : '',
    city: initialData?.city || '',
    locality: initialData?.locality || '',
    address: initialData?.address || '',
    bedrooms: initialData?.bedrooms !== undefined ? initialData.bedrooms : '',
    bathrooms: initialData?.bathrooms !== undefined ? initialData.bathrooms : '',
    propertyType: initialData?.propertyType || 'APARTMENT',
    furnishedStatus: initialData?.furnishedStatus || 'UNFURNISHED',
    isAvailable: initialData?.isAvailable !== undefined ? String(initialData.isAvailable) : 'true',
  });

  // Image Management State
  const [images, setImages] = useState<{ id: string; url: string; publicId: string }[]>(initialData?.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState('');

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        rent: Number(formData.rent),
        securityDeposit: formData.securityDeposit ? Number(formData.securityDeposit) : Number(formData.rent) * 2,
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        isAvailable: formData.isAvailable === 'true',
      };

      if (isEdit) {
        await api.put(`/properties/${initialData.id}`, payload);
        router.refresh();
        router.push('/owner');
      } else {
        const res = await api.post<{ success: boolean; data: any }>('/properties', payload);
        // On successful create, redirect to edit page to allow image uploads
        router.push(`/owner/properties/${res.data.id}/edit`);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the property.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!window.confirm('Are you sure you want to delete this property? All images and data will be permanently removed.')) {
      return;
    }
    
    setLoading(true);
    try {
      await api.delete(`/properties/${initialData.id}`);
      router.refresh();
      router.push('/owner');
    } catch (err: any) {
      setError(err.message || 'Failed to delete property.');
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    
    if (files.length > 5) {
      setImageError('You can only upload a maximum of 5 images at once.');
      return;
    }
    
    if (images.length + files.length > 10) {
      setImageError('Property image limit exceeded. Maximum 10 images allowed.');
      return;
    }

    // Basic client-side validation
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    for (const file of files) {
      if (!validMimeTypes.includes(file.type)) {
        setImageError('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError('File too large. Maximum size is 5MB.');
        return;
      }
    }

    setUploadingImages(true);
    setImageError('');

    const formPayload = new FormData();
    files.forEach(file => formPayload.append('images', file));

    try {
      // Direct fetch to include FormData safely with credentials
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/properties/${initialData.id}/images`, {
        method: 'POST',
        body: formPayload,
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setImages(prev => [...prev, ...data.data]);
      // Clear input
      e.target.value = '';
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload images.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm('Delete this image?')) return;
    
    setImageError('');
    try {
      await api.delete(`/properties/${initialData.id}/images/${imageId}`);
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err: any) {
      setImageError(err.message || 'Failed to delete image.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/owner" className="inline-flex items-center text-sm font-medium text-muted hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        {isEdit && (
          <Button variant="outline" className="text-danger border-danger hover:bg-danger/5" onClick={handleDeleteProperty} disabled={loading}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Property
          </Button>
        )}
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-8">
        {isEdit ? 'Edit Property' : 'List a New Property'}
      </h1>

      {error && (
        <div className="mb-6 bg-danger/10 text-danger p-4 rounded-md border border-danger/20 font-medium">
          {error}
        </div>
      )}

      {/* Image Manager (Only available in Edit mode to ensure we have a Property ID) */}
      {isEdit && (
        <div className="bg-card border border-border p-6 rounded-xl mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-4">Property Images</h2>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted">Upload up to 10 images (JPEG, PNG, WebP). Max 5MB each.</span>
              <span className="text-sm font-medium">{images.length}/10</span>
            </div>
            
            <div className="flex items-center gap-4">
              <label className={`relative flex items-center justify-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-white hover:bg-gray-50 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary transition-colors ${images.length >= 10 || uploadingImages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                {uploadingImages ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UploadCloud className="h-5 w-5 mr-2 text-muted" />}
                <span>{uploadingImages ? 'Uploading...' : 'Select Images'}</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/jpeg, image/png, image/webp" 
                  className="sr-only" 
                  onChange={handleImageUpload}
                  disabled={images.length >= 10 || uploadingImages}
                />
              </label>
            </div>
            {imageError && <p className="mt-2 text-sm text-danger">{imageError}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group border border-border">
                <Image src={img.url} alt="Property image" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-1 right-1 bg-red-600/90 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  aria-label="Delete image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-border rounded-lg text-muted">
                No images uploaded yet.
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-card border border-border p-6 sm:p-8 rounded-xl shadow-sm space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">Basic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Input
                label="Property Title"
                placeholder="e.g. Spacious 2BHK in Downtown"
                required
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                required
                rows={4}
                className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors bg-card text-foreground"
                placeholder="Describe the property features..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="City"
              placeholder="e.g. Chandigarh"
              required
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
            <Input
              label="Locality / Sector"
              placeholder="e.g. Sector 43"
              required
              value={formData.locality}
              onChange={(e) => handleChange('locality', e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                label="Full Address"
                placeholder="e.g. House No 123, Sector 43A"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">Pricing & Specifications</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Input
              label="Monthly Rent (₹)"
              type="number"
              min="0"
              required
              value={formData.rent}
              onChange={(e) => handleChange('rent', e.target.value)}
            />
            <Input
              label="Security Deposit (₹)"
              type="number"
              min="0"
              placeholder="Defaults to 2x Rent"
              value={formData.securityDeposit}
              onChange={(e) => handleChange('securityDeposit', e.target.value)}
            />
            <Input
              label="Bedrooms"
              type="number"
              min="0"
              required
              value={formData.bedrooms}
              onChange={(e) => handleChange('bedrooms', e.target.value)}
            />
            <Input
              label="Bathrooms"
              type="number"
              min="0"
              required
              value={formData.bathrooms}
              onChange={(e) => handleChange('bathrooms', e.target.value)}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">Features & Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Select
              label="Property Type"
              required
              value={formData.propertyType}
              onChange={(e) => handleChange('propertyType', e.target.value)}
              options={[
                { label: 'Apartment', value: 'APARTMENT' },
                { label: 'House', value: 'HOUSE' },
                { label: 'Room', value: 'ROOM' },
                { label: 'PG', value: 'PG' },
                { label: 'Studio', value: 'STUDIO' },
              ]}
            />
            <Select
              label="Furnishing Status"
              required
              value={formData.furnishedStatus}
              onChange={(e) => handleChange('furnishedStatus', e.target.value)}
              options={[
                { label: 'Furnished', value: 'FURNISHED' },
                { label: 'Semi-Furnished', value: 'SEMI_FURNISHED' },
                { label: 'Unfurnished', value: 'UNFURNISHED' },
              ]}
            />
            <Select
              label="Availability"
              required
              value={formData.isAvailable}
              onChange={(e) => handleChange('isAvailable', e.target.value)}
              options={[
                { label: 'Available to Rent', value: 'true' },
                { label: 'Currently Rented / Unavailable', value: 'false' },
              ]}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-border flex justify-end gap-4">
          <Link href="/owner">
            <Button variant="ghost" type="button" disabled={loading}>Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Property'}
          </Button>
        </div>
      </form>
    </div>
  );
};
