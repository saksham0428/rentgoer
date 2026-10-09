
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

      // 1. Mark request as ACCEPTED
      const acceptedRequest = await tx.rentalRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
        include: { property: true }
      });

      // 2. Mark property as unavailable
      await tx.property.update({
        where: { id: request.propertyId },
        data: { isAvailable: false }
      });

      // 3. Mark all other PENDING requests for this property as REJECTED
      await tx.rentalRequest.updateMany({
        where: {
          propertyId: request.propertyId,
          status: 'PENDING',
          id: { not: requestId }
        },
        data: { status: 'REJECTED' }
      });

      return acceptedRequest;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Request not found' });
    } else if (error.message === 'FORBIDDEN') {
      res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (error.message === 'CONFLICT_STATUS') {
      res.status(409).json({ success: false, message: 'Request is not PENDING' });
    } else if (error.message === 'CONFLICT_AVAILABILITY') {
      res.status(409).json({ success: false, message: 'Property is already unavailable' });
    } else {
      console.error('Error accepting request:', error);
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
