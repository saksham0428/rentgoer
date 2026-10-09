import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PropertyType, FurnishedStatus } from '@prisma/client';

// Helper to validate common property fields
const validatePropertyInput = (data: any): string | null => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') return 'Title is required';
  if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') return 'Description is required';
  
  if (data.rent === undefined || typeof data.rent !== 'number' || data.rent <= 0) return 'Rent must be a positive number';
  if (data.securityDeposit !== undefined && (typeof data.securityDeposit !== 'number' || data.securityDeposit < 0)) return 'Security deposit must be >= 0';
  
  if (!data.city || typeof data.city !== 'string' || data.city.trim() === '') return 'City is required';
  if (!data.locality || typeof data.locality !== 'string' || data.locality.trim() === '') return 'Locality is required';
  
  if (data.bedrooms === undefined || typeof data.bedrooms !== 'number' || data.bedrooms < 0) return 'Bedrooms must be >= 0';
  if (data.bathrooms === undefined || typeof data.bathrooms !== 'number' || data.bathrooms < 0) return 'Bathrooms must be >= 0';

  if (!Object.values(PropertyType).includes(data.propertyType)) return 'Invalid propertyType';
  if (!Object.values(FurnishedStatus).includes(data.furnishedStatus)) return 'Invalid furnishedStatus';

  if (data.latitude !== undefined && data.latitude !== null) {
    if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90) return 'Invalid latitude';
  }
  
  if (data.longitude !== undefined && data.longitude !== null) {
    if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180) return 'Invalid longitude';
  }

  return null;
};

