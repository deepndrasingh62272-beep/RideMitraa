const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'NEW_BOOKING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'RIDE_STARTED',
  'RIDE_COMPLETED',
  'SOS_ALERT',
  'RATING_RECEIVED',
  'DRIVER_NEARBY',
  'REFERRAL_BONUS',
];

const notificationSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:     { type: String, enum: NOTIFICATION_TYPES, required: true },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    data:     { type: mongoose.Schema.Types.Mixed, default: {} }, // extra context (bookingId, rideId, etc.)
    read:     { type: Boolean, default: false },
    readAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
