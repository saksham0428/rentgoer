import sharp from 'sharp';

export interface ValidatedImage {
  format: 'jpeg' | 'png' | 'webp';
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  size: number;
}

export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

export const MAX_IMAGE_DIMENSION = 8192; // 8K maximum pixel width/height (protects against decompression bombs)
export const MIN_IMAGE_DIMENSION = 1;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit

/**
 * Checks magic bytes of the buffer for JPEG, PNG, or WebP.
 * Rejects non-raster files, SVG, HTML, scripts, etc. in O(1) time.
 */
export function detectMagicBytes(buffer: Buffer): AllowedFormat | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // 3. WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Validates actual image buffer content:
 * 1. Checks binary magic bytes.
 * 2. Fully decodes image headers and structures via sharp (rejecting malformed, truncated, SVG, HTML, or corrupted files).
 * 3. Enforces pixel-dimension limits (mitigating decompression bombs).
 * 4. Ensures client-supplied MIME type (if provided) strictly agrees with detected format.
 * 5. Derives canonical storage extension and Content-Type from validated content.
 */
export async function validateImageContent(
  buffer: Buffer,
  clientMimeType?: string
): Promise<ValidatedImage> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Image file is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image file exceeds the maximum allowed size of 5 MB.');
  }

  // 1. Fast Layer 1: Magic byte verification
  const magicFormat = detectMagicBytes(buffer);
  if (!magicFormat) {
    throw new Error('Invalid image format. Only JPEG, PNG, and WebP raster images are allowed.');
  }

  // 2. Deep Layer 2: Full decoding and dimension inspection with sharp
  let metadata: sharp.Metadata;
  try {
    const image = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    });
    metadata = await image.metadata();
  } catch {
    throw new Error('Malformed or truncated image content.');
  }

  const detectedFormat = metadata.format;
  if (!detectedFormat || !ALLOWED_FORMATS.includes(detectedFormat as AllowedFormat)) {
    throw new Error('Unsupported image format. Only JPEG, PNG, and WebP are allowed.');
  }

  // Ensure magic bytes and sharp metadata agree
  if (
    (magicFormat === 'jpeg' && detectedFormat !== 'jpeg') ||
    (magicFormat === 'png' && detectedFormat !== 'png') ||
    (magicFormat === 'webp' && detectedFormat !== 'webp')
  ) {
    throw new Error('Image signature and content metadata mismatch.');
  }

  // Dimension validation (decompression bomb protection)
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height || width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new Error('Invalid image dimensions.');
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions (${width}x${height}) exceed the maximum allowed limit of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`
    );
  }

  // Check client MIME disagreement if provided
  if (clientMimeType) {
    const normalizedClientMime = clientMimeType.toLowerCase().trim();
    const isJpegMime = normalizedClientMime === 'image/jpeg' || normalizedClientMime === 'image/jpg';
    const isPngMime = normalizedClientMime === 'image/png';
    const isWebpMime = normalizedClientMime === 'image/webp';

    if (detectedFormat === 'jpeg' && !isJpegMime) {
      throw new Error(`Client MIME type '${clientMimeType}' does not agree with detected format (JPEG).`);
    }
    if (detectedFormat === 'png' && !isPngMime) {
      throw new Error(`Client MIME type '${clientMimeType}' does not agree with detected format (PNG).`);
    }
    if (detectedFormat === 'webp' && !isWebpMime) {
      throw new Error(`Client MIME type '${clientMimeType}' does not agree with detected format (WebP).`);
    }
  }

  // Derive canonical extension and MIME type
  const extensionMap: Record<
    AllowedFormat,
    { ext: 'jpg' | 'png' | 'webp'; mime: 'image/jpeg' | 'image/png' | 'image/webp' }
  > = {
    jpeg: { ext: 'jpg', mime: 'image/jpeg' },
    png: { ext: 'png', mime: 'image/png' },
    webp: { ext: 'webp', mime: 'image/webp' },
  };

  const canonical = extensionMap[detectedFormat as AllowedFormat];

  return {
    format: detectedFormat as AllowedFormat,
    contentType: canonical.mime,
    extension: canonical.ext,
    width,
    height,
    size: buffer.length,
  };
}
