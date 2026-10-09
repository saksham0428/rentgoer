import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Strict Rate Limiting for Auth Endpoints (e.g. 50 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '50'),
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authLimiter, logout);

// getMe can use the general API limiter instead of the strict auth limiter, 
// since it's called on every page load/refresh by the frontend.
router.get('/me', authMiddleware, getMe);

export default router;
