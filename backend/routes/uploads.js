const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary.js');
const { authRequired } = require('../mw/auth.js');

const router = express.Router();

// Configure multer for memory storage (we'll upload directly to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload multiple images
router.post('/images', authRequired, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No files uploaded'
      });
    }

    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'eskisini-listings',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                public_id: result.public_id,
                url: result.secure_url,
                width: result.width,
                height: result.height
              });
            }
          }
        ).end(file.buffer);
      });
    });

    const uploadResults = await Promise.all(uploadPromises);

    res.json({
      ok: true,
      images: uploadResults
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      ok: false,
      error: 'Image upload failed'
    });
  }
});

// Delete an image
router.delete('/images/:public_id', authRequired, async (req, res) => {
  try {
    const { public_id } = req.params;

    const result = await cloudinary.uploader.destroy(public_id);

    res.json({
      ok: true,
      result
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      ok: false,
      error: 'Image deletion failed'
    });
  }
});

// Upload shop logo/banner to Cloudinary
router.post('/shop-media', authRequired, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const { pool } = require('../db.js');
    const userId = req.user.id;
    const uploadedMedia = {};

    // Check if seller profile exists
    const [sellerCheck] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    if (sellerCheck.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Seller profile not found. Please create your shop first.'
      });
    }

    // Upload logo if provided
    if (req.files && req.files.logo && req.files.logo[0]) {
      const logoFile = req.files.logo[0];
      const logoResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'eskisini/shop-logos',
            transformation: [
              { width: 300, height: 300, crop: 'fill', gravity: 'center' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(logoFile.buffer);
      });

      uploadedMedia.logo_url = logoResult.secure_url;

      // Update database
      await pool.execute(
        'UPDATE seller_profiles SET logo_url = ?, updated_at = NOW() WHERE user_id = ?',
        [logoResult.secure_url, userId]
      );
    }

    // Upload banner if provided
    if (req.files && req.files.banner && req.files.banner[0]) {
      const bannerFile = req.files.banner[0];
      const bannerResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'eskisini/shop-banners',
            transformation: [
              { width: 1200, height: 400, crop: 'fill', gravity: 'center' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(bannerFile.buffer);
      });

      uploadedMedia.banner_url = bannerResult.secure_url;

      // Update database
      await pool.execute(
        'UPDATE seller_profiles SET banner_url = ?, updated_at = NOW() WHERE user_id = ?',
        [bannerResult.secure_url, userId]
      );
    }

    res.json({
      ok: true,
      message: 'Shop media uploaded successfully',
      media: uploadedMedia
    });

  } catch (error) {
    console.error('Shop media upload error:', error);
    res.status(500).json({
      ok: false,
      error: 'Shop media upload failed'
    });
  }
});

module.exports = router;