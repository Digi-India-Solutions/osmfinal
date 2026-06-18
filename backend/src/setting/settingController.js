// src/setting/settingController.js
import { connectDB } from '../pool.js';
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.util.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────

const settingsExist = async () => {
  try {
    const result = await connectDB.query(`SELECT id FROM settings LIMIT 1`);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking settings:', error);
    return false;
  }
};

// ─── GET SETTINGS ──────────────────────────────────────────────────────────

export const getSettings = async (req, res) => {
  try {
    const result = await connectDB.query(`SELECT * FROM settings LIMIT 1`);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'No settings found. Please create settings first.',
        data: null,
      });
    }

    // Settings data return karo (logo already Cloudinary URL hai)
    return res.status(200).json({
      success: true,
      exists: true,
      message: 'Settings retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get Settings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── CREATE SETTINGS ──────────────────────────────────────────────────────

export const createSettings = async (req, res) => {
  try {
    const { company_name, address, phone, email, website, version, build } =
      req.body;

    // Check if settings already exist
    const exists = await settingsExist();
    if (exists) {
      // Agar logo upload hua hai to local file delete karo
      if (req.file) {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Settings already exist. Use PUT/PATCH to update.',
      });
    }

    // Validation
    if (!company_name) {
      if (req.file) {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Company name is required',
      });
    }

    // Upload logo to Cloudinary if file exists
    let logoUrl = null;
    let logoPublicId = null;

    if (req.file) {
      try {
        const uploadResult = await uploadImageToCloudinary(req.file.path);
        logoUrl = uploadResult.url;
        logoPublicId = uploadResult.public_id;
        console.log('Logo uploaded to Cloudinary:', logoUrl);
      } catch (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload logo',
          error: error.message,
        });
      }
    }

    // Insert settings with Cloudinary URL
    const result = await connectDB.query(
      `INSERT INTO settings (
        company_name, address, phone, email, website, logo, logo_public_id, version, build, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        company_name,
        address || '',
        phone || '',
        email || '',
        website || '',
        logoUrl,
        logoPublicId,
        version || '1.0.0',
        build || 'OSM Frontend',
      ],
    );

    return res.status(201).json({
      success: true,
      message: 'Settings created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create Settings Error:', error);
    // Agar error aaye to uploaded file delete karo
    if (req.file) {
      try {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── UPDATE SETTINGS ──────────────────────────────────────────────────────

export const updateSettings = async (req, res) => {
  try {
    const { company_name, address, phone, email, website, version, build } =
      req.body;

    // Check if settings exist
    const exists = await settingsExist();
    if (!exists) {
      if (req.file) {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Settings not found. Please create settings first.',
      });
    }

    // Get current settings
    const currentSettings = await connectDB.query(
      `SELECT logo, logo_public_id FROM settings LIMIT 1`,
    );
    const currentLogoPublicId = currentSettings.rows[0]?.logo_public_id;

    // Upload new logo to Cloudinary if file exists
    let logoUrl = null;
    let logoPublicId = null;

    if (req.file) {
      try {
        // Delete old logo from Cloudinary
        if (currentLogoPublicId) {
          await deleteFromCloudinary(currentLogoPublicId);
          console.log('Old logo deleted from Cloudinary:', currentLogoPublicId);
        }

        // Upload new logo
        const uploadResult = await uploadImageToCloudinary(req.file.path);
        logoUrl = uploadResult.url;
        logoPublicId = uploadResult.public_id;
        console.log('New logo uploaded to Cloudinary:', logoUrl);
      } catch (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload logo',
          error: error.message,
        });
      }
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (company_name !== undefined) {
      updateFields.push(`company_name = $${paramCount}`);
      values.push(company_name);
      paramCount++;
    }
    if (address !== undefined) {
      updateFields.push(`address = $${paramCount}`);
      values.push(address);
      paramCount++;
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    if (website !== undefined) {
      updateFields.push(`website = $${paramCount}`);
      values.push(website);
      paramCount++;
    }
    if (logoUrl !== null) {
      updateFields.push(`logo = $${paramCount}`);
      values.push(logoUrl);
      paramCount++;
    }
    if (logoPublicId !== null) {
      updateFields.push(`logo_public_id = $${paramCount}`);
      values.push(logoPublicId);
      paramCount++;
    }
    if (version !== undefined) {
      updateFields.push(`version = $${paramCount}`);
      values.push(version);
      paramCount++;
    }
    if (build !== undefined) {
      updateFields.push(`build = $${paramCount}`);
      values.push(build);
      paramCount++;
    }

    if (updateFields.length === 0) {
      if (req.file) {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update',
      });
    }

    updateFields.push(`last_updated = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE settings 
      SET ${updateFields.join(', ')} 
      WHERE id = (SELECT id FROM settings LIMIT 1)
      RETURNING *
    `;

    const result = await connectDB.query(query, values);

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Settings Error:', error);
    // Agar error aaye to uploaded file delete karo
    if (req.file) {
      try {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── DELETE SETTINGS ──────────────────────────────────────────────────────

export const deleteSettings = async (req, res) => {
  try {
    const exists = await settingsExist();
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
    }

    // Get logo public_id before deleting
    const settings = await connectDB.query(
      `SELECT logo_public_id FROM settings LIMIT 1`,
    );
    const logoPublicId = settings.rows[0]?.logo_public_id;

    // Delete settings from database
    await connectDB.query(
      `DELETE FROM settings WHERE id = (SELECT id FROM settings LIMIT 1)`,
    );

    // Delete logo from Cloudinary
    if (logoPublicId) {
      try {
        await deleteFromCloudinary(logoPublicId);
        console.log('Logo deleted from Cloudinary:', logoPublicId);
      } catch (error) {
        console.error('Error deleting logo from Cloudinary:', error);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Settings deleted successfully',
    });
  } catch (error) {
    console.error('Delete Settings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── CHECK IF SETTINGS EXIST ─────────────────────────────────────────────

export const checkSettingsExist = async (req, res) => {
  try {
    const exists = await settingsExist();

    if (!exists) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'No settings found. Please create new settings.',
      });
    }

    const result = await connectDB.query(
      `SELECT id, company_name, last_updated FROM settings LIMIT 1`,
    );

    return res.status(200).json({
      success: true,
      exists: true,
      message: 'Settings exist',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Check Settings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
