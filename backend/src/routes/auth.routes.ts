import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  changeEmail
} from '../controllers/auth.controller';
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

// Dedicated Rate Limiting for Sensitive Account Modification Endpoints (15 requests per 15 mins)
const sensitiveAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.SENSITIVE_ACCOUNT_RATE_LIMIT_MAX || '15'),
  message: { success: false, message: 'Too many account update attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authLimiter, logout);

// getMe uses the general API limiter since it's called on page load/refresh
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, sensitiveAccountLimiter, changePassword);
router.put('/change-email', authMiddleware, sensitiveAccountLimiter, changeEmail);

export default router;
