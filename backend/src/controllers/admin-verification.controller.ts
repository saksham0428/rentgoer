import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const listVerifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.VerificationRequestWhereInput = {};
    if (type && (type === 'OWNER' || type === 'PROPERTY')) {
      where.type = type;
    }
    if (status && (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED')) {
      where.status = status;
    }

    const [total, requests] = await Promise.all([
      prisma.verificationRequest.count({ where }),
      prisma.verificationRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { submittedAt: 'desc' },
        include: {
          owner: {
            select: { id: true, name: true, email: true }
          },
          property: {
            select: { id: true, title: true, city: true, locality: true }
          }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List verifications error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getVerificationDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const request = await prisma.verificationRequest.findUnique({
      where: { id: id as string },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            isVerified: true,
            verifiedAt: true
          }
        },
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            city: true,
            locality: true,
            address: true,
            rent: true,
            propertyType: true,
            furnishedStatus: true,
            bedrooms: true,
            bathrooms: true,
            isAvailable: true,
            isVerified: true,
            verifiedAt: true,
            images: true
          }
        }
      }
    });

    if (!request) {
      res.status(404).json({ message: 'Verification request not found.' });
      return;
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Get verification detail error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const approveVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const adminId = req.user!.id;

    const request = await prisma.verificationRequest.findUnique({ where: { id: id as string } });

    if (!request) {
      res.status(404).json({ message: 'Verification request not found.' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(409).json({ message: 'Only PENDING requests can be approved.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update the request status
      await tx.verificationRequest.update({
        where: { id: id as string },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: adminId
        }
      });

      // 2. Update the target entity
      if (request.type === 'OWNER') {
        await tx.user.update({
          where: { id: request.ownerId as string },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedById: adminId
          }
        });
      } else if (request.type === 'PROPERTY' && request.propertyId) {
        await tx.property.update({
          where: { id: request.propertyId as string },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedById: adminId
          }
        });
      }
    });

    res.status(200).json({ success: true, message: 'Verification approved successfully.' });
  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const rejectVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const adminId = req.user!.id;
    let { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      res.status(400).json({ message: 'Rejection reason is required.' });
      return;
    }

    reason = reason.trim().substring(0, 1000);

    const request = await prisma.verificationRequest.findUnique({ where: { id: id as string } });

    if (!request) {
      res.status(404).json({ message: 'Verification request not found.' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(409).json({ message: 'Only PENDING requests can be rejected.' });
      return;
    }

    await prisma.verificationRequest.update({
      where: { id: id as string },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: reason
      }
    });

    res.status(200).json({ success: true, message: 'Verification rejected successfully.' });
  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
