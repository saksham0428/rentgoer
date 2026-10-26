import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';
import { isSessionIssuanceEnabled } from '../config/auth.config';

const extractUserAgent = (req: Request): string | null => {
  const raw = req.headers['user-agent'];
  if (!raw) return null;
  return String(raw).slice(0, 500);
};

const extractIpAddress = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    if (first) return first.slice(0, 45);
  }
  const ip = req.ip || req.socket?.remoteAddress;
  return ip ? String(ip).slice(0, 45) : null;
};

const generateTokenAndSetCookie = (
  res: Response,
  userId: string,
  role: Role,
  tokenVersion: number,
  sessionId?: string
) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const payload: {
    id: string;
    role: Role;
    tokenVersion: number;
    sessionId?: string;
  } = { id: userId, role, tokenVersion };

  if (sessionId) {
    payload.sessionId = sessionId;
  }

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('rentgoer_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'All fields are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email format' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
      return;
    }

    if (role === 'ADMIN') {
      res.status(403).json({ success: false, message: 'Admin registration is not allowed' });
      return;
    }

    if (role !== 'TENANT' && role !== 'OWNER') {
      res.status(400).json({ success: false, message: 'Invalid role' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email is already in use' });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (and session if session issuance is enabled) atomically
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const userAgent = extractUserAgent(req);
    const ipAddress = extractIpAddress(req);
    const sessionEnabled = isSessionIssuanceEnabled();

    const { user, session } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: role as Role,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tokenVersion: true,
          createdAt: true,
        },
      });

      let newSession: { id: string } | null = null;
      if (sessionEnabled) {
        newSession = await tx.session.create({
          data: {
            userId: newUser.id,
            expiresAt: sessionExpiry,
            userAgent,
            ipAddress,
          },
          select: { id: true },
        });
      }

      return { user: newUser, session: newSession };
    });

    generateTokenAndSetCookie(
      res,
      user.id,
      user.role,
      user.tokenVersion,
      session ? session.id : undefined
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const userAgent = extractUserAgent(req);
    const ipAddress = extractIpAddress(req);
    const sessionEnabled = isSessionIssuanceEnabled();

    let session: { id: string } | null = null;
    if (sessionEnabled) {
      session = await prisma.session.create({
        data: {
          userId: user.id,
          expiresAt: sessionExpiry,
          userAgent,
          ipAddress,
        },
        select: { id: true },
      });
    }

    generateTokenAndSetCookie(
      res,
      user.id,
      user.role,
      user.tokenVersion,
      session ? session.id : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        bio: user.bio,
        preferredCity: user.preferredCity,
        monthlyBudget: user.monthlyBudget,
        moveInTimeline: user.moveInTimeline,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.rentgoer_token;
    if (token && typeof token === 'string') {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as {
            id?: string;
            role?: Role;
            tokenVersion?: number;
            sessionId?: string;
            exp?: number;
          };

          if (decoded && decoded.id) {
            if ('sessionId' in decoded) {
              if (typeof decoded.sessionId === 'string' && decoded.sessionId.trim()) {
                // Session-aware token: Revoke only this exact session, ensuring userId matches
                await prisma.session.updateMany({
                  where: {
                    id: decoded.sessionId,
                    userId: decoded.id,
                    revokedAt: null,
                  },
                  data: {
                    revokedAt: new Date(),
                  },
                });
              }
            } else if (decoded.exp && typeof decoded.exp === 'number') {
              // Legacy token without sessionId:
              // Hash raw token with SHA-256 (never store plaintext JWT)
              const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
              const expiresAt = new Date(decoded.exp * 1000);

              // Idempotent upsert to safely handle repeated/concurrent logouts
              await prisma.revokedLegacyToken.upsert({
                where: { tokenHash },
                update: {},
                create: {
                  tokenHash,
                  userId: decoded.id,
                  expiresAt,
                },
              });
            }
          }
        } catch {
          // If token verification fails (expired, malformed, invalid signature),
          // do NOT perform any database mutation. We fail safely and proceed to clear the cookie.
        }
      }
    }
  } catch (error) {
    console.error('Logout error during session revocation:', error);
    // Proceed to clear client cookie even if DB fails
  } finally {
    res.clearCookie('rentgoer_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        bio: true,
        preferredCity: true,
        monthlyBudget: true,
        moveInTimeline: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const { name, phone, bio, preferredCity, monthlyBudget, moveInTimeline } = req.body;

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      res.status(400).json({ success: false, message: 'Name must be between 2 and 60 characters' });
      return;
    }

    // Validate phone (optional)
    let sanitizedPhone: string | null = null;
    if (phone !== undefined && phone !== null && phone !== '') {
      if (typeof phone !== 'string') {
        res.status(400).json({ success: false, message: 'Invalid phone number format' });
        return;
      }
      const trimmedPhone = phone.trim();
      const phoneRegex = /^[+]?[0-9\s().-]{7,20}$/;
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (
        !phoneRegex.test(trimmedPhone) ||
        trimmedPhone.length < 7 ||
        trimmedPhone.length > 20 ||
        digitsOnly.length < 7 ||
        digitsOnly.length > 15
      ) {
        res.status(400).json({ success: false, message: 'Invalid phone number format' });
        return;
      }
      sanitizedPhone = trimmedPhone;
    }

    // Validate bio / renter introduction (optional)
    let sanitizedBio: string | null = null;
    if (bio !== undefined && bio !== null && bio !== '') {
      if (typeof bio !== 'string') {
        res.status(400).json({ success: false, message: 'Introduction must be a string' });
        return;
      }
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 500) {
        res.status(400).json({ success: false, message: 'Introduction cannot exceed 500 characters' });
        return;
      }
      sanitizedBio = trimmedBio.length > 0 ? trimmedBio : null;
    }

    // Validate preferredCity / locality (optional)
    let sanitizedPreferredCity: string | null = null;
    if (preferredCity !== undefined && preferredCity !== null && preferredCity !== '') {
      if (typeof preferredCity !== 'string') {
        res.status(400).json({ success: false, message: 'Preferred location must be a string' });
        return;
      }
      const trimmedCity = preferredCity.trim();
      if (trimmedCity.length < 2 || trimmedCity.length > 100) {
        res.status(400).json({ success: false, message: 'Preferred location must be between 2 and 100 characters' });
        return;
      }
      sanitizedPreferredCity = trimmedCity;
    }

    // Validate monthlyBudget (optional)
    let sanitizedMonthlyBudget: number | null = null;
    if (monthlyBudget !== undefined && monthlyBudget !== null && monthlyBudget !== '') {
      const numBudget = typeof monthlyBudget === 'number' ? monthlyBudget : Number(monthlyBudget);
      if (isNaN(numBudget) || !isFinite(numBudget) || numBudget <= 0 || numBudget > 10000000) {
        res.status(400).json({ success: false, message: 'Monthly budget must be a positive number up to 10,000,000' });
        return;
      }
      sanitizedMonthlyBudget = numBudget;
    }

    // Validate moveInTimeline (optional)
    const validTimelines = ['Immediately', 'Within one month', 'In 1–3 months', 'In 1-3 months', 'Flexible'];
    let sanitizedMoveInTimeline: string | null = null;
    if (moveInTimeline !== undefined && moveInTimeline !== null && moveInTimeline !== '') {
      if (typeof moveInTimeline !== 'string') {
        res.status(400).json({ success: false, message: 'Invalid move-in timeline' });
        return;
      }
      let trimmedTimeline = moveInTimeline.trim();
      if (trimmedTimeline === 'In 1-3 months') {
        trimmedTimeline = 'In 1–3 months';
      }
      if (!validTimelines.includes(trimmedTimeline)) {
        res.status(400).json({
          success: false,
          message: 'Move-in timeline must be one of: Immediately, Within one month, In 1–3 months, Flexible',
        });
        return;
      }
      sanitizedMoveInTimeline = trimmedTimeline;
    }

    // Update only allowed fields. Reject/ignore role, email, isVerified, passwordHash, id.
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        phone: sanitizedPhone,
        bio: sanitizedBio,
        preferredCity: sanitizedPreferredCity,
        monthlyBudget: sanitizedMonthlyBudget,
        moveInTimeline: sanitizedMoveInTimeline,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        bio: true,
        preferredCity: true,
        monthlyBudget: true,
        moveInTimeline: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, message: 'Current password, new password, and confirmation are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New password and confirmation do not match' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Atomically update password hash, increment tokenVersion, and revoke all active sessions for this user
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Invalidate the current browser's authentication cookie so re-login is required
    res.clearCookie('rentgoer_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const changeEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      res.status(400).json({ success: false, message: 'New email address and current password are required' });
      return;
    }

    if (typeof newEmail !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid request data' });
      return;
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
      res.status(400).json({ success: false, message: 'Invalid email address format' });
      return;
    }

    // Retrieve user record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (normalizedEmail === user.email.toLowerCase()) {
      res.status(400).json({ success: false, message: 'New email must be different from your current email' });
      return;
    }

    // Verify current password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // Check if new email is already in use by another account
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      res.status(409).json({ success: false, message: 'Email address is already in use by another account' });
      return;
    }

    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const userAgent = extractUserAgent(req);
    const ipAddress = extractIpAddress(req);
    const sessionEnabled = isSessionIssuanceEnabled();

    // Atomically invalidate old sessions, update email, increment tokenVersion, and create replacement session
    const { updatedUser, newSession } = await prisma.$transaction(async (tx) => {
      // 1. Invalidate all prior active sessions for this user
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 2. Update email and increment tokenVersion
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          email: normalizedEmail,
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          bio: true,
          preferredCity: true,
          monthlyBudget: true,
          moveInTimeline: true,
          isVerified: true,
          createdAt: true,
          tokenVersion: true,
        },
      });

      // 3. Create replacement session for the active client if session issuance is enabled
      let replacementSession: { id: string } | null = null;
      if (sessionEnabled) {
        replacementSession = await tx.session.create({
          data: {
            userId: user.id,
            expiresAt: sessionExpiry,
            userAgent,
            ipAddress,
          },
          select: { id: true },
        });
      }

      return { updatedUser: user, newSession: replacementSession };
    });

    // Re-issue cookie with updated tokenVersion (and new sessionId if Stage B)
    generateTokenAndSetCookie(
      res,
      updatedUser.id,
      updatedUser.role,
      updatedUser.tokenVersion,
      newSession ? newSession.id : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Email address successfully updated',
      user: updatedUser,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Email address is already in use by another account' });
      return;
    }
    console.error('Change email error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
