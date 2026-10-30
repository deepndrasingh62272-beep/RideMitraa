const mongoose = require('mongoose');

/**
 * Emergency contacts for a user — notified on SOS.
 * Max 3 contacts per user enforced at controller level.
 */
const trustedContactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:   { type: String, required: true, trim: true },
    phone:  { type: String, required: true, match: /^[6-9]\d{9}$/ },
    relation: {
      type: String,
      enum: ['FAMILY', 'FRIEND', 'COLLEAGUE', 'OTHER'],
      default: 'OTHER',
    },
  },
  { timestamps: true }
);

trustedContactSchema.index({ userId: 1 });

module.exports = mongoose.model('TrustedContact', trustedContactSchema);
