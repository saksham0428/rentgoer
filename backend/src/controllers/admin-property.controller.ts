import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const listProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isVerified, isAvailable, propertyType, search, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PropertyWhereInput = {};
    
    if (isVerified === 'true') {
      where.isVerified = true;
    } else if (isVerified === 'false') {
      where.isVerified = false;
    }

    if (isAvailable === 'true') {
      where.isAvailable = true;
    } else if (isAvailable === 'false') {
      where.isAvailable = false;
    }

    if (propertyType && propertyType !== 'ALL') {
      where.propertyType = propertyType as any;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { locality: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { name: true, email: true, isVerified: true } },
          images: { take: 1 }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List admin properties error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getPropertyDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const property = await prisma.property.findUnique({
      where: { id: id as string },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isVerified: true,
            role: true
          }
        },
        images: true,
        _count: {
          select: {
            rentalRequests: true,
            reviews: true
          }
        }
      }
    });

    if (!property) {
      res.status(404).json({ message: 'Property not found.' });
      return;
    }

    // efficiently check if there are open reports against this property
    const openReportsCount = await prisma.report.count({
      where: { targetType: 'PROPERTY', targetId: property.id, status: 'OPEN' }
    });

    res.status(200).json({ 
      success: true, 
      data: {
        ...property,
        openReportsCount
      } 
    });
  } catch (error) {
    console.error('Get admin property detail error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
