const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { generateOTP, sendOTP, sendEmailOTP, sendPhoneOTPViaFirebase, verifyOTP, verifyEmailOTP, verifyPhoneOTP } = require('../services/otpService');
const { generateToken, createSession, revokeAllSessions } = require('../utils/jwt');
const { audit } = require('../utils/audit');
const { generateReferralCode, applyReferral } = require('../utils/referral');

const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// Account-level role is retained for backward compatibility only.
// Ride/booking authorization is dynamic and ownership-based.
const normalizeAccountRole = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (['DRIVER', 'PASSENGER', 'USER'].includes(normalized)) return normalized;
  return 'USER';
};

const normalizePhoneForOtp = (value) => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

/**
 * POST /api/auth/send-otp
 * UNIFIED ENDPOINT: Sends OTP via email or phone
 * Body: { email } OR { phone }
 */
exports.sendUnifiedOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone must be provided'
      });
    }

    const result = await sendOTP(email, phone);

    if (!result.success) {
      const statusCode = result.error === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('[AUTH] Error sending unified OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/verify-otp
 * UNIFIED ENDPOINT: Verifies OTP and returns JWT token
 * Body: { email, otp } OR { phone, otp, verificationId? }
 */
exports.verifyUnifiedOTP = async (req, res) => {
  try {
    const { email, phone, otp, role, name, verificationId } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone must be provided'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    // Normalize phone — strip +91 prefix, keep last 10 digits for DB storage
    const normalizedPhone = phone ? phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : null;

    // Verify OTP (use original phone format as stored in OTP collection)
    const otpResult = await verifyOTP(email, phone, otp, verificationId);
    if (!otpResult.success) {
      const statusCode = otpResult.error === 'TOO_MANY_ATTEMPTS' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: otpResult.message,
        error: otpResult.error,
      });
    }

    // Find or create user — search by both formats to handle existing users
    let user;
    if (email) {
      user = await User.findOne({ email });
    } else if (normalizedPhone) {
      user = await User.findOne({ $or: [{ phone: normalizedPhone }, { phone }] });
    }

    let isNewUser = false;
    if (!user) {
      user = await User.create({
        ...(email && { email }),
        ...(normalizedPhone && { phone: normalizedPhone }),
        role: normalizeAccountRole(role),
        name: name || 'User',
        isPhoneVerified: !!phone,
        isEmailVerified: !!email,
        referralCode: generateReferralCode(),
      });
      isNewUser = true;
    } else {
      // Update verification status
      if (email) {
        user.isEmailVerified = true;
        user.email = email;
      }
      if (phone) {
        user.isPhoneVerified = true;
        // Phone is already set
      }
      await user.save();
    }

    // Apply referral if provided for new users
    let referralBonus = null;
    if (isNewUser && req.body.referralCode) {
      try {
        await applyReferral(user._id, req.body.referralCode);
        referralBonus = { applied: true, amount: 50 };
      } catch (refErr) {
        if (refErr.message === 'Invalid referral code') {
          return res.status(400).json({ success: false, error: 'Invalid referral code' });
        }
        if (refErr.message === 'Cannot use your own referral code') {
          return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
        }
        console.error('[AUTH] Referral apply error:', refErr.message);
      }
    }

    // Generate JWT token
    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);

    // Audit log
    audit({ req, user, action: 'USER_LOGIN', resource: 'User', resourceId: user._id });

    const responsePayload = {
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
      },
      // also nested for API clients that use data.token
      data: {
        token,
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          kycStatus: user.kycStatus,
          isPhoneVerified: user.isPhoneVerified,
          isEmailVerified: user.isEmailVerified,
        },
      },
    };
    if (referralBonus) responsePayload.referralBonus = referralBonus;

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[AUTH] Error verifying unified OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/send-phone-otp
 * Dedicated endpoint for phone OTP (legacy support)
 */
