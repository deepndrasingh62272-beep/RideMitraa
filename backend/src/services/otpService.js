const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('./emailService');
const { sendPhoneOTP } = require('./firebaseService');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const MAX_OTP_REQUESTS_PER_HOUR = parseInt(process.env.MAX_OTP_REQUESTS_PER_HOUR || '5');
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.RESEND_COOLDOWN_SECONDS || '30');

const normalizePhoneToE164 = (value) => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (raw.startsWith('+')) {
    return `+${digits}`;
  }

  // Default India prefix for 10-digit local numbers.
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return `+${digits}`;
};

const buildPhoneCandidates = (value) => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizePhoneToE164(value);
  const candidates = new Set();

  if (raw) candidates.add(raw);
  if (digits) candidates.add(digits);
  if (normalized) candidates.add(normalized);

  if (digits.length === 10) {
    candidates.add(`+91${digits}`);
  }

  if (digits.startsWith('91') && digits.length === 12) {
    candidates.add(digits.slice(2));
  }

  return Array.from(candidates).filter(Boolean);
};

/**
 * Generate a random 6-digit OTP
 * @returns {string} Random OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if user exceeded rate limit for OTP requests
 * @param {string} phone - User phone number (optional)
 * @param {string} email - User email (optional)
 * @returns {Promise<{allowed: boolean, remainingTime?: number, message?: string}>}
 */
const checkRateLimit = async (phone, email) => {
  try {
    const identifier = phone || email;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await OTP.countDocuments({
      $or: [{ phone: identifier }, { email: identifier }],
      createdAt: { $gte: oneHourAgo },
    });

    if (count >= MAX_OTP_REQUESTS_PER_HOUR) {
      return {
        allowed: false,
        message: `Maximum ${MAX_OTP_REQUESTS_PER_HOUR} OTP requests per hour exceeded`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[OTP] Rate limit check failed:', err.message);
    return { allowed: true }; // Allow on error to avoid blocking users
  }
};

/**
 * Check resend cooldown (user must wait 30 seconds between requests)
 * @param {string} phone - User phone number (optional)
 * @param {string} email - User email (optional)
 * @returns {Promise<{allowed: boolean, remainingSeconds?: number, message?: string}>}
 */
const checkResendCooldown = async (phone, email) => {
  try {
    const identifier = phone || email;
    const lastOTP = await OTP.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
      verified: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastOTP) {
      return { allowed: true };
    }

    const timeSinceLastOTP = Date.now() - lastOTP.createdAt.getTime();
    const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;

    if (timeSinceLastOTP < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastOTP) / 1000);
      return {
        allowed: false,
        remainingSeconds,
        message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[OTP] Resend cooldown check failed:', err.message);
    return { allowed: true }; // Allow on error
  }
};

/**
 * Hash OTP using bcrypt
 * @param {string} otp - Plain OTP
 * @returns {Promise<string>} Hashed OTP
 */
const hashOTP = async (otp) => {
  return bcrypt.hash(otp, 10);
};

/**
 * Verify OTP hash — supports both bcrypt (production) and SHA256 (test seeds)
 * @param {string} plainOTP - Plain OTP from user
 * @param {string} hashedOTP - Hashed OTP from database
 * @returns {Promise<boolean>}
 */
const verifyOTPHash = async (plainOTP, hashedOTP) => {
  // Try bcrypt first (production path)
  if (hashedOTP.startsWith('$2')) {
    return bcrypt.compare(plainOTP, hashedOTP);
  }
  // Fallback: SHA256 (used by test seeds via OTP.hashOTP static)
  const sha256Hash = crypto.createHash('sha256').update(plainOTP).digest('hex');
  return sha256Hash === hashedOTP;
};

/**
 * Send OTP via email
 * @param {string} email - Recipient email
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: string}>}
 */
const sendEmailOTP = async (email) => {
  try {
    // Check rate limit
    const rateLimitCheck = await checkRateLimit(null, email);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: rateLimitCheck.message,
        error: 'RATE_LIMIT_EXCEEDED',
      };
    }

    // Check resend cooldown
    const cooldownCheck = await checkResendCooldown(null, email);
    if (!cooldownCheck.allowed) {
      return {
        success: false,
        message: cooldownCheck.message,
        error: 'RESEND_COOLDOWN_ACTIVE',
        data: { remainingSeconds: cooldownCheck.remainingSeconds },
      };
    }

    // Invalidate any existing OTPs for this email
    await OTP.deleteMany({ email, verified: false });

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);

    // Save to database
    await OTP.create({
      email,
      otpHash: hashedOTP,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      type: 'EMAIL',
    });

    // Send email
    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      return {
        success: false,
        message: 'Failed to send OTP email',
        error: emailResult.error,
      };
    }

    return {
      success: true,
      message: `OTP sent to ${email}`,
      data: {
        type: 'EMAIL',
        expiryMinutes: OTP_EXPIRY_MINUTES,
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      },
    };
  } catch (err) {
    console.error('[OTP] Error sending email OTP:', err.message);
    return {
      success: false,
      message: 'Failed to send OTP',
      error: err.message,
    };
  }
};

