import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// 1. Mocks for Prisma and Supabase (Zero Real Database or Cloud Network Activity)
// ---------------------------------------------------------------------------
const {
  mockPropertyFindUnique,
  mockPropertyImageCount,
  mockPropertyImageCreate,
  mockTransaction,
  mockUpload,
  mockRemove,
  mockGetPublicUrl,
} = vi.hoisted(() => ({
  mockPropertyFindUnique: vi.fn(),
  mockPropertyImageCount: vi.fn(),
  mockPropertyImageCreate: vi.fn(),
  mockTransaction: vi.fn().mockImplementation((ops: any) => Promise.all(ops)),
  mockUpload: vi.fn(),
  mockRemove: vi.fn(),
  mockGetPublicUrl: vi.fn().mockImplementation((path: string) => ({
    data: { publicUrl: `https://mock.storage.test/${path}` },
  })),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    property: {
      findUnique: mockPropertyFindUnique,
    },
    propertyImage: {
      count: mockPropertyImageCount,
      create: mockPropertyImageCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('../../src/config/supabase', () => ({
  SUPABASE_STORAGE_BUCKET: 'property-images',
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        remove: mockRemove,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  },
}));

import { uploadImages } from '../../src/controllers/property-image.controller';
import {
  validateImageContent,
  detectMagicBytes,
  MAX_IMAGE_DIMENSION,
  MAX_FILE_SIZE_BYTES,
} from '../../src/lib/image-validator';

// ---------------------------------------------------------------------------
// 2. Helpers to create mock Express Req/Res and genuine test image buffers
// ---------------------------------------------------------------------------
function createMockReqRes(options: {
  userId?: string;
  propertyId?: string;
  files?: Array<{ buffer: Buffer; mimetype: string; originalname?: string }>;
}) {
  const req: Partial<Request> = {
    user: options.userId ? ({ id: options.userId } as any) : undefined,
    params: { id: options.propertyId || 'prop-123' },
    files: (options.files as any) || [],
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: Partial<Response> = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(data: any) {
      responseData = data;
      return this as Response;
    },
  };

  return {
    req: req as Request,
    res: res as Response,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

// Generate genuine raster buffers deterministically via sharp
async function getValidJpegBuffer(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
}

async function getValidPngBuffer(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function getValidWebpBuffer(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .webp()
    .toBuffer();
}

describe('SEC-01: Property Image Upload & Content Validation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Section A: Direct Image Validator Unit Tests (image-validator.ts)
  // =========================================================================
  describe('Image Content Validator (validateImageContent)', () => {
    it('1. validates a genuine JPEG image and derives canonical jpg / image/jpeg', async () => {
      const buffer = await getValidJpegBuffer(120, 80);
      const result = await validateImageContent(buffer, 'image/jpeg');

      expect(result.format).toBe('jpeg');
      expect(result.extension).toBe('jpg');
      expect(result.contentType).toBe('image/jpeg');
      expect(result.width).toBe(120);
      expect(result.height).toBe(80);
      expect(result.size).toBe(buffer.length);
    });

    it('2. validates a genuine PNG image and derives canonical png / image/png', async () => {
      const buffer = await getValidPngBuffer(50, 50);
      const result = await validateImageContent(buffer, 'image/png');

      expect(result.format).toBe('png');
      expect(result.extension).toBe('png');
      expect(result.contentType).toBe('image/png');
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
    });

    it('3. validates a genuine WebP image and derives canonical webp / image/webp', async () => {
      const buffer = await getValidWebpBuffer(64, 64);
      const result = await validateImageContent(buffer, 'image/webp');

      expect(result.format).toBe('webp');
      expect(result.extension).toBe('webp');
      expect(result.contentType).toBe('image/webp');
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('4. rejects a plain text file disguised with Content-Type: image/jpeg', async () => {
      const fakeBuffer = Buffer.from('Hello world this is not an image');
      expect(detectMagicBytes(fakeBuffer)).toBeNull();

      await expect(validateImageContent(fakeBuffer, 'image/jpeg')).rejects.toThrow(
        /Only JPEG, PNG, and WebP raster images are allowed/i
      );
    });

    it('5. rejects an HTML file disguised with Content-Type: image/jpeg', async () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
      expect(detectMagicBytes(htmlBuffer)).toBeNull();

      await expect(validateImageContent(htmlBuffer, 'image/jpeg')).rejects.toThrow(
        /Only JPEG, PNG, and WebP raster images are allowed/i
      );
    });

    it('6. rejects an SVG file disguised with Content-Type: image/png', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>');
      expect(detectMagicBytes(svgBuffer)).toBeNull();

      await expect(validateImageContent(svgBuffer, 'image/png')).rejects.toThrow(
        /Only JPEG, PNG, and WebP raster images are allowed/i
      );
    });

    it('7. rejects upload when client-supplied MIME type disagrees with actual format (PNG vs image/jpeg)', async () => {
      const pngBuffer = await getValidPngBuffer();
      // Client claims it is a JPEG, but file bytes are PNG
      await expect(validateImageContent(pngBuffer, 'image/jpeg')).rejects.toThrow(
        /does not agree with detected format \(PNG\)/i
      );
    });

    it('8. rejects upload when client-supplied MIME type disagrees with actual format (JPEG vs image/png)', async () => {
      const jpegBuffer = await getValidJpegBuffer();
      // Client claims it is a PNG, but file bytes are JPEG
      await expect(validateImageContent(jpegBuffer, 'image/png')).rejects.toThrow(
        /does not agree with detected format \(JPEG\)/i
      );
    });

    it('9. rejects truncated or corrupted image content that starts with valid magic bytes', async () => {
      // JPEG magic bytes (FF D8 FF E0) followed by truncated garbage
      const truncatedBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x00]);
      expect(detectMagicBytes(truncatedBuffer)).toBe('jpeg');

      await expect(validateImageContent(truncatedBuffer, 'image/jpeg')).rejects.toThrow(
        /Malformed or truncated image content/i
      );
    });

    it('10. rejects empty buffers', async () => {
      await expect(validateImageContent(Buffer.alloc(0), 'image/jpeg')).rejects.toThrow(
        /Image file is empty/i
      );
    });

    it('11. rejects oversized image pixel dimensions (decompression bomb protection)', async () => {
      // Create metadata mocking or buffer exceeding MAX_IMAGE_DIMENSION
      const excessiveBuffer = await sharp({
        create: {
          width: MAX_IMAGE_DIMENSION + 1,
          height: 10,
          channels: 3,
          background: 'blue',
        },
      })
        .jpeg()
        .toBuffer();

      await expect(validateImageContent(excessiveBuffer, 'image/jpeg')).rejects.toThrow(
        /exceed the maximum allowed limit/i
      );
    });

    it('12. rejects oversized file byte length (> 5 MB)', async () => {
      // Allocate buffer 1 byte larger than 5 MB
      const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
      // Even if starts with valid JPEG magic bytes
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      await expect(validateImageContent(oversizedBuffer, 'image/jpeg')).rejects.toThrow(
        /exceeds the maximum allowed size of 5 MB/i
      );
    });
  });

  // =========================================================================
  // Section B: Property Image Controller Tests (uploadImages)
  // =========================================================================
  describe('Property Image Upload Controller (uploadImages)', () => {
    const ownerId = 'owner-uuid-1';
    const propertyId = 'property-uuid-100';

    it('12. rejects unauthenticated requests with 401', async () => {
      const { req, res, getStatus } = createMockReqRes({
        userId: undefined,
        propertyId,
        files: [{ buffer: await getValidJpegBuffer(), mimetype: 'image/jpeg' }],
      });

      await uploadImages(req, res);
      expect(getStatus()).toBe(401);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('13. rejects request when no files are provided with 400', async () => {
      const { req, res, getStatus } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [],
      });

      await uploadImages(req, res);
      expect(getStatus()).toBe(400);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('14. rejects request with 404 if property does not exist', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce(null);

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: await getValidJpegBuffer(), mimetype: 'image/jpeg' }],
      });

      await uploadImages(req, res);
      expect(getStatus()).toBe(404);
      expect(getData().message).toMatch(/Property not found/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('15. rejects request with 403 if user is not the property owner', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({
        id: propertyId,
        ownerId: 'different-owner-999',
      });

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: await getValidJpegBuffer(), mimetype: 'image/jpeg' }],
      });

      await uploadImages(req, res);
      expect(getStatus()).toBe(403);
      expect(getData().message).toMatch(/Forbidden/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('16. rejects request with 400 if property image count limit (10) would be exceeded', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(10); // already at limit

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: await getValidJpegBuffer(), mimetype: 'image/jpeg' }],
      });

      await uploadImages(req, res);
      expect(getStatus()).toBe(400);
      expect(getData().message).toMatch(/limit exceeded/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('17. rejects disguised text file with 400 and NEVER touches Supabase Storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);

      const disguisedText = Buffer.from('Plain text disguised as image');
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: disguisedText, mimetype: 'image/jpeg', originalname: 'evil.jpg' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(400);
      expect(getData().message).toMatch(/Only JPEG, PNG, and WebP/i);
      // CRITICAL: Ensure rejected file never reached Supabase Storage
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('18. rejects disguised HTML file with 400 and NEVER touches Supabase Storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);

      const disguisedHtml = Buffer.from('<html><body><script>malicious()</script></body></html>');
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: disguisedHtml, mimetype: 'image/jpeg', originalname: 'attack.jpeg' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(400);
      expect(getData().message).toMatch(/Only JPEG, PNG, and WebP/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('19. rejects disguised SVG file with 400 and NEVER touches Supabase Storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);

      const disguisedSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>SVG</text></svg>');
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: disguisedSvg, mimetype: 'image/png', originalname: 'diagram.png' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(400);
      expect(getData().message).toMatch(/Only JPEG, PNG, and WebP/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('20. rejects batch upload where one file is valid and one is disguised text, aborting before ANY storage call', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);

      const validPng = await getValidPngBuffer();
      const disguisedText = Buffer.from('malicious payload disguised as webp');

      const { req, res, getStatus } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [
          { buffer: validPng, mimetype: 'image/png', originalname: 'good.png' },
          { buffer: disguisedText, mimetype: 'image/webp', originalname: 'bad.webp' },
        ],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(400);
      // All-or-nothing: zero storage uploads should occur even for the valid file
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('21. successfully uploads valid JPEG: uses canonical .jpg and image/jpeg for Supabase storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);
      mockUpload.mockResolvedValueOnce({ data: { path: 'uploaded-path' }, error: null });
      mockPropertyImageCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'img-1', ...data }));

      const jpegBuffer = await getValidJpegBuffer();
      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: jpegBuffer, mimetype: 'image/jpeg', originalname: 'photo.JPEG' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(201);
      expect(getData().success).toBe(true);

      // Verify Supabase upload parameters
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [storagePath, , options] = mockUpload.mock.calls[0];
      expect(storagePath).toMatch(new RegExp(`^properties/${propertyId}/[0-9a-f-]+\\.jpg$`));
      expect(options.contentType).toBe('image/jpeg');
    });

    it('22. successfully uploads valid PNG: uses canonical .png and image/png for Supabase storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);
      mockUpload.mockResolvedValueOnce({ data: { path: 'uploaded-path' }, error: null });
      mockPropertyImageCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'img-2', ...data }));

      const pngBuffer = await getValidPngBuffer();
      const { req, res, getStatus } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: pngBuffer, mimetype: 'image/png', originalname: 'photo.png' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(201);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [storagePath, , options] = mockUpload.mock.calls[0];
      expect(storagePath).toMatch(new RegExp(`^properties/${propertyId}/[0-9a-f-]+\\.png$`));
      expect(options.contentType).toBe('image/png');
    });

    it('23. successfully uploads valid WebP: uses canonical .webp and image/webp for Supabase storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);
      mockUpload.mockResolvedValueOnce({ data: { path: 'uploaded-path' }, error: null });
      mockPropertyImageCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'img-3', ...data }));

      const webpBuffer = await getValidWebpBuffer();
      const { req, res, getStatus } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: webpBuffer, mimetype: 'image/webp', originalname: 'photo.webp' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(201);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [storagePath, , options] = mockUpload.mock.calls[0];
      expect(storagePath).toMatch(new RegExp(`^properties/${propertyId}/[0-9a-f-]+\\.webp$`));
      expect(options.contentType).toBe('image/webp');
    });

    it('24. rejects upload with 400 when file size exceeds 5MB and NEVER touches Supabase Storage', async () => {
      mockPropertyFindUnique.mockResolvedValueOnce({ id: propertyId, ownerId });
      mockPropertyImageCount.mockResolvedValueOnce(0);

      const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 100);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      const { req, res, getStatus, getData } = createMockReqRes({
        userId: ownerId,
        propertyId,
        files: [{ buffer: oversizedBuffer, mimetype: 'image/jpeg', originalname: 'huge.jpg' }],
      });

      await uploadImages(req, res);

      expect(getStatus()).toBe(400);
      expect(getData().message).toMatch(/exceeds the maximum allowed size of 5 MB/i);
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });
});
