const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

// Phone validation (10-digit number)
const phoneRule = body('phone')
  .matches(/^\+?\d{10,15}$/)
  .withMessage('Enter a valid 10-15 digit mobile number');

// Email validation
const emailRule = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Enter a valid email address');

// Rate limiter for OTP requests (5 per hour per user via service)
const otpLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per minute (actual rate limiting in service is stricter)
  message: { success: false, error: 'Too many OTP requests. Wait a minute.' },
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

// ===========================
// DIRECT LOGIN ENDPOINTS (Flutter)
// ===========================

/**
 * POST /api/auth/login
 * Direct login: phone + optional password
 */
router.post(
  '/login',
  [
    body('phone').matches(/^\+?\d{10,15}$/).withMessage('Enter a valid phone number'),
    body('password').optional().isString(),
    body('role').optional().isIn(['DRIVER', 'PASSENGER', 'USER']),
  ],
  validate,
  ctrl.login
);

/**
 * POST /api/auth/quick-login
 * Quick login: phone only (no OTP, no password)
 */
router.post(
  '/quick-login',
  [
    body('phone').matches(/^\+?\d{10,15}$/).withMessage('Enter a valid phone number'),
    body('role').optional().isIn(['DRIVER', 'PASSENGER', 'USER']),
  ],
  validate,
  ctrl.quickLogin
);

// ===========================
// UNIFIED OTP ENDPOINTS
// ===========================

/**
 * POST /api/auth/send-otp
 * Unified endpoint: Send OTP via email or phone
 * Body: { email } OR { phone }
 */
router.post(
  '/send-otp',
  otpLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+?\d{10,15}$/),
  ],
  validate,
  ctrl.sendUnifiedOTP
);

/**
 * POST /api/auth/verify-otp
 * Unified endpoint: Verify OTP and get JWT token
 * Body: { email, otp } OR { phone, otp, verificationId? }
 */
router.post(
  '/verify-otp',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+?\d{10,15}$/),
    body('otp').notEmpty().isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits'),
    body('role').optional().isIn(['DRIVER', 'PASSENGER', 'USER']).withMessage('Invalid role'),
    body('name').optional().isString(),
    body('verificationId').optional().isString(),
  ],
  validate,
  ctrl.verifyUnifiedOTP
);

// ===========================
// DEDICATED PHONE OTP ENDPOINTS
// ===========================

/**
 * POST /api/auth/send-phone-otp
 * Send phone OTP via Firebase
 * Body: { phone }
 */
router.post(
  '/send-phone-otp',
  otpLimiter,
  [phoneRule],
  validate,
  ctrl.sendPhoneOTP
);

/**
 * POST /api/auth/verify-phone-otp
 * Verify phone OTP
 * Body: { phone, otp, verificationId?, role?, name? }
 */
router.post(
  '/verify-phone-otp',
  [
    phoneRule,
    body('otp').notEmpty().isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits'),
    body('role').optional().isIn(['DRIVER', 'PASSENGER', 'USER']).withMessage('Invalid role'),
    body('name').optional().isString(),
    body('verificationId').optional().isString(),
  ],
  validate,
  ctrl.verifyPhoneOTPEndpoint
);

// ===========================
// DEDICATED EMAIL OTP ENDPOINTS
// ===========================

/**
 * POST /api/auth/send-email-otp
 * Send email OTP
 * Body: { email }
 */
router.post(
  '/send-email-otp',
  otpLimiter,
  [emailRule],
  validate,
  ctrl.sendEmailOTPEndpoint
);

/**
 * POST /api/auth/verify-email-otp
 * Verify email OTP
 * Body: { email, otp, role?, name? }
 */
router.post(
  '/verify-email-otp',
  [
    emailRule,
    body('otp').notEmpty().isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits'),
    body('role').optional().isIn(['DRIVER', 'PASSENGER', 'USER']).withMessage('Invalid role'),
    body('name').optional().isString(),
  ],
  validate,
  ctrl.verifyEmailOTPEndpoint
);

// ===========================
// LEGACY & OTHER ENDPOINTS
// ===========================

router.post('/guest-login', ctrl.guestLogin);

router.get('/me', authenticate, ctrl.getMe);

router.post('/logout', authenticate, ctrl.logout);

/**
 * POST /api/auth/signup
 * Alias for send-otp — starts the registration/login flow
 */
router.post(
  '/signup',
  otpLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+?\d{10,15}$/),
  ],
  validate,
  ctrl.sendUnifiedOTP
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token using existing valid token
 */
router.post('/refresh', authenticate, ctrl.refreshToken);

/**
 * GET /api/auth/verify-email
 * Verify email via token link (email verification flow)
 */
router.get('/verify-email', ctrl.verifyEmailToken);

// ===========================
// DEV ONLY — OTP Fetch (never expose in production)
// ===========================
if (process.env.NODE_ENV === 'development') {
  const OTP = require('../models/OTP');

  /**
   * GET /api/auth/dev/latest-otp?phone=9876543210
   * Returns the latest unverified OTP for a phone/email (DEV ONLY)
   * Flutter app can call this to auto-fill OTP during testing
   */
  router.get('/dev/latest-otp', async (req, res) => {
    try {
      const { phone, email } = req.query;
      if (!phone && !email) {
        return res.status(400).json({ error: 'phone or email required' });
      }

      // Find latest OTP record
      const filter = phone
        ? { $or: [{ phone }, { phone: phone.replace(/^\+91/, '') }, { phone: `+91${phone}` }] }
        : { email };

      const otpRecord = await OTP.findOne({ ...filter, verified: false })
        .sort({ createdAt: -1 })
        .lean();

      if (!otpRecord) {
        return res.status(404).json({ error: 'No active OTP found. Send OTP first.' });
      }

      // OTP is hashed — we can't reverse it, but we log it on send
      // Return metadata so Flutter knows OTP was sent
      return res.json({
        message: 'OTP was sent. Check backend terminal for the code.',
        hint: 'Look for: [DEV] Phone OTP for ... in backend console',
        phone: otpRecord.phone,
        email: otpRecord.email,
        expiresAt: otpRecord.expiresAt,
        type: otpRecord.type,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = router;
