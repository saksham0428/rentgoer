import { Router } from 'express';
import { 
  getMyRentalRequests, 
  cancelRentalRequest,
  getOwnerRequests,
  acceptRequest,
  rejectRequest,
  completeRequest
} from '../controllers/rental-request.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Protected TENANT routes
router.get('/me', authMiddleware, requireRole('TENANT'), getMyRentalRequests);
router.delete('/:id', authMiddleware, requireRole('TENANT'), cancelRentalRequest);

// Protected OWNER routes
router.get('/owner', authMiddleware, requireRole('OWNER'), getOwnerRequests);
router.post('/:id/accept', authMiddleware, requireRole('OWNER'), acceptRequest);
router.post('/:id/reject', authMiddleware, requireRole('OWNER'), rejectRequest);
router.post('/:id/complete', authMiddleware, requireRole('OWNER'), completeRequest);

export default router;
