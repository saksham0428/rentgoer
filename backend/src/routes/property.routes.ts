import { Router } from 'express';
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getOwnerProperties,
} from '../controllers/property.controller';
import { uploadImages, deleteImage } from '../controllers/property-image.controller';
import { addFavorite, removeFavorite } from '../controllers/favorite.controller';
import { createRentalRequest } from '../controllers/rental-request.controller';
import { createReview, getPropertyReviews } from '../controllers/review.controller';
import { createReport } from '../controllers/report.controller';
import { createPropertyVerification } from '../controllers/verification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

// Protected OWNER routes
router.post('/:id/verification', authMiddleware, requireRole('OWNER'), createPropertyVerification);
router.get('/owner/me', authMiddleware, requireRole('OWNER'), getOwnerProperties);
router.post('/', authMiddleware, requireRole('OWNER'), createProperty);
router.put('/:id', authMiddleware, requireRole('OWNER'), updateProperty);
router.delete('/:id', authMiddleware, requireRole('OWNER'), deleteProperty);

// Protected TENANT routes for Property
router.post('/:id/favorite', authMiddleware, requireRole('TENANT'), addFavorite);
router.delete('/:id/favorite', authMiddleware, requireRole('TENANT'), removeFavorite);
router.post('/:id/rental-requests', authMiddleware, requireRole('TENANT'), createRentalRequest);
router.post('/:id/reviews', authMiddleware, requireRole('TENANT'), createReview);

// Report property (TENANT or OWNER)
router.post('/:id/report', authMiddleware, (req, res, next) => {
  req.params.targetType = 'PROPERTY';
  next();
}, createReport);

// Public routes (must be below specific paths to avoid parameter swallowing if any)
router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.get('/:id/reviews', getPropertyReviews);

// Image routes
router.post('/:id/images', authMiddleware, requireRole('OWNER'), (req, res, next) => {
  uploadMiddleware.array('images', 5)(req, res, (err) => {
    if (err) {
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: 'Too many files. Maximum 5 images per request.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, uploadImages);

router.delete('/:id/images/:imageId', authMiddleware, requireRole('OWNER'), deleteImage);

export default router;
