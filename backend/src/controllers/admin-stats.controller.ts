import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalOwners,
      totalTenants,
      totalProperties,
      verifiedProperties,
      verifiedOwners,
      openReports,
      pendingVerifications,
      recentReports,
      recentVerifications
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'OWNER' } }),
      prisma.user.count({ where: { role: 'TENANT' } }),
      prisma.property.count(),
      prisma.property.count({ where: { isVerified: true } }),
      prisma.user.count({ where: { role: 'OWNER', isVerified: true } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { name: true } } }
      }),
      prisma.verificationRequest.findMany({
        take: 5,
        orderBy: { submittedAt: 'desc' },
        include: { 
          owner: { select: { name: true, email: true } },
          property: { select: { title: true } }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          owners: totalOwners,
          tenants: totalTenants,
          verifiedOwners
        },
        properties: {
          total: totalProperties,
          verified: verifiedProperties
        },
        verification: {
          pending: pendingVerifications,
          recent: recentVerifications
        },
        reports: {
          open: openReports,
          recent: recentReports
        }
      }
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
