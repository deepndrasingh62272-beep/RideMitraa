const mongoose = require('mongoose');

const KYC_STATUS = ['PENDING', 'APPROVED', 'REJECTED'];

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: { type: String, trim: true },
    phone: { type: String, required: true, unique: true, match: /^(\+\d{1,3})?\d{10}$/ },
    email: { type: String, lowercase: true, sparse: true },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'],
      default: 'UNSPECIFIED',
    },
    // Deprecated for ride/booking authorization (kept for backward compatibility only).
    role: { type: String, enum: ['DRIVER', 'PASSENGER', 'USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT'], default: 'USER' },
    isGuest: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },

    // Driver-specific
    kycStatus: { type: String, enum: KYC_STATUS, default: 'PENDING' },
    kycDocuments: {
      govtId: { type: String },          // Cloudinary secure URL
      govtIdType: { type: String, enum: ['AADHAR', 'DRIVING_LICENSE'] },
      rc: { type: String },              // Registration Certificate
      insurance: { type: String },
      pollutionCert: { type: String },
      selfie: { type: String },
    },
    kycRejectionReason: { type: String },

    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 },

    // Face verification
    faceVerified: { type: Boolean, default: false },
    faceVerificationMeta: {
      similarity:  { type: Number },
      skipped:     { type: Boolean },
      verifiedAt:  { type: Date },
    },

    // Profile photo
    profilePhoto: { type: String, default: null },

    // Password (optional - for direct login)
    password: { type: String, select: false },

    // GDPR / account deletion
    deletedAt: { type: Date, default: null },
    banReason: { type: String, default: null },

    // Cancellation tracking
    cancellationCount:    { type: Number, default: 0 },
    cancellationBlockedUntil: { type: Date, default: null },

    // Advanced features
    trustScore:   { type: Number, default: 50, min: 0, max: 100 },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Cached wallet balance for quick reads (source of truth remains Wallet collection)
    walletBalance: { type: Number, default: 0, min: 0 },

    // Emergency contacts
    emergencyContacts: [
      {
        id: String,
        name: String,
        phone: String,
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