exports.sendPhoneOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    const formattedPhone = normalizePhoneForOtp(phone);

    const result = await sendPhoneOTPViaFirebase(formattedPhone);

    if (!result.success) {
      const statusCode = result.error === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('[AUTH] Error sending phone OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to send phone OTP',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/verify-phone-otp
 * Dedicated endpoint for phone OTP verification (legacy support)
 */
exports.verifyPhoneOTPEndpoint = async (req, res) => {
  try {
    const { phone, otp, role, name, verificationId } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    const formattedPhone = normalizePhoneForOtp(phone);

    // Verify OTP
    const otpResult = await verifyPhoneOTP(formattedPhone, otp, verificationId);
    if (!otpResult.success) {
      const statusCode = otpResult.error === 'TOO_MANY_ATTEMPTS' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: otpResult.message,
        error: otpResult.error,
      });
    }

    // Find or create user
    let isNewUser = false;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({
        phone: cleanPhone,
        role: normalizeAccountRole(role),
        name: name || 'User',
        isPhoneVerified: true,
        referralCode: generateReferralCode(),
      });
      isNewUser = true;
    } else {
      user.isPhoneVerified = true;
      await user.save();
    }

    // Apply referral if provided for new users
    let referralBonus = null;
    if (isNewUser && req.body.referralCode) {
      try {
        await applyReferral(user._id, req.body.referralCode);
        referralBonus = { applied: true, amount: 50 };
      } catch (refErr) {
        if (refErr.message === 'Invalid referral code') {
          return res.status(400).json({ success: false, error: 'Invalid referral code' });
        }
        if (refErr.message === 'Cannot use your own referral code') {
          return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
        }
        console.error('[AUTH] Referral apply error:', refErr.message);
      }
    }

    // Generate JWT token
    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);

    // Audit log
    audit({ req, user, action: 'USER_LOGIN', resource: 'User', resourceId: user._id });

    const responsePayload = {
      success: true,
      message: 'Phone OTP verified successfully',
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        isPhoneVerified: user.isPhoneVerified,
      },
      data: {
        token,
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          role: user.role,
          kycStatus: user.kycStatus,
          isPhoneVerified: user.isPhoneVerified,
        },
      },
    };
    if (referralBonus) responsePayload.referralBonus = referralBonus;

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[AUTH] Error verifying phone OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Phone OTP verification failed',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/send-email-otp
 * Dedicated endpoint for email OTP
 */
