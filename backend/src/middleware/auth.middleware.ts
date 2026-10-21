import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';
import { getLegacyCutoffDate } from '../config/auth.config';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies?.rentgoer_token;

  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthenticated. No token provided.' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('Authentication configuration error: JWT_SECRET is not configured');
    res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable.' });
    return;
  }

  let decoded: {
    id: string;
    role: Role;
    tokenVersion?: number;
    sessionId?: string;
    exp?: number;
  };

  try {
    decoded = jwt.verify(token, secret) as typeof decoded;
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Unauthenticated. Token expired.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Unauthenticated. Invalid token.' });
    return;
  }

  // Branch A: Session-aware token (contains sessionId claim)
  if ('sessionId' in decoded) {
    if (typeof decoded.sessionId !== 'string' || !decoded.sessionId.trim()) {
      res.status(401).json({ success: false, message: 'Unauthenticated. Invalid session token format.' });
      return;
    }

    try {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              tokenVersion: true,
            },
          },
        },
      });

      if (!session || !session.user) {
        res.status(401).json({ success: false, message: 'Unauthenticated. Session not found.' });
        return;
      }

      if (session.userId !== decoded.id) {
        res.status(401).json({ success: false, message: 'Unauthenticated. Session user mismatch.' });
        return;
      }

      if (session.revokedAt !== null) {
        res.status(401).json({ success: false, message: 'Unauthenticated. Session has been revoked.' });
        return;
      }

      if (session.expiresAt <= new Date()) {
        res.status(401).json({ success: false, message: 'Unauthenticated. Session expired.' });
        return;
      }

      if (typeof decoded.tokenVersion !== 'number' || decoded.tokenVersion !== session.user.tokenVersion) {
        res.status(401).json({ success: false, message: 'Unauthenticated. Session revoked or expired.' });
        return;
      }

      req.user = {
        id: session.user.id,
        role: session.user.role,
      };
      req.sessionId = session.id;

      next();
      return;
    } catch (error: any) {
      console.error('Authentication database failure during session verification:', error);
      res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable.' });
      return;
    }
  }

  // Branch B: Legacy token without sessionId claim
  let cutoffDate: Date;
  try {
    cutoffDate = getLegacyCutoffDate();
  } catch (configError: any) {
    console.error('Configuration error during legacy token evaluation:', configError);
    res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable.' });
    return;
  }

  // After the configured cutoff, reject legacy tokens immediately without querying the database
  if (Date.now() >= cutoffDate.getTime()) {
    res.status(401).json({
      success: false,
      message: 'Unauthenticated. Legacy session format expired. Please log in again.',
    });
    return;
  }

  // Within grace period: evaluate legacy token against RevokedLegacyToken and User records
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [revocationRecord, user] = await Promise.all([
      prisma.revokedLegacyToken.findUnique({
        where: { tokenHash },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          role: true,
          tokenVersion: true,
        },
      }),
    ]);

    if (revocationRecord) {
      res.status(401).json({ success: false, message: 'Unauthenticated. Session has been revoked.' });
      return;
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthenticated. User not found.' });
      return;
    }

    if (typeof decoded.tokenVersion !== 'number' || decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ success: false, message: 'Unauthenticated. Session revoked or expired.' });
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
    };
    req.sessionId = undefined;

    next();
  } catch (error: any) {
    console.error('Authentication database failure during legacy verification:', error);
    res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable.' });
  }
};
