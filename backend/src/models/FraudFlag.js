const mongoose = require('mongoose');

/**
 * Tracks suspicious user behaviour for anti-fraud monitoring.
 * Each document represents one flagged event per user.
 */
const fraudFlagSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    flagType:  {
      type: String,
      enum: ['DUPLICATE_BOOKING', 'EXCESSIVE_CANCELLATIONS', 'RAPID_REQUESTS', 'FACE_MISMATCH', 'LOW_RATING'],
      required: true,
    },
    count:     { type: Number, default: 1 },   // rolling count within the window
    windowStart: { type: Date, required: true }, // start of the detection window
    resolved:  { type: Boolean, default: false },
    meta:      { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

fraudFlagSchema.index({ userId: 1, flagType: 1, windowStart: 1 });

module.exports = mongoose.model('FraudFlag', fraudFlagSchema);
