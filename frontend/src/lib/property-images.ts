/**
 * Property Photography and Fallback System for RentGoer.
 * Provides high-quality, deterministic representative photography
 * when properties have no uploaded images or when image loading fails.
 */

export interface FallbackImage {
  url: string;
  alt: string;
  label: string;
}

export const FALLBACK_PROPERTY_IMAGES: FallbackImage[] = [
  {
    url: '/images/fallback-apartment.jpg',
    alt: 'Representative modern residential apartment architecture with glass balconies and greenery',
    label: 'Modern Apartment',
  },
  {
    url: '/images/fallback-living.jpg',
    alt: 'Representative bright and airy apartment living room with contemporary furnishings',
    label: 'Living Space',
  },
  {
    url: '/images/fallback-bedroom.jpg',
    alt: 'Representative serene master bedroom with warm natural lighting and clean linens',
    label: 'Bedroom',
  },
  {
    url: '/images/fallback-kitchen.jpg',
    alt: 'Representative open-concept kitchen and island dining area with modern cabinetry',
    label: 'Kitchen & Dining',
  },
];

/**
 * Computes a deterministic integer hash from a string seed (e.g. property ID or title).
 */
export function hashStringSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a deterministic representative fallback image for a property.
 * If propertyType is known, it can hint the initial category, or seed ensures
 * distinct properties across the grid display different photos.
 */
export function getDeterministicFallbackImage(seed?: string, propertyType?: string): FallbackImage {
  if (!seed && !propertyType) {
    return FALLBACK_PROPERTY_IMAGES[0];
  }

  const compositeSeed = `${seed || ''}:${propertyType || ''}`;
  const hash = hashStringSeed(compositeSeed);
  const index = hash % FALLBACK_PROPERTY_IMAGES.length;
  return FALLBACK_PROPERTY_IMAGES[index];
}

/**
 * Resolves the primary image source for a property card.
 * Returns the first valid uploaded image URL if available, or the deterministic fallback.
 */
export function resolvePrimaryPropertyImage(
  images?: { url?: string | null }[] | null,
  seed?: string,
  propertyType?: string
): { url: string; isFallback: boolean; alt: string } {
  const validUploaded = images?.find(
    (img) => img && typeof img.url === 'string' && img.url.trim().length > 0
  );

  if (validUploaded?.url) {
    return {
      url: validUploaded.url.trim(),
      isFallback: false,
      alt: 'Property photograph',
    };
  }

  const fallback = getDeterministicFallbackImage(seed, propertyType);
  return {
    url: fallback.url,
    isFallback: true,
    alt: fallback.alt,
  };
}
