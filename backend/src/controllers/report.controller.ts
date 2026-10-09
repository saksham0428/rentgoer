import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ReportTargetType, ReportReason, ReportStatus } from '@prisma/client';

const validReasons = Object.values(ReportReason);

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const targetType = (req.body.targetType || req.params.targetType)?.toUpperCase() as ReportTargetType;
    const targetId = (req.body.targetId || req.params.id) as string;
    const reason = req.body.reason?.toUpperCase() as ReportReason;
    const description = req.body.description;

    if (!['PROPERTY', 'USER', 'MESSAGE'].includes(targetType)) {
      res.status(400).json({ success: false, message: 'Invalid targetType' });
      return;
    }

    if (!targetId || typeof targetId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid targetId' });
      return;
    }

    if (!validReasons.includes(reason)) {
      res.status(400).json({ success: false, message: 'Invalid reason' });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Description must be between 5 and 1000 characters' });
      return;
    }

    const safeDescription = description.trim();

    // Verify Target
    if (targetType === 'PROPERTY') {
      const property = await prisma.property.findUnique({ where: { id: targetId } });
      if (!property) {
        res.status(404).json({ success: false, message: 'Property not found' });
        return;
      }
      if (property.ownerId === reporterId) {
        res.status(400).json({ success: false, message: 'Cannot report your own property' });
        return;
      }
    } else if (targetType === 'USER') {
      const user = await prisma.user.findUnique({ where: { id: targetId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      if (user.id === reporterId) {
        res.status(400).json({ success: false, message: 'Cannot report yourself' });
        return;
      }
    } else if (targetType === 'MESSAGE') {
      const message = await prisma.message.findUnique({ 
        where: { id: targetId },
        include: { conversation: true }
      });
      if (!message) {
        res.status(404).json({ success: false, message: 'Message not found' });
        return;
      }
      if (message.conversation.tenantId !== reporterId && message.conversation.ownerId !== reporterId) {
        res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
        return;
      }
      if (message.senderId === reporterId) {
        res.status(400).json({ success: false, message: 'Cannot report your own message' });
        return;
      }
    }

    // Check for duplicate OPEN report
    const existing = await prisma.report.findFirst({
      where: {
        reporterId,
        targetType,
        targetId,
        status: 'OPEN'
      }
    });

    if (existing) {
      res.status(409).json({ success: false, message: 'You already have an open report for this target' });
      return;
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        description: safeDescription
      }
    });

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const reports = await prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Error fetching my reports:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAdminReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, targetType, reason, page, limit } = req.query;

    const where: any = {};
    if (status) where.status = status as ReportStatus;
    if (targetType) where.targetType = targetType as ReportTargetType;
    if (reason) where.reason = reason as ReportReason;

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (pageNumber - 1) * limitNumber;

    const [total, reports] = await prisma.$transaction([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber
      })
    ]);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAdminReportById = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = req.params.id as string;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    let targetSummary: any = null;
    if (report.targetType === 'PROPERTY') {
      const p = await prisma.property.findUnique({ 
        where: { id: report.targetId },
        include: { owner: { select: { name: true } } }
      });
      if (p) targetSummary = { title: p.title, city: p.city, locality: p.locality, ownerName: p.owner?.name, isAvailable: p.isAvailable };
    } else if (report.targetType === 'USER') {
      const u = await prisma.user.findUnique({ where: { id: report.targetId } });
      if (u) targetSummary = { name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
    } else if (report.targetType === 'MESSAGE') {
      const m = await prisma.message.findUnique({ 
        where: { id: report.targetId },
        include: { sender: { select: { name: true } } }
      });
      if (m) targetSummary = { content: m.content, senderName: m.sender?.name, conversationId: m.conversationId, createdAt: m.createdAt };
    }

    res.status(200).json({
      success: true,
      data: {
        ...report,
        targetSummary
      }
    });
  } catch (error) {
    console.error('Error fetching admin report:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateAdminReportStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = req.params.id as string;
    const { status, moderatorNote } = req.body;

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    const data: any = {};
    if (status) {
      const validStatuses = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid status' });
        return;
      }

      // Allowed transitions:
      // OPEN -> REVIEWING, RESOLVED, DISMISSED
      // REVIEWING -> RESOLVED, DISMISSED
      const current = report.status;
      if (current === 'RESOLVED' || current === 'DISMISSED') {
        res.status(400).json({ success: false, message: 'Cannot change status of a closed report' });
        return;
      }
      if (current === 'OPEN' && !['REVIEWING', 'RESOLVED', 'DISMISSED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid transition from OPEN' });
        return;
      }
      if (current === 'REVIEWING' && !['RESOLVED', 'DISMISSED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid transition from REVIEWING' });
        return;
      }

      data.status = status as ReportStatus;
    }

    if (moderatorNote !== undefined) {
      data.moderatorNote = typeof moderatorNote === 'string' ? moderatorNote.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields provided' });
      return;
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating admin report:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
