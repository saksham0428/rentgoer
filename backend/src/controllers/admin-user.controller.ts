import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, isVerified, search, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.UserWhereInput = {};
    if (role && role !== 'ALL') {
      where.role = role as any;
    }
    if (isVerified === 'true') {
      where.isVerified = true;
    } else if (isVerified === 'false') {
      where.isVerified = false;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: { properties: true, rentalRequests: true }
          }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: users.map(u => ({ ...u, propertyCount: u._count.properties, requestCount: u._count.rentalRequests })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List admin users error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            properties: true,
            rentalRequests: true,
            tenantReviews: true,
            reports: true
          }
        },
        properties: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, isAvailable: true, rent: true, city: true, isVerified: true }
        },
        rentalRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            property: { select: { id: true, title: true } }
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get admin user detail error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
