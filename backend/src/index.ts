import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import favoriteRoutes from './routes/favorite.routes';
import rentalRequestRoutes from './routes/rental-request.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notification.routes';
import reviewRoutes from './routes/review.routes';
import reportRoutes from './routes/report.routes';
import adminReportRoutes from './routes/admin-report.routes';
import verificationRoutes from './routes/verification.routes';
import adminVerificationRoutes from './routes/admin-verification.routes';
import adminStatsRoutes from './routes/admin-stats.routes';
import adminUserRoutes from './routes/admin-user.routes';
import adminPropertyRoutes from './routes/admin-property.routes';
import userRoutes from './routes/user.routes';
import messageRoutes from './routes/message.routes';


import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;




const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// 1. HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS Hardening
app.use(cors({
  origin: frontendUrl,
  credentials: true,
}));

// 3. General API Rate Limiting (1000 requests per 15 mins)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '1000'),
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// 4. Request Body Limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Cookie Parser
app.use(cookieParser());

// 6. Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/rental-requests', rentalRequestRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/admin/verification', adminVerificationRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/properties', adminPropertyRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Health Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running successfully' });
});

// 7. Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
