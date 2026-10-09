import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId || req.user?.role !== 'TENANT') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const propertyId = req.params.id as string;
    const { rentalRequestId, rating, title, comment } = req.body;

    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
      return;
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 5 || comment.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Comment must be between 5 and 1000 characters' });
      return;
    }

    const safeTitle = title && typeof title === 'string' ? title.trim().substring(0, 100) : null;
    const safeComment = comment.trim();

    const request = await prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: { review: true }
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Rental request not found' });
      return;
    }

    if (request.tenantId !== tenantId) {
      res.status(403).json({ success: false, message: 'Not your rental request' });
      return;
    }

    if (request.propertyId !== propertyId) {
      res.status(400).json({ success: false, message: 'Rental request does not belong to this property' });
      return;
    }

    if (request.status !== 'COMPLETED') {
      res.status(400).json({ success: false, message: 'Rental request is not COMPLETED' });
      return;
    }

    if (request.review) {
      res.status(409).json({ success: false, message: 'Review already exists for this rental request' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        rentalRequestId,
        propertyId,
        tenantId,
        rating,
        title: safeTitle,
        comment: safeComment
      }
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPropertyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = req.params.id as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const reviews = await prisma.review.findMany({
      where: { propertyId },
      include: {
        tenant: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.review.count({ where: { propertyId } });

    res.status(200).json({ 
      success: true, 
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId || req.user?.role !== 'TENANT') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const reviewId = req.params.id as string;
    const { rating, title, comment } = req.body;

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (review.tenantId !== tenantId) {
      res.status(403).json({ success: false, message: 'Not your review' });
      return;
    }

    if (rating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
      return;
    }

    let safeTitle = review.title;
    if (title !== undefined) {
      safeTitle = typeof title === 'string' && title.trim() !== '' ? title.trim().substring(0, 100) : null;
    }

    let safeComment = review.comment;
    if (comment !== undefined) {
      if (typeof comment !== 'string' || comment.trim().length < 5 || comment.trim().length > 1000) {
        res.status(400).json({ success: false, message: 'Comment must be between 5 and 1000 characters' });
        return;
      }
      safeComment = comment.trim();
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(rating ? { rating } : {}),
        title: safeTitle,
        comment: safeComment
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId || req.user?.role !== 'TENANT') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const reviewId = req.params.id as string;

    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (review.tenantId !== tenantId) {
      res.status(403).json({ success: false, message: 'Not your review' });
      return;
    }

    await prisma.review.delete({
      where: { id: reviewId }
    });

    res.status(200).json({ success: true, message: 'Review deleted' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
