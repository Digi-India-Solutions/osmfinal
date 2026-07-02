// src/utils/cloudinary.util.js

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deleteLocalFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.log('Local file delete error:', err);
    });
  }
};

// ✅ Upload to Cloudinary with dynamic folder and PUBLIC access
export const uploadImageToCloudinary = async (
  filePath,
  folder = 'profiles',
  options = {},
) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto', // Auto detect file type
      access_mode: 'public', // ✅ IMPORTANT: Make files publicly accessible
      ...options, // Allow override options
    });

    deleteLocalFile(filePath);

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    deleteLocalFile(filePath);
    throw new Error('Cloudinary upload failed: ' + error.message);
  }
};

// ✅ Upload PDF specifically (public access)
export const uploadPDFToCloudinary = async (filePath, folder = 'pdfs') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'raw', // ✅ PDFs use 'raw' resource type
      access_mode: 'public', // ✅ Public access
      format: 'pdf',
    });

    deleteLocalFile(filePath);

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    deleteLocalFile(filePath);
    throw new Error('Cloudinary PDF upload failed: ' + error.message);
  }
};

// ✅ Upload Video
export const uploadVideoToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: 'videos',
      access_mode: 'public', // ✅ Public access
    });

    deleteLocalFile(filePath);

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    deleteLocalFile(filePath);
    throw new Error('Cloudinary video upload failed: ' + error.message);
  }
};

// ✅ Delete from Cloudinary
export const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    if (!publicId) return;

    return await cloudinary.uploader.destroy(publicId, options);
  } catch (error) {
    throw new Error('Cloudinary deletion failed: ' + error.message);
  }
};

// ✅ Get public URL with transformations
export const getCloudinaryUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'auto',
    ...options,
  });
};

export default {
  uploadImageToCloudinary,
  uploadPDFToCloudinary,
  uploadVideoToCloudinary,
  deleteFromCloudinary,
  getCloudinaryUrl,
};
