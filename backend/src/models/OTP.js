const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema(
  {
    // Contact info - either phone or email must be present
    phone: { type: String, sparse: true },
    email: { type: String, lowercase: true, sparse: true },

    // Store hashed OTP using bcrypt (not crypto hash anymore)
    otpHash: { type: String, required: true },

    // OTP type: PHONE or EMAIL
    type: {
      type: String,
      enum: ['PHONE', 'EMAIL'],
      required: true,
      default: 'PHONE',
    },

    // Expiry timestamp
    expiresAt: { type: Date, required: true },

    // Verification status
    verified: { type: Boolean, default: false },

    // Number of failed verification attempts
    attempts: { type: Number, default: 0 },

    // Firebase verification ID (for phone OTP)
    firebaseVerificationId: { type: String, sparse: true },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs via TTL index
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for quick lookups
otpSchema.index({ phone: 1, verified: 1 });
otpSchema.index({ email: 1, verified: 1 });

// Unique sparse indexes to prevent duplicate active OTPs
otpSchema.index({ phone: 1, verified: 1 }, { sparse: true });
otpSchema.index({ email: 1, verified: 1 }, { sparse: true });

// Static method for backward compatibility (now using bcrypt in service)
otpSchema.statics.hashOTP = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

module.exports = mongoose.model('OTP', otpSchema);
