const mongoose = require('mongoose');

const platformConfigSchema = new mongoose.Schema(
  {
    configKey: { type: String, unique: true, default: 'GLOBAL' },
    pricing: {
      defaultFuelPrice: { type: Number, default: 103, min: 1 },
      platformFeePercent: { type: Number, default: 0.1, min: 0, max: 1 },
    },
    penalties: {
      passengerCancellationPercent: { type: Number, default: 0.1, min: 0, max: 1 },
      waitPenaltyPerMinute: { type: Number, default: 2, min: 0 },
      freeWaitMinutes: { type: Number, default: 5, min: 0, max: 60 },
      autoCancelWaitMinutes: { type: Number, default: 15, min: 1, max: 180 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
