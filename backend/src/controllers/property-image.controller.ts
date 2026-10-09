import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabase, SUPABASE_STORAGE_BUCKET } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

const MAX_IMAGES_PER_PROPERTY = 10;

export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const propertyId = req.params.id as string;

    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'No images provided' });
      return;
    }

    // Verify property ownership
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    if (property.ownerId !== ownerId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this property.' });
      return;
    }

    const currentImageCount = await prisma.propertyImage.count({
      where: { propertyId }
    });

    if (currentImageCount + files.length > MAX_IMAGES_PER_PROPERTY) {
      res.status(400).json({ 
        success: false, 
        message: `Property image limit exceeded. Maximum ${MAX_IMAGES_PER_PROPERTY} images allowed. Currently has ${currentImageCount} images.` 
      });
      return;
    }

    const uploadedRecords: any[] = [];
    const uploadedPaths: string[] = [];

    // Process files one by one to handle partial failures cleanly
    for (const file of files) {
      const ext = mime.extension(file.mimetype) || 'bin';
      const uniqueId = uuidv4();
      const storagePath = `properties/${propertyId}/${uniqueId}.${ext}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        // Rollback already uploaded files for this batch
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(uploadedPaths);
        }
        res.status(500).json({ success: false, message: 'Storage upload failed. Upload batch aborted.' });
        return;
      }

      uploadedPaths.push(storagePath);
      
      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      uploadedRecords.push({
        propertyId,
        url: publicUrlData.publicUrl,
        publicId: storagePath
      });
    }

    // Save to DB
    try {
      const createdImages = await prisma.$transaction(
        uploadedRecords.map(record => prisma.propertyImage.create({ data: record }))
      );

      res.status(201).json({
        success: true,
        data: createdImages
      });
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Clean up orphaned storage files
      await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(uploadedPaths);
      res.status(500).json({ success: false, message: 'Failed to save image records. Uploaded files rolled back.' });
    }
  } catch (error) {
    console.error('Unexpected upload error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const propertyId = req.params.id as string;
    const imageId = req.params.imageId as string;

    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    // Verify property ownership and existence
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }

    if (property.ownerId !== ownerId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this property.' });
      return;
    }

    // Verify image existence and relationship to property
    const image = await prisma.propertyImage.findUnique({
      where: { id: imageId }
    });

    if (!image) {
      res.status(404).json({ success: false, message: 'Image not found' });
      return;
    }

    if (image.propertyId !== propertyId) {
      res.status(400).json({ success: false, message: 'Image does not belong to this property' });
      return;
    }

    // Remove from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .remove([image.publicId]);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      res.status(500).json({ success: false, message: 'Failed to delete file from storage' });
      return;
    }

    // Remove from DB
    await prisma.propertyImage.delete({
      where: { id: imageId }
    });

    res.status(200).json({
      success: true,
      message: 'Property image deleted successfully'
    });
  } catch (error) {
    console.error('Unexpected delete error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