/**
 * Send OTP via phone (Firebase)
 * @param {string} phone - Phone number with country code (e.g., +919876543210)
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: string}>}
 */
const sendPhoneOTPViaFirebase = async (phone) => {
  try {
    const normalizedPhone = normalizePhoneToE164(phone);

    // Validate phone format (E.164)
    if (!normalizedPhone.match(/^\+\d{10,15}$/)) {
      return {
        success: false,
        message: 'Invalid phone number. Use E.164 format: +919876543210',
        error: 'INVALID_PHONE_FORMAT',
      };
    }

    // ── DEV MODE: Skip Firebase, generate OTP directly ──────────────────────
    if (process.env.NODE_ENV === 'development') {
      // Check rate limit
      const rateLimitCheck = await checkRateLimit(normalizedPhone, null);
      if (!rateLimitCheck.allowed) {
        return { success: false, message: rateLimitCheck.message, error: 'RATE_LIMIT_EXCEEDED' };
      }

      await OTP.deleteMany({ phone: normalizedPhone, verified: false });

      const otp = generateOTP();
      const hashedOTP = await hashOTP(otp);

      await OTP.create({
        phone: normalizedPhone,
        otpHash: hashedOTP,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        type: 'PHONE',
      });

      console.log(`[DEV] Phone OTP for ${normalizedPhone}: ${otp}`);

      return {
        success: true,
        message: `OTP sent to ${normalizedPhone}`,
        data: {
          type: 'PHONE',
          expiryMinutes: OTP_EXPIRY_MINUTES,
          verificationId: 'dev-mode',
          devOtp: otp, // auto-fill in frontend
        },
      };
    }
    // ── PRODUCTION: Use Firebase ─────────────────────────────────────────────
    // Check rate limit
    const rateLimitCheck = await checkRateLimit(normalizedPhone, null);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: rateLimitCheck.message,
        error: 'RATE_LIMIT_EXCEEDED',
      };
    }

    // Check resend cooldown
    const cooldownCheck = await checkResendCooldown(normalizedPhone, null);
    if (!cooldownCheck.allowed) {
      return {
        success: false,
        message: cooldownCheck.message,
        error: 'RESEND_COOLDOWN_ACTIVE',
        data: { remainingSeconds: cooldownCheck.remainingSeconds },
      };
    }

    // Invalidate any existing OTPs for this phone
    await OTP.deleteMany({ phone: normalizedPhone, verified: false });

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);

    // Get Firebase verification ID
    const firebaseResult = await sendPhoneOTP(normalizedPhone);
    if (!firebaseResult.success) {
      return {
        success: false,
        message: 'Failed to initiate phone OTP',
        error: firebaseResult.error,
      };
    }

    // Save to database
    const otpDoc = await OTP.create({
      phone: normalizedPhone,
      otpHash: hashedOTP,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      type: 'PHONE',
      firebaseVerificationId: firebaseResult.verificationId,
    });

    // In DEV mode, log the OTP. In production, only Firebase sends it.
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Phone OTP for ${normalizedPhone}: ${otp}`);
    }

    return {
      success: true,
      message: `OTP initiated for ${normalizedPhone}`,
      data: {
        type: 'PHONE',
        expiryMinutes: OTP_EXPIRY_MINUTES,
        verificationId: firebaseResult.verificationId, // Client needs this
        // DEV ONLY — never send in production
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      },
    };
  } catch (err) {
    console.error('[OTP] Error sending phone OTP:', err.message);
    return {
      success: false,
      message: 'Failed to send phone OTP',
      error: err.message,
    };
  }
};

/**
 * Unified endpoint: Send OTP via email or phone
 * @param {string} email - optional
 * @param {string} phone - optional (E.164 format)
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: string}>}
 */
const sendOTP = async (email, phone) => {
  if (phone) {
    return sendPhoneOTPViaFirebase(phone);
  } else if (email) {
    return sendEmailOTP(email);
  } else {
    return {
      success: false,
      message: 'Either email or phone must be provided',
      error: 'MISSING_CONTACT_INFO',
    };
  }
};

/**
 * Verify OTP for email
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
const verifyEmailOTP = async (email, otp) => {
  try {
    const otpRecord = await OTP.findOne({ email, verified: false, type: 'EMAIL' });

    if (!otpRecord) {
      return { success: false, message: 'OTP not found or already used', error: 'OTP_NOT_FOUND' };
    }

    // Check expiry
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return { success: false, message: 'OTP has expired', error: 'OTP_EXPIRED' };
    }

    // Check attempts
    const MAX_ATTEMPTS = 5;
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return {
        success: false,
        message: `Too many attempts. Request a new OTP.`,
        error: 'TOO_MANY_ATTEMPTS',
      };
    }

    // Verify hash
    const isValid = await verifyOTPHash(otp, otpRecord.otpHash);
    if (!isValid) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return { success: false, message: 'Invalid OTP', error: 'INVALID_OTP' };
    }

    // Mark OTP as verified
    await OTP.deleteOne({ _id: otpRecord._id });

    return { success: true, message: 'OTP verified successfully' };
  } catch (err) {
    console.error('[OTP] Error verifying email OTP:', err.message);
    return {
      success: false,
      message: 'Verification failed',
      error: err.message,
    };
  }
};

/**
 * Verify OTP for phone
 * @param {string} phone
 * @param {string} otp
 * @param {string} verificationId - Optional, from Firebase
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
const verifyPhoneOTP = async (phone, otp, verificationId) => {
  try {
    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone.match(/^\+\d{10,15}$/)) {
      return {
        success: false,
        message: 'Invalid phone number. Use E.164 format: +919876543210',
        error: 'INVALID_PHONE_FORMAT',
      };
    }

    const phoneCandidates = buildPhoneCandidates(phone);

    const otpRecord = await OTP.findOne({
      phone: { $in: phoneCandidates },
      verified: false,
      type: 'PHONE',
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return { success: false, message: 'OTP not found or already used', error: 'OTP_NOT_FOUND' };
    }

    // Check expiry
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return { success: false, message: 'OTP has expired', error: 'OTP_EXPIRED' };
    }

    // Check attempts
    const MAX_ATTEMPTS = 5;
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return {
        success: false,
        message: 'Too many attempts. Request a new OTP.',
        error: 'TOO_MANY_ATTEMPTS',
      };
    }

    // Verify hash
    const isValid = await verifyOTPHash(otp, otpRecord.otpHash);
    if (!isValid) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return { success: false, message: 'Invalid OTP', error: 'INVALID_OTP' };
    }

    // Mark OTP as verified
    await OTP.deleteOne({ _id: otpRecord._id });

    return { success: true, message: 'OTP verified successfully' };
  } catch (err) {
    console.error('[OTP] Error verifying phone OTP:', err.message);
    return {
      success: false,
      message: 'Verification failed',
      error: err.message,
    };
  }
};

/**
 * Unified verification endpoint
 * @param {string} email - optional
 * @param {string} phone - optional
 * @param {string} otp
 * @param {string} verificationId - optional, for phone OTP
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
const verifyOTP = async (email, phone, otp, verificationId) => {
  if (phone) {
    return verifyPhoneOTP(phone, otp, verificationId);
  } else if (email) {
    return verifyEmailOTP(email, otp);
  } else {
    return {
      success: false,
      message: 'Either email or phone must be provided',
      error: 'MISSING_CONTACT_INFO',
    };
  }
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTPHash,
  checkRateLimit,
  checkResendCooldown,
  sendOTP,
  sendEmailOTP,
  sendPhoneOTPViaFirebase,
  verifyOTP,
  verifyEmailOTP,
  verifyPhoneOTP,
};