exports.sendEmailOTPEndpoint = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await sendEmailOTP(email);

    if (!result.success) {
      const statusCode = result.error === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('[AUTH] Error sending email OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to send email OTP',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/verify-email-otp
 * Dedicated endpoint for email OTP verification
 */
exports.verifyEmailOTPEndpoint = async (req, res) => {
  try {
    const { email, otp, role, name } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Verify OTP
    const otpResult = await verifyEmailOTP(email, otp);
    if (!otpResult.success) {
      const statusCode = otpResult.error === 'TOO_MANY_ATTEMPTS' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: otpResult.message,
        error: otpResult.error,
      });
    }

    // Find or create user
    let isNewUser = false;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        role: normalizeAccountRole(role),
        name: name || 'User',
        isEmailVerified: true,
        phone: `TEMP_${Date.now()}`, // Temp phone until user adds real phone
        referralCode: generateReferralCode(),
      });
      isNewUser = true;
    } else {
      user.isEmailVerified = true;
      await user.save();
    }

    // Apply referral if provided for new users
    let referralBonus = null;
    if (isNewUser && req.body.referralCode) {
      try {
        await applyReferral(user._id, req.body.referralCode);
        referralBonus = { applied: true, amount: 50 };
      } catch (refErr) {
        if (refErr.message === 'Invalid referral code') {
          return res.status(400).json({ success: false, error: 'Invalid referral code' });
        }
        if (refErr.message === 'Cannot use your own referral code') {
          return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
        }
        console.error('[AUTH] Referral apply error:', refErr.message);
      }
    }

    // Generate JWT token
    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);

    // Audit log
    audit({ req, user, action: 'USER_LOGIN', resource: 'User', resourceId: user._id });

    const responsePayload = {
      success: true,
      message: 'Email OTP verified successfully',
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        isEmailVerified: user.isEmailVerified,
      },
      data: {
        token,
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          kycStatus: user.kycStatus,
          isEmailVerified: user.isEmailVerified,
        },
      },
    };
    if (referralBonus) responsePayload.referralBonus = referralBonus;

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[AUTH] Error verifying email OTP:', err.message);
    res.status(500).json({
      success: false,
      message: 'Email OTP verification failed',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/guest-login
 * Creates a temporary guest passenger session (no phone required)
 */
exports.guestLogin = async (req, res) => {
  try {
    const guestPhone = `0000${Date.now().toString().slice(-6)}`; // temp placeholder
    const user = await User.create({
      phone: guestPhone,
      role: 'PASSENGER',
      isGuest: true,
      name: 'Guest',
    });

    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);

    res.json({
      success: true,
      message: 'Guest session created',
      data: {
        token,
        userId: user.userId
      }
    });
  } catch (err) {
    console.error('[AUTH] Error creating guest session:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create guest session',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/login
 * Direct login with phone + password (no OTP)
 * Body: { phone, password, role? }
 */
exports.login = async (req, res) => {
  try {
    const { phone, password, role } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    let user = await User.findOne({ phone: cleanPhone }).select('+password');

    let isNewUser = false;
    if (!user) {
      // Auto-create user if not exists
      const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
      user = await User.create({
        phone: cleanPhone,
        role: normalizeAccountRole(role),
        name: req.body.name || 'User',
        isPhoneVerified: true,
        referralCode: generateReferralCode(),
        ...(hashedPassword && { password: hashedPassword }),
      });
      isNewUser = true;
    } else if (password && user.password) {
      // Verify password if user has one set
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    // Apply referral if provided for new users
    let referralBonus = null;
    if (isNewUser && req.body.referralCode) {
      try {
        await applyReferral(user._id, req.body.referralCode);
        referralBonus = { applied: true, amount: 50 };
      } catch (refErr) {
        if (refErr.message === 'Invalid referral code') {
          return res.status(400).json({ success: false, error: 'Invalid referral code' });
        }
        if (refErr.message === 'Cannot use your own referral code') {
          return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
        }
        console.error('[AUTH] Referral apply error:', refErr.message);
      }
    }

    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);
    audit({ req, user, action: 'USER_LOGIN', resource: 'User', resourceId: user._id });

    const userData = {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
      isPhoneVerified: user.isPhoneVerified,
    };

    const responsePayload = {
      success: true,
      message: 'Login successful',
      token,
      user: userData,
      data: { token, user: userData },
    };
    if (referralBonus) responsePayload.referralBonus = referralBonus;

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
};

/**
 * POST /api/auth/quick-login
 * Login with phone only (no password, no OTP) - for dev/testing
 * Body: { phone, role? }
 */
exports.quickLogin = async (req, res) => {
  try {
    const { phone, role } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    let user = await User.findOne({ phone: cleanPhone });

    let isNewUser = false;
    if (!user) {
      user = await User.create({
        phone: cleanPhone,
        role: normalizeAccountRole(role),
        name: req.body.name || 'User',
        isPhoneVerified: true,
        referralCode: generateReferralCode(),
      });
      isNewUser = true;
    }

    // Apply referral if provided for new users
    let referralBonus = null;
    if (isNewUser && req.body.referralCode) {
      try {
        await applyReferral(user._id, req.body.referralCode);
        referralBonus = { applied: true, amount: 50 };
      } catch (refErr) {
        if (refErr.message === 'Invalid referral code') {
          return res.status(400).json({ success: false, error: 'Invalid referral code' });
        }
        if (refErr.message === 'Cannot use your own referral code') {
          return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
        }
        console.error('[AUTH] Referral apply error:', refErr.message);
      }
    }

    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);
    audit({ req, user, action: 'USER_QUICK_LOGIN', resource: 'User', resourceId: user._id });

    const userData = {
      _id: user._id,
      userId: user.userId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
      isPhoneVerified: user.isPhoneVerified,
    };

    const responsePayload = {
      success: true,
      message: 'Quick login successful',
      token,
      user: userData,
      data: { token, user: userData },
    };
    if (referralBonus) responsePayload.referralBonus = referralBonus;

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[AUTH] Quick login error:', err.message);
    res.status(500).json({ success: false, message: 'Quick login failed', error: err.message });
  }
};

/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    await revokeAllSessions(req.user._id);
    audit({ req, user: req.user, action: 'USER_LOGOUT', resource: 'User', resourceId: req.user._id });
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('[AUTH] Error logging out:', err.message);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: err.message,
    });
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    if (!user) return res.status(404).json({
      success: false,
      message: 'User not found'
    });
    
    const kycStatusMap = { PENDING: 'pending', APPROVED: 'verified', REJECTED: 'rejected' };
    const normalizedKycStatus = kycStatusMap[user.kycStatus] ?? 'pending';

    res.json({
      success: true,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        kycStatus: normalizedKycStatus,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
      },
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          kycStatus: normalizedKycStatus,
          isPhoneVerified: user.isPhoneVerified,
          isEmailVerified: user.isEmailVerified,
        }
      }
    });
  } catch (err) {
    console.error('[AUTH] Error fetching user:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: err.message,
    });
  }
};

/**
 * POST /api/auth/refresh
 * Refresh JWT — issue a new token for the currently authenticated user
 */
exports.refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const token = generateToken({ id: user._id, role: user.role });
    await createSession(user._id, token, req.headers['user-agent']);

    res.json({
      success: true,
      message: 'Token refreshed',
      token,
      data: { token },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Token refresh failed', error: err.message });
  }
};

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email via link token (for email verification flows)
 */
exports.verifyEmailToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    // Find OTP record by token (stored as otp field for email verification links)
    const otpRecord = await OTP.findOne({ otp: token, type: 'EMAIL', verified: false });
    if (!otpRecord) return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });

    const user = await User.findOne({ email: otpRecord.email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isEmailVerified = true;
    await user.save();
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Email verification failed', error: err.message });
  }
};
