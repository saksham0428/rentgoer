import { Router } from 'express';
import { createReport } from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/:id/report', authMiddleware, (req, res, next) => {
  req.params.targetType = 'USER';
  next();
}, createReport);

export default router;
