import { applyTestEnvironment } from './test-db-guard';

// 1. Fail-closed test environment setup:
// Strictly overrides process.env before ANY application module is evaluated.
// Guarantees that DATABASE_URL is loaded from .env.test.local and strictly targets local rentgoer_test.
applyTestEnvironment();

// 2. Set test-safe environment configuration
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.TEST_PORT || '5001';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3100';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-rentgoer-guarded-test-environment-min-32-chars';
}
if (!process.env.LEGACY_TOKEN_CUTOFF_DATE) {
  process.env.LEGACY_TOKEN_CUTOFF_DATE = '2030-01-01T00:00:00.000Z';
}
process.env.ENABLE_SESSION_ISSUANCE = 'true';

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRoutes from '../../src/routes/auth.routes';
import propertyRoutes from '../../src/routes/property.routes';
import favoriteRoutes from '../../src/routes/favorite.routes';
import rentalRequestRoutes from '../../src/routes/rental-request.routes';
import chatRoutes from '../../src/routes/chat.routes';
import notificationRoutes from '../../src/routes/notification.routes';
import reviewRoutes from '../../src/routes/review.routes';
import reportRoutes from '../../src/routes/report.routes';
import adminReportRoutes from '../../src/routes/admin-report.routes';
import verificationRoutes from '../../src/routes/verification.routes';
import adminVerificationRoutes from '../../src/routes/admin-verification.routes';
import adminStatsRoutes from '../../src/routes/admin-stats.routes';
import adminUserRoutes from '../../src/routes/admin-user.routes';
import adminPropertyRoutes from '../../src/routes/admin-property.routes';
import userRoutes from '../../src/routes/user.routes';
import messageRoutes from '../../src/routes/message.routes';

import { errorHandler } from '../../src/middleware/error.middleware';
import { prisma } from '../../src/lib/prisma';
import { validateAuthConfigAtStartup } from '../../src/config/auth.config';
import { assertTestDatabaseSafety, ScopedTestContext } from './test-db-context';

async function bootstrap() {
  // 3. Validate auth configuration
  validateAuthConfigAtStartup();

  // 4. Runtime database identity safety check before accepting any connection
  console.log('[TEST-BACKEND] Performing runtime database identity safety check...');
  const dbSafety = await assertTestDatabaseSafety(prisma);
  console.log(
    `[TEST-BACKEND] Database safety verified successfully: database="${dbSafety.currentDatabase}", host="${dbSafety.serverAddr}", user="${dbSafety.currentUser}".`
  );

  const app = express();
  const PORT = Number(process.env.PORT) || 5001;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';

  // Security headers & CORS
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: [frontendUrl, 'http://localhost:3100', 'http://127.0.0.1:3100'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Mount application routes
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

  // Health endpoint
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        mode: 'test',
        database: dbSafety.currentDatabase,
        message: 'Guarded test backend is running successfully against rentgoer_test',
      });
    } catch (error) {
      res.status(503).json({ status: 'error', message: 'Database connection failed' });
    }
  });

  // Guarded scoped test cleanup endpoint (only available in test-server against verified test DB)
  const scopedContext = new ScopedTestContext(prisma);
  app.post('/api/test/cleanup', async (req: Request, res: Response) => {
    try {
      const { userIds, propertyIds, rentalRequestIds, conversationIds } = req.body;
      if (Array.isArray(userIds)) userIds.forEach((id: string) => scopedContext.trackUser(id));
      if (Array.isArray(propertyIds)) propertyIds.forEach((id: string) => scopedContext.trackProperty(id));
      if (Array.isArray(rentalRequestIds)) rentalRequestIds.forEach((id: string) => scopedContext.trackRentalRequest(id));
      if (Array.isArray(conversationIds)) conversationIds.forEach((id: string) => scopedContext.trackConversation(id));

      await scopedContext.cleanup();
      res.status(200).json({ success: true, message: 'Scoped test entities cleaned up successfully' });
    } catch (err: any) {
      console.error('[TEST-BACKEND] Cleanup error:', err);
      res.status(500).json({ success: false, message: 'Cleanup failed' });
    }
  });

  // Global Error Handler
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    console.log(`[TEST-BACKEND] Guarded test backend server listening on port ${PORT}`);
  });

  // Deterministic shutdown handlers
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[TEST-BACKEND] Received ${signal}. Shutting down guarded test server...`);
    server.close(async () => {
      try {
        await scopedContext.cleanup();
        await prisma.$disconnect();
        console.log('[TEST-BACKEND] Database disconnected. Guarded test server shut down cleanly.');
      } catch (e) {
        console.error('[TEST-BACKEND] Error during shutdown:', e);
      } finally {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[TEST-BACKEND] FATAL STARTUP ERROR: Could not start guarded test server:', err);
  process.exit(1);
});
