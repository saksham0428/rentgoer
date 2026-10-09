import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const createOwnerVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const role = req.user!.role;

    if (role !== 'OWNER') {
      res.status(403).json({ message: 'Only owners can request verification.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: ownerId as string } });
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if (user.isVerified) {
      res.status(409).json({ message: 'Owner is already verified.' });
      return;
    }

    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: {
        ownerId,
        type: 'OWNER',
        status: 'PENDING'
      }
    });

    if (pendingRequest) {
      res.status(409).json({ message: 'A verification request is already pending.' });
      return;
    }

    const newRequest = await prisma.verificationRequest.create({
      data: {
        type: 'OWNER',
        ownerId,
        status: 'PENDING'
      }
    });

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error('Create owner verification error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const createPropertyVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const role = req.user!.role;
    const propertyId = req.params.id as string;

    if (role !== 'OWNER') {
      res.status(403).json({ message: 'Only owners can request verification.' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId as string }
    });

    if (!property) {
      res.status(404).json({ message: 'Property not found.' });
      return;
    }

    if (property.ownerId !== ownerId) {
      res.status(403).json({ message: 'You do not own this property.' });
      return;
    }

    if (property.isVerified) {
      res.status(409).json({ message: 'Property is already verified.' });
      return;
    }

    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: {
        propertyId,
        type: 'PROPERTY',
        status: 'PENDING'
      }
    });

    if (pendingRequest) {
      res.status(409).json({ message: 'A verification request is already pending for this property.' });
      return;
    }

    const newRequest = await prisma.verificationRequest.create({
      data: {
        type: 'PROPERTY',
        ownerId,
        propertyId,
        status: 'PENDING'
      }
    });

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error('Create property verification error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getMyVerificationRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const requests = await prisma.verificationRequest.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        type: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectionReason: true,
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            locality: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Get my verification requests error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
