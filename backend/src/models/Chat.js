const mongoose = require('mongoose');

/**
 * One Chat document per booking — created automatically when driver accepts.
 * Messages are stored in a separate collection for scalability.
 */
const chatSchema = new mongoose.Schema(
  {
    bookingId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest', required: true, unique: true },
    rideId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ride',           required: true },
    driverId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',           required: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',           required: true },

    // Unread counters — keyed by userId string for O(1) lookup
    unreadCount: {
      type:    Map,
      of:      Number,
      default: {},
    },

    lastMessage: {
      text:      { type: String },
      senderId:  { type: mongoose.Schema.Types.ObjectId },
      sentAt:    { type: Date },
    },

    // Chat is locked once ride is completed / cancelled
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatSchema.index({ rideId: 1 });
chatSchema.index({ driverId: 1 });
chatSchema.index({ passengerId: 1 });

module.exports = mongoose.model('Chat', chatSchema);
