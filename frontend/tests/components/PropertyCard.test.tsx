import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyCard } from '@/components/ui/PropertyCard';

// Mock FavoriteButton to decouple PropertyCard unit tests from Auth & Favorites contexts
vi.mock('@/components/property/FavoriteButton', () => ({
  FavoriteButton: ({ propertyId }: { propertyId: string }) => (
    <button data-testid={`favorite-button-${propertyId}`}>Favorite</button>
  ),
}));

const mockProperty = {
  id: 'prop-101',
  title: 'Luxury 2BHK Apartment',
  city: 'Bengaluru',
  locality: 'Indiranagar',
  rent: 35000,
  bedrooms: 2,
  bathrooms: 2,
  propertyType: 'APARTMENT',
  furnishedStatus: 'FULLY_FURNISHED',
  isAvailable: true,
  images: [{ url: 'https://images.example.com/prop-101.jpg' }],
  hideFavorite: false,
  averageRating: 4.8,
  reviewCount: 15,
  isVerified: true,
};

describe('PropertyCard component', () => {
  it('renders property title, locality, city, bedrooms, and bathrooms', () => {
    render(<PropertyCard {...mockProperty} />);

    expect(screen.getByText('Luxury 2BHK Apartment')).toBeInTheDocument();
    expect(screen.getByText('Indiranagar, Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('2 Beds')).toBeInTheDocument();
    expect(screen.getByText('2 Baths')).toBeInTheDocument();
  });

  it('formats property type and furnishing status tags', () => {
    render(<PropertyCard {...mockProperty} />);

    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.getByText('Fully Furnished')).toBeInTheDocument();
  });

  it('formats rent amount in Indian Rupees', () => {
    render(<PropertyCard {...mockProperty} rent={35000} />);

    // RentGoer formats with INR currency format (e.g. ₹35,000/mo)
    const rentElement = screen.getByText(/\/mo/i).closest('p');
    expect(rentElement).toHaveTextContent(/35,000/);
  });

  it('links to the detailed property page', () => {
    render(<PropertyCard {...mockProperty} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/properties/prop-101');
  });

  it('renders property image when available', () => {
    render(<PropertyCard {...mockProperty} />);

    const img = screen.getByRole('img', { name: 'Luxury 2BHK Apartment' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://images.example.com/prop-101.jpg');
  });

  it('renders fallback when no images are provided', () => {
    render(<PropertyCard {...mockProperty} images={[]} />);

    expect(screen.getByText('No image available')).toBeInTheDocument();
  });

  it('renders verified badge when isVerified is true', () => {
    const { container } = render(<PropertyCard {...mockProperty} isVerified={true} />);
    // BadgeCheck renders an SVG with text-blue-500
    const badge = container.querySelector('.text-blue-500');
    expect(badge).toBeInTheDocument();
  });

  it('renders RENTED banner when property is not available', () => {
    render(<PropertyCard {...mockProperty} isAvailable={false} />);

    expect(screen.getByText('RENTED')).toBeInTheDocument();
  });

  it('displays ratings and review count when reviews exist', () => {
    render(<PropertyCard {...mockProperty} averageRating={4.5} reviewCount={8} />);

    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(8)')).toBeInTheDocument();
  });

  it('renders favorite button when hideFavorite is false, and hides it when true', () => {
    const { rerender } = render(<PropertyCard {...mockProperty} hideFavorite={false} />);
    expect(screen.getByTestId('favorite-button-prop-101')).toBeInTheDocument();

    rerender(<PropertyCard {...mockProperty} hideFavorite={true} />);
    expect(screen.queryByTestId('favorite-button-prop-101')).not.toBeInTheDocument();
  });
});
