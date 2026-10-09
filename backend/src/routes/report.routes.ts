import { Router } from 'express';
import { 
  createReport, 
  getMyReports
} from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// generic create report (targetType inferred from body)
router.post('/', authMiddleware, createReport);

// my reports
router.get('/me', authMiddleware, getMyReports);

export default router;
