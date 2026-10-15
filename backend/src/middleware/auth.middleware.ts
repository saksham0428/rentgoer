import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies.rentgoer_token;
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Unauthenticated. No token provided.' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as { id: string; role: Role; tokenVersion?: number };

    // Query authoritative tokenVersion from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthenticated. User not found.' });
      return;
    }

    // Reject tokens that have a missing or stale tokenVersion
    if (typeof decoded.tokenVersion !== 'number' || decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ success: false, message: 'Unauthenticated. Session revoked or expired.' });
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Unauthenticated. Invalid token.' });
  }
};
