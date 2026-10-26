import { describe, it, expect } from 'vitest';
import {
  FALLBACK_PROPERTY_IMAGES,
  getDeterministicFallbackImage,
  resolvePrimaryPropertyImage,
  hashStringSeed,
} from '@/lib/property-images';

describe('property-images helper module', () => {
  it('provides at least 4 distinct high-quality fallback assets', () => {
    expect(FALLBACK_PROPERTY_IMAGES.length).toBeGreaterThanOrEqual(4);
    const urls = FALLBACK_PROPERTY_IMAGES.map((img) => img.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(FALLBACK_PROPERTY_IMAGES.length);
  });

  it('computes deterministic hashes consistently for the same seed', () => {
    const hash1 = hashStringSeed('property-uuid-123');
    const hash2 = hashStringSeed('property-uuid-123');
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('number');
  });

  it('returns distinct fallbacks for different property IDs across the grid', () => {
    const fallbackA = getDeterministicFallbackImage('prop-1');
    const fallbackB = getDeterministicFallbackImage('prop-2');
    const fallbackC = getDeterministicFallbackImage('prop-3');
    const fallbackD = getDeterministicFallbackImage('prop-4');

    const urls = [fallbackA.url, fallbackB.url, fallbackC.url, fallbackD.url];
    // Check that we get variety among sequential or typical IDs
    const unique = new Set(urls);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('resolves primary uploaded image if available and valid', () => {
    const images = [{ url: 'https://images.example.com/uploaded-photo.jpg' }];
    const resolved = resolvePrimaryPropertyImage(images, 'prop-101');

    expect(resolved.url).toBe('https://images.example.com/uploaded-photo.jpg');
    expect(resolved.isFallback).toBe(false);
  });

  it('gracefully falls back when images array is empty or undefined', () => {
    const resolvedEmpty = resolvePrimaryPropertyImage([], 'prop-101');
    expect(resolvedEmpty.isFallback).toBe(true);
    expect(resolvedEmpty.url).toContain('/images/fallback-');

    const resolvedNull = resolvePrimaryPropertyImage(null, 'prop-102');
    expect(resolvedNull.isFallback).toBe(true);
    expect(resolvedNull.url).toContain('/images/fallback-');
  });

  it('gracefully ignores images with blank or whitespace-only URLs', () => {
    const malformedImages = [{ url: '' }, { url: '   ' }, { url: 'https://images.example.com/real.jpg' }];
    const resolved = resolvePrimaryPropertyImage(malformedImages, 'prop-103');

    expect(resolved.url).toBe('https://images.example.com/real.jpg');
    expect(resolved.isFallback).toBe(false);
  });
});
