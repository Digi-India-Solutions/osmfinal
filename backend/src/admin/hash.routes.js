// backend/src/admin/hash.routes.js
import { Router } from 'express';
import bcrypt from 'bcrypt';

const router = Router();

// ✅ SIMPLE VERSION - Bina Auth ke (Sirf Development)
router.post('/generate', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    const hash = await bcrypt.hash(password, 10);

    res.json({
      success: true,
      data: {
        password: password,
        hash: hash,
        verification: await bcrypt.compare(password, hash),
      },
    });
  } catch (error) {
    console.error('Hash Generation Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ SECURE VERSION - Sirf Admin ke liye (Production)
router.post('/generate-secure',  async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can generate hashes',
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    const hash = await bcrypt.hash(password, 10);

    res.json({
      success: true,
      data: {
        password: password,
        hash: hash,
        verification: await bcrypt.compare(password, hash),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
