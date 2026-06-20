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
  fs.unlink(filePath, (err) => {
    if (err) console.log('Local file delete error:', err);
  });
};

// ✅ Upload to Cloudinary with dynamic folder
export const uploadImageToCloudinary = async (
  filePath,
  folder = 'profiles',
) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto', // Auto detect file type
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

// ✅ Upload Video
export const uploadVideoToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: 'videos',
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
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;

    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    throw new Error('Cloudinary deletion failed: ' + error.message);
  }
};
