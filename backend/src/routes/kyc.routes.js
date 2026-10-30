const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadKYC } = require('../config/cloudinary');
const { photoVerify, verificationStatus } = require('../controllers/kyc.controller');

// POST /api/kyc/upload — alias for photo-verify (frontend compatibility)
router.post(
  '/upload',
  authenticate,
  (req, res, next) => {
    uploadKYC.fields([
      { name: 'selfie', maxCount: 1 },
      { name: 'drivingLicense', maxCount: 1 },
      { name: 'govtId', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
      { name: 'image', maxCount: 1 },
      { name: 'license', maxCount: 1 },
      { name: 'document', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
      next();
    });
  },
  photoVerify
);

// POST /api/kyc/photo-verify — upload selfie + drivingLicense, then verify
router.post(
  '/photo-verify',
  authenticate,
  (req, res, next) => {
    uploadKYC.fields([
      { name: 'selfie', maxCount: 1 },
      { name: 'drivingLicense', maxCount: 1 },
      { name: 'govtId', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
      next();
    });
  },
  photoVerify
);

// GET /api/kyc/verification-status
router.get('/verification-status', authenticate, verificationStatus);

module.exports = router;
