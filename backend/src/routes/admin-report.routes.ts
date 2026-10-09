import { Router } from 'express';
import { 
  getAdminReports, 
  getAdminReportById,
  updateAdminReportStatus
} from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// all routes require ADMIN
router.use(authMiddleware, requireRole('ADMIN'));

router.get('/', getAdminReports);
router.get('/:id', getAdminReportById);
router.put('/:id/status', updateAdminReportStatus);

export default router;
