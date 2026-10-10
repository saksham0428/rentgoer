import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { RequestStatus } from '@prisma/client';

export const createRentalRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const propertyId = req.params.id as string;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Message must be between 10 and 1000 characters' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    if (!property.isAvailable) {
      res.status(409).json({ success: false, message: 'Property is currently unavailable' });
      return;
    }

    const existingRequest = await prisma.rentalRequest.findFirst({
      where: {
        tenantId,
        propertyId,
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    });

    if (existingRequest) {
      res.status(409).json({ success: false, message: 'You already have an active request for this property' });
      return;
    }

    const newRequest = await prisma.rentalRequest.create({
      data: {
        tenantId,
        propertyId,
        message: message.trim(),
        status: 'PENDING'
      }
    });

    // Notify owner
    const notification = await prisma.notification.create({
      data: {
        userId: property.ownerId,
        type: 'RENTAL_REQUEST',
        title: 'New Rental Request',
        message: `You have a new rental request for "${property.title}".`,
        referenceId: newRequest.id
      }
    });
    import('../lib/realtime-notifications').then(m => m.emitNotification(property.ownerId, notification)).catch(console.error);

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error('Error creating rental request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyRentalRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requests = await prisma.rentalRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            rent: true,
            city: true,
            locality: true,
            bedrooms: true,
            bathrooms: true,
            propertyType: true,
            furnishedStatus: true,
            isAvailable: true,
            images: true
          }
        }
      }
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching rental requests:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const cancelRentalRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requestId = req.params.id as string;

    const rentalRequest = await prisma.rentalRequest.findUnique({
      where: { id: requestId }
    });

    if (!rentalRequest) {
      res.status(404).json({ success: false, message: 'Rental request not found' });
      return;
    }

    if (rentalRequest.tenantId !== tenantId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this request.' });
      return;
    }

    if (rentalRequest.status !== 'PENDING') {
      res.status(409).json({ success: false, message: `Request cannot be cancelled because its status is ${rentalRequest.status}` });
      return;
    }

    const updatedRequest = await prisma.rentalRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' }
    });

    res.status(200).json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error('Error cancelling rental request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getOwnerRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requests = await prisma.rentalRequest.findMany({
      where: {
        property: {
          ownerId
        }
      },
      include: {
        property: true,
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching owner requests:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const acceptRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requestId = req.params.id as string;

    // We do the checks and updates within an interactive transaction to ensure atomicity and race-safety.
    let notificationToEmit: any = null;
    let otherNotificationsToEmit: any[] = [];
    
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.rentalRequest.findUnique({
        where: { id: requestId },
        include: { property: true }
      });

      if (!request) {
        throw new Error('NOT_FOUND');
      }

      if (request.property.ownerId !== ownerId) {
        throw new Error('FORBIDDEN');
      }

      if (request.status !== 'PENDING') {
        throw new Error('CONFLICT_STATUS');
      }

      if (!request.property.isAvailable) {
        throw new Error('CONFLICT_AVAILABILITY');
      }

      // 1. Atomically mark property as unavailable FIRST.
      // Locking the parent Property row first establishes a consistent lock ordering across transactions,
      // preventing deadlocks when concurrent acceptances occur for the same property.
      const updatePropResult = await tx.property.updateMany({
        where: {
          id: request.propertyId,
          isAvailable: true
        },
        data: {
          isAvailable: false
        }
      });

      if (updatePropResult.count === 0) {
        throw new Error('CONFLICT_AVAILABILITY');
      }

      // 2. Mark request as ACCEPTED atomically
      const updateReqResult = await tx.rentalRequest.updateMany({
        where: {
          id: requestId,
          status: 'PENDING'
        },
        data: {
          status: 'ACCEPTED'
        }
      });

      if (updateReqResult.count === 0) {
        throw new Error('CONFLICT_STATUS');
      }

      const acceptedRequest = await tx.rentalRequest.findUnique({
        where: { id: requestId },
        include: { property: true }
      });

      // 3. Mark all other PENDING requests for this property as REJECTED
      const otherRequests = await tx.rentalRequest.findMany({
        where: {
          propertyId: request.propertyId,
          status: 'PENDING',
          id: { not: requestId }
        }
      });

      if (otherRequests.length > 0) {
        await tx.rentalRequest.updateMany({
          where: {
            propertyId: request.propertyId,
            status: 'PENDING',
            id: { not: requestId }
          },
          data: { status: 'REJECTED' }
        });
      }

      // 4. Create Conversation atomically via upsert (guarantees exactly one conversation exists)
      await tx.conversation.upsert({
        where: { rentalRequestId: requestId },
        update: {},
        create: {
          rentalRequestId: requestId,
          propertyId: request.propertyId,
          tenantId: request.tenantId,
          ownerId: request.property.ownerId
        }
      });

      return { acceptedRequest, request, otherRequests };
    }, { timeout: 15000, maxWait: 10000 });

    const { acceptedRequest, request, otherRequests } = result;

    // 5. Create notifications asynchronously outside the critical database transaction to prevent timeouts
    try {
      notificationToEmit = await prisma.notification.create({
        data: {
          userId: request.tenantId,
          type: 'REQUEST_ACCEPTED',
          title: 'Request Accepted!',
          message: `Your rental request for "${request.property.title}" has been accepted. You can now chat with the owner.`,
          referenceId: requestId
        }
      });

      if (otherRequests.length > 0) {
        const rejectedNotificationsData = otherRequests.map(otherReq => ({
          userId: otherReq.tenantId,
          type: 'REQUEST_REJECTED' as const,
          title: 'Request Rejected',
          message: `Your rental request for "${request.property.title}" was not accepted.`,
          referenceId: otherReq.id
        }));

        try {
          otherNotificationsToEmit = await prisma.notification.createManyAndReturn({
            data: rejectedNotificationsData
          });
        } catch {
          await prisma.notification.createMany({
            data: rejectedNotificationsData
          });
          otherNotificationsToEmit = rejectedNotificationsData;
        }
      }
    } catch (notifErr) {
      console.error('Failed to create notifications for accepted request:', notifErr);
    }

    if (notificationToEmit) {
      import('../lib/realtime-notifications').then(m => m.emitNotification(notificationToEmit.userId, notificationToEmit)).catch(console.error);
    }
    for (const n of otherNotificationsToEmit) {
      import('../lib/realtime-notifications').then(m => m.emitNotification(n.userId, n)).catch(console.error);
    }

    res.status(200).json({ success: true, data: acceptedRequest });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Request not found' });
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (error.message === 'CONFLICT_STATUS') {
      res.status(409).json({ success: false, message: 'Request is not PENDING' });
    } else if (error.message === 'CONFLICT_AVAILABILITY') {
      res.status(409).json({ success: false, message: 'Property is already unavailable' });
    } else if (
      error.code === 'P2002' ||
      error.code === 'P2034' ||
      (typeof error.message === 'string' && (error.message.includes('deadlock detected') || error.message.includes('40P01')))
    ) {
      res.status(409).json({ success: false, message: 'Conflict: request was accepted by another concurrent operation. Please refresh.' });
    } else {
      console.error('Error accepting request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};

export const completeRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requestId = req.params.id as string;

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.rentalRequest.findUnique({
        where: { id: requestId },
        include: { property: true }
      });

      if (!request) {
        throw new Error('NOT_FOUND');
      }

      if (request.property.ownerId !== ownerId) {
        throw new Error('FORBIDDEN');
      }

      if (request.status !== 'ACCEPTED') {
        throw new Error('NOT_ACCEPTED');
      }

      const completedRequest = await tx.rentalRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED' }
      });

      return completedRequest;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Request not found' });
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (error.message === 'NOT_ACCEPTED') {
      res.status(409).json({ success: false, message: 'Request must be in ACCEPTED status' });
    } else {
      console.error('Error completing request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};

export const rejectRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const requestId = req.params.id as string;

    const request = await prisma.rentalRequest.findUnique({
      where: { id: requestId },
      include: { property: true }
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    if (request.property.ownerId !== ownerId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(409).json({ success: false, message: 'Only PENDING requests can be rejected' });
      return;
    }

    const updatedRequest = await prisma.rentalRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    });

    res.status(200).json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
