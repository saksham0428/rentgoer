import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { ImageGallery } from '@/components/property/ImageGallery';

// Mock FavoriteButton
vi.mock('@/components/property/FavoriteButton', () => ({
  FavoriteButton: () => <button>Favorite</button>,
}));

describe('Decorative Iconography Audit', () => {
  it('renders Camera icon and not Sparkles on PropertyCard fallback illustrative badge', () => {
    const { container } = render(
      <PropertyCard
        id="prop-1"
        title="2BHK in Koramangala"
        city="Bengaluru"
        locality="Koramangala"
        rent={30000}
        bedrooms={2}
        bathrooms={2}
        propertyType="APARTMENT"
        furnishedStatus="SEMI_FURNISHED"
        isAvailable={true}
        images={[]}
      />
    );

    const badge = screen.getByText('Illustrative image');
    expect(badge).toBeInTheDocument();

    // Verify Camera icon (lucide-camera) is present
    const cameraSvg = container.querySelector('svg.lucide-camera');
    expect(cameraSvg).toBeInTheDocument();

    // Verify Sparkles icon (lucide-sparkles) is NOT present
    const sparklesSvg = container.querySelector('svg.lucide-sparkles');
    expect(sparklesSvg).not.toBeInTheDocument();
  });

  it('renders Camera icon and not Sparkles on ImageGallery representative fallback photography', () => {
    const { container } = render(
      <ImageGallery images={[]} title="Modern Studio in HSR Layout" />
    );

    expect(
      screen.getByText(/Illustrative representative photography/)
    ).toBeInTheDocument();

    const cameraSvg = container.querySelector('svg.lucide-camera');
    expect(cameraSvg).toBeInTheDocument();

    const sparklesSvg = container.querySelector('svg.lucide-sparkles');
    expect(sparklesSvg).not.toBeInTheDocument();
  });
});
