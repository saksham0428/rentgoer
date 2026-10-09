import multer from 'multer';

// Use memory storage to process files directly into Supabase buffer without writing to disk
const storage = multer.memoryStorage();

// Supported MIME types mapped to extensions
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5, // 5 images per request
  },
  fileFilter: (req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});
