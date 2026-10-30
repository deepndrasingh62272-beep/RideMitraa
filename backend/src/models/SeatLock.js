const mongoose = require('mongoose');

const seatLockSchema = new mongoose.Schema(
  {
    // Reference to the ride/booking
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true,
    },
    
    // User who locked the seat
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Seat number/identifier
    seatNumber: {
      type: String,
      required: true,
    },
    
    // Lock status: LOCKED, CONFIRMED, RELEASED, EXPIRED
    status: {
      type: String,
      enum: ['LOCKED', 'CONFIRMED', 'RELEASED', 'EXPIRED'],
      default: 'LOCKED',
      index: true,
    },
    
    // Lock expiry time (5 minutes from creation)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      // Auto-delete expired locks after 5 minutes
      expires: 300,
    },
    
    // When lock was created
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    
    // When lock was confirmed (booking completed)
    confirmedAt: {
      type: Date,
      default: null,
    },
    
    // When lock was released
    releasedAt: {
      type: Date,
      default: null,
    },
    
    // Session/transaction ID for tracking
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      reason: String, // BOOKING, CANCELLATION, EXPIRY, etc.
    },
  },
  {
    timestamps: true,
    collection: 'seatLocks',
  }
);

// Compound index for unique seat lock per ride
seatLockSchema.index({ rideId: 1, seatNumber: 1, status: 1 });

// Index for finding active locks
seatLockSchema.index({ rideId: 1, status: 1, expiresAt: 1 });

// Index for cleanup queries
seatLockSchema.index({ userId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('SeatLock', seatLockSchema);