export const getOwnerProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }
    
    const properties = await prisma.property.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { images: true }
    });

    res.status(200).json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching owner properties:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const validationError = validatePropertyInput(req.body);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    // Default to today if availableFrom not provided
    const availableFrom = req.body.availableFrom ? new Date(req.body.availableFrom) : new Date();

    const newProperty = await prisma.property.create({
      data: {
        ownerId, // Force ownerId to be the authenticated user
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        rent: req.body.rent,
        securityDeposit: req.body.securityDeposit || 0,
        city: req.body.city.trim(),
        locality: req.body.locality.trim(),
        address: req.body.address || '',
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        bedrooms: req.body.bedrooms,
        bathrooms: req.body.bathrooms,
        propertyType: req.body.propertyType,
        furnishedStatus: req.body.furnishedStatus,
        availableFrom,
        isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true,
      },
    });

    res.status(201).json({
      success: true,
      data: newProperty,
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      city,
      locality,
      minRent,
      maxRent,
      bedrooms,
      bathrooms,
      propertyType,
      furnishedStatus,
      isAvailable,
      isVerified, sortBy,
      page,
      limit,
    } = req.query;

    const where: any = {};

    if (city) {
      where.city = { contains: String(city), mode: 'insensitive' };
    }
    if (locality) {
      where.locality = { contains: String(locality), mode: 'insensitive' };
    }

    if (minRent !== undefined || maxRent !== undefined) {
      where.rent = {};
      if (minRent !== undefined) {
        const min = Number(minRent);
        if (isNaN(min) || min < 0) {
          res.status(400).json({ success: false, message: 'Invalid minRent value' });
          return;
        }
        where.rent.gte = min;
      }
      if (maxRent !== undefined) {
        const max = Number(maxRent);
        if (isNaN(max) || max < 0) {
          res.status(400).json({ success: false, message: 'Invalid maxRent value' });
          return;
        }
        if (where.rent.gte !== undefined && max < where.rent.gte) {
          res.status(400).json({ success: false, message: 'minRent cannot exceed maxRent' });
          return;
        }
        where.rent.lte = max;
      }
    }

    if (bedrooms !== undefined) {
      const beds = Number(bedrooms);
      if (isNaN(beds) || beds < 0) {
        res.status(400).json({ success: false, message: 'Invalid bedrooms value' });
        return;
      }
      where.bedrooms = beds;
    }

    if (bathrooms !== undefined) {
      const baths = Number(bathrooms);
      if (isNaN(baths) || baths < 0) {
        res.status(400).json({ success: false, message: 'Invalid bathrooms value' });
        return;
      }
      where.bathrooms = baths;
    }

    if (propertyType !== undefined) {
      if (!Object.values(PropertyType).includes(propertyType as PropertyType)) {
        res.status(400).json({ success: false, message: 'Invalid propertyType value' });
        return;
      }
      where.propertyType = propertyType;
    }

    if (furnishedStatus !== undefined) {
      if (!Object.values(FurnishedStatus).includes(furnishedStatus as FurnishedStatus)) {
        res.status(400).json({ success: false, message: 'Invalid furnishedStatus value' });
        return;
      }
      where.furnishedStatus = furnishedStatus;
    }

    if (isVerified !== undefined) {
      if (isVerified !== 'true' && isVerified !== 'false') {
        res.status(400).json({ success: false, message: 'Invalid isVerified value' });
        return;
      }
      if (isVerified === 'true') {
        where.isVerified = true;
      }
    }

    if (isAvailable !== undefined) {
      if (isAvailable !== 'true' && isAvailable !== 'false') {
        res.status(400).json({ success: false, message: 'Invalid isAvailable value' });
        return;
      }
      where.isAvailable = isAvailable === 'true';
    } else {
      where.isAvailable = true; // default
    }

    const sortMap: Record<string, any> = {
      newest: { createdAt: 'desc' },
      rent_asc: { rent: 'asc' },
      rent_desc: { rent: 'desc' },
      verified: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
    };

    const sortKey = (sortBy as string) || 'newest';
    if (!sortMap[sortKey]) {
      res.status(400).json({ success: false, message: 'Invalid sortBy value' });
      return;
    }

    const pageNumber = page ? Number(page) : 1;
    const limitNumber = limit ? Number(limit) : 12;

    if (isNaN(pageNumber) || pageNumber < 1) {
      res.status(400).json({ success: false, message: 'Invalid page value' });
      return;
    }
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
      res.status(400).json({ success: false, message: 'Invalid limit value (must be 1-50)' });
      return;
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [total, properties] = await prisma.$transaction([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        orderBy: sortMap[sortKey],
        skip,
        take: limitNumber,
        include: {
          owner: {
            select: { id: true, name: true, email: true, phone: true, isVerified: true },
          },
          images: true,
        },
      })
    ]);

    const propertyIds = properties.map(p => p.id);
    const aggregates = await prisma.review.groupBy({
      by: ['propertyId'],
      where: { propertyId: { in: propertyIds } },
      _avg: { rating: true },
      _count: true
    });

    const aggregateMap = aggregates.reduce((acc, curr) => {
      acc[curr.propertyId] = {
        averageRating: curr._avg.rating ? Number(curr._avg.rating.toFixed(1)) : 0,
        reviewCount: curr._count
      };
      return acc;
    }, {} as Record<string, { averageRating: number; reviewCount: number }>);

    const propertiesWithRatings = properties.map(p => ({
      ...p,
      averageRating: aggregateMap[p.id]?.averageRating || 0,
      reviewCount: aggregateMap[p.id]?.reviewCount || 0
    }));

    res.status(200).json({
      success: true,
      data: propertiesWithRatings,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPropertyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        images: true,
      },
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    const aggregates = await prisma.review.aggregate({
      where: { propertyId: id },
      _avg: { rating: true },
      _count: true
    });

    const propertyWithRatings = {
      ...property,
      averageRating: aggregates._avg.rating ? Number(aggregates._avg.rating.toFixed(1)) : 0,
      reviewCount: aggregates._count
    };

    res.status(200).json({
      success: true,
      data: propertyWithRatings,
    });
  } catch (error) {
    console.error('Error fetching property by ID:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const id = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    // Critical authorization check
    if (property.ownerId !== ownerId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this property.' });
      return;
    }

    const validationError = validatePropertyInput(req.body);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    const availableFrom = req.body.availableFrom ? new Date(req.body.availableFrom) : property.availableFrom;

    const updatedProperty = await prisma.property.update({
      where: { id },
      data: {
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        rent: req.body.rent,
        securityDeposit: req.body.securityDeposit !== undefined ? req.body.securityDeposit : property.securityDeposit,
        city: req.body.city.trim(),
        locality: req.body.locality.trim(),
        address: req.body.address !== undefined ? req.body.address : property.address,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        bedrooms: req.body.bedrooms,
        bathrooms: req.body.bathrooms,
        propertyType: req.body.propertyType,
        furnishedStatus: req.body.furnishedStatus,
        availableFrom,
        isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : property.isAvailable,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedProperty,
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const id = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    // Critical authorization check
    if (property.ownerId !== ownerId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this property.' });
      return;
    }

    await prisma.property.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
