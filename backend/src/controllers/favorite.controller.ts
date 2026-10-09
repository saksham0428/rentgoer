import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const addFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const propertyId = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    // Upsert or just create, catching unique constraint
    try {
      await prisma.favorite.create({
        data: {
          userId,
          propertyId,
        }
      });
    } catch (e: any) {
      // P2002 is Prisma unique constraint violation code
      if (e.code === 'P2002') {
        // already favorited, idempotent return
        res.status(200).json({ success: true, data: { favorited: true } });
        return;
      }
      throw e;
    }

    res.status(200).json({ success: true, data: { favorited: true } });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const removeFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const propertyId = req.params.id as string;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId
        }
      }
    });

    if (favorite) {
      await prisma.favorite.delete({
        where: { id: favorite.id }
      });
    }

    res.status(200).json({ success: true, data: { favorited: false } });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          include: {
            images: true,
          }
        }
      }
    });

    const mappedProperties = favorites.map(f => ({
      ...f.property,
      favoriteId: f.id,
      favoritedAt: f.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: mappedProperties
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFavoritesIdList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      select: { propertyId: true }
    });

    res.status(200).json({
      success: true,
      data: favorites.map(f => f.propertyId)
    });
  } catch (error) {
    console.error('Error fetching favorite IDs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
