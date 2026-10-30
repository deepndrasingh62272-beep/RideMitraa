const mongoose = require('mongoose');

// Tracks active refresh tokens for revocation support
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  deviceInfo: { type: String },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
