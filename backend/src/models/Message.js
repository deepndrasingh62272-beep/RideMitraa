const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chatId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    rideId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    text: { type: String, required: true, maxlength: 1000 },

    // AI moderation result
    moderation: {
      flagged:    { type: Boolean, default: false },
      categories: { type: [String], default: [] }, // e.g. ['harassment', 'profanity']
      score:      { type: Number },                // 0–1 confidence
    },

    isDeleted: { type: Boolean, default: false },  // soft delete

    // Read receipts — array of userIds who have read this message
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ rideId: 1 });
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
