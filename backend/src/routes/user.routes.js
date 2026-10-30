const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getTrustScore } = require('../controllers/trustScore.controller');
const { getMyReferrals } = require('../controllers/referral.controller');
const User = require('../models/User');
const { uploadProfilePhoto } = require('../config/cloudinary');

const normalizePhoneForStorage = (value) => String(value || '').replace(/\D/g, '').slice(-10);

// GET /api/users/me — full profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'userId name phone email gender role kycStatus rating totalRatings trustScore ' +
      'faceVerified isPhoneVerified isEmailVerified referralCode emergencyContacts ' +
      'cancellationCount profilePhoto createdAt'
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/users/me — update profile fields
// Allowed: name, email, phone, emergencyContacts, gender, profilePhoto
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { name, email, phone, emergencyContacts, gender, profilePhoto } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2)
        return res.status(400).json({ success: false, error: 'name must be at least 2 characters' });
      updates.name = name.trim();
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return res.status(400).json({ success: false, error: 'Invalid email format' });
      // Check if email already taken by another user
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
      if (existing)
        return res.status(409).json({ success: false, error: 'Email already in use' });
      updates.email = email.toLowerCase();
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizePhoneForStorage(phone);
      if (normalizedPhone.length !== 10) {
        return res.status(400).json({ success: false, error: 'phone must be a valid 10-digit number' });
      }

      const existingPhone = await User.findOne({ phone: normalizedPhone, _id: { $ne: req.user._id } });
      if (existingPhone) {
        return res.status(409).json({ success: false, error: 'Phone already in use' });
      }

      updates.phone = normalizedPhone;
      if (normalizedPhone !== String(req.user.phone || '')) {
        updates.isPhoneVerified = false;
      }
    }

    if (emergencyContacts !== undefined) {
      if (!Array.isArray(emergencyContacts))
        return res.status(400).json({ success: false, error: 'emergencyContacts must be an array' });
      if (emergencyContacts.length > 5)
        return res.status(400).json({ success: false, error: 'Max 5 emergency contacts allowed' });
      updates.emergencyContacts = emergencyContacts;
    }

    if (gender !== undefined) {
      if (!['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'].includes(String(gender).toUpperCase())) {
        return res.status(400).json({ success: false, error: 'gender must be MALE, FEMALE, OTHER, or UNSPECIFIED' });
      }
      updates.gender = String(gender).toUpperCase();
    }

    if (profilePhoto !== undefined) {
      if (profilePhoto !== null && typeof profilePhoto !== 'string') {
        return res.status(400).json({ success: false, error: 'profilePhoto must be a string URL or null' });
      }
      updates.profilePhoto = profilePhoto || null;
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({
        success: false,
        error: 'Nothing to update. Allowed fields: name, email, phone, emergencyContacts, gender, profilePhoto',
      });

    await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    const user = await User.findById(req.user._id).select(
      'userId name phone email gender role kycStatus rating totalRatings trustScore ' +
      'faceVerified isPhoneVerified isEmailVerified referralCode emergencyContacts ' +
      'cancellationCount profilePhoto createdAt'
    );

    res.json({ success: true, message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users/me/photo — upload profile photo
router.post('/me/photo', authenticate, uploadProfilePhoto.single('photo'), async (req, res) => {
  try {
    // Debug logging
    console.log('[PHOTO_UPLOAD] Headers:', req.headers['content-type']);
    console.log('[PHOTO_UPLOAD] req.file:', req.file);
    console.log('[PHOTO_UPLOAD] req.body:', req.body);
    
    if (!req.file)
      return res.status(400).json({ success: false, error: 'No photo uploaded. Use field name "photo"' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { profilePhoto: req.file.path } },
      { new: true }
    ).select('userId name profilePhoto');

    res.json({ success: true, message: 'Profile photo updated', photoUrl: req.file.path, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/me/referrals
router.get('/me/referrals', authenticate, getMyReferrals);

// GET /api/users/:id/trust-score
router.get('/:id/trust-score', authenticate, getTrustScore);

// ─── GET /api/users/preferences ──────────────────────────────────────────────
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    res.json({ success: true, preferences: user?.preferences || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/users/preferences ──────────────────────────────────────────────
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const allowed = ['notifications', 'language', 'theme', 'autoAccept', 'shareLocation'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[`preferences.${k}`] = req.body[k]; });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('preferences');
    res.json({ success: true, message: 'Preferences updated', preferences: user.preferences || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/users/analytics ─────────────────────────────────────────────────
// Alias for /api/analytics/me
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const BookingRequest = require('../models/BookingRequest');
    const Ride = require('../models/Ride');
    const Rating = require('../models/Rating');

    const userId = req.user._id;
    const [totalRides, totalBookings, avgRating] = await Promise.all([
      Ride.countDocuments({ driverId: userId }),
      BookingRequest.countDocuments({ passengerId: userId, status: 'COMPLETED' }),
      Rating.aggregate([
        { $match: { ratedUserId: userId } },
        { $group: { _id: null, avg: { $avg: '$score' } } },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        totalRidesOffered: totalRides,
        totalRidesTaken: totalBookings,
        avgRating: avgRating[0]?.avg?.toFixed(2) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/users/referral ──────────────────────────────────────────────────
// Alias for /api/users/me/referrals
router.get('/referral', authenticate, getMyReferrals);

module.exports = router;
