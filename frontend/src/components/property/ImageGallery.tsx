'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { getDeterministicFallbackImage } from '@/lib/property-images';

interface ImageGalleryProps {
  images?: { url: string; id?: string }[] | null;
  title: string;
}

export const ImageGallery = ({ images, title }: ImageGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<Record<number, boolean>>({});

  const fallback = getDeterministicFallbackImage(title);
  const hasImages = Array.isArray(images) && images.length > 0;

  if (!hasImages) {
    return (
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/10] bg-stone-900 rounded-2xl overflow-hidden shadow-sm border border-border">
        <Image
          src={fallback.url}
          alt={`${title} - Representative property photography`}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1280px) 100vw, 1280px"
        />
        <div className="absolute bottom-4 left-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-900/85 text-stone-100 backdrop-blur-xs border border-white/10 shadow-sm">
            <Camera className="h-3.5 w-3.5 text-stone-300" />
            Illustrative representative photography (Owner has not uploaded photos yet)
          </span>
        </div>
      </div>
    );
  }

  const validImages = images;
  const currentImage = validImages[activeIndex];
  const isCurrentFailed = failedIndices[activeIndex];
  const displayUrl = isCurrentFailed ? fallback.url : (currentImage?.url || fallback.url);

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image Stage */}
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/10] bg-stone-900 rounded-2xl overflow-hidden group shadow-sm border border-border">
        <Image
          src={displayUrl}
          alt={`${title} - Image ${activeIndex + 1}`}
          fill
          priority
          className="object-cover transition-opacity duration-300"
          sizes="(max-width: 1280px) 100vw, 1280px"
          onError={() => {
            setFailedIndices((prev) => ({ ...prev, [activeIndex]: true }));
          }}
        />

        {/* Illustrative badge if current image failed */}
        {isCurrentFailed && (
          <div className="absolute bottom-4 left-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-900/85 text-stone-100 backdrop-blur-xs border border-white/10 shadow-sm">
              <Camera className="h-3.5 w-3.5 text-stone-300" />
              Illustrative fallback
            </span>
          </div>
        )}

        {/* Counter Badge */}
        <div className="absolute bottom-4 right-4 bg-stone-900/80 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 border border-white/10 shadow-xs">
          {activeIndex + 1} / {validImages.length}
        </div>

        {validImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1))}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-stone-900 p-2.5 rounded-full shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary z-10 cursor-pointer active:scale-95"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0))}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-stone-900 p-2.5 rounded-full shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary z-10 cursor-pointer active:scale-95"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {validImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide py-1">
          {validImages.map((img, idx) => {
            const isFailed = failedIndices[idx];
            const thumbUrl = isFailed ? fallback.url : (img.url || fallback.url);

            return (
              <button
                key={img.id || idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  activeIndex === idx
                    ? 'border-primary ring-2 ring-primary/20 shadow-xs scale-102'
                    : 'border-transparent opacity-60 hover:opacity-100'
                } focus:outline-none focus:border-primary`}
                aria-label={`View photo ${idx + 1}`}
              >
                <Image
                  src={thumbUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
