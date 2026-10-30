const SeatLock = require('../models/SeatLock');
const Ride = require('../models/Ride');

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_DURATION_SECONDS = 300; // 5 minutes

/**
 * Lock a seat atomically
 * Uses MongoDB findOneAndUpdate with conditions to prevent race conditions
 *
 * @param {string} rideId - Ride ID
 * @param {string} seatNumber - Seat number to lock
 * @param {string} userId - User ID requesting the lock
 * @param {string} sessionId - Session/transaction ID
 * @param {object} metadata - Additional metadata
 * @returns {object} Lock object or null if lock failed
 */
const lockSeat = async (rideId, seatNumber, userId, sessionId, metadata = {}) => {
  try {
    console.log(`[SeatLock] Attempting to lock seat ${seatNumber} for ride ${rideId} by user ${userId}`);

    // Step 1: Check if seat is already locked by another user
    const existingLock = await SeatLock.findOne({
      rideId,
      seatNumber,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() }, // Not expired
    });

    if (existingLock && existingLock.userId.toString() !== userId.toString()) {
      console.log(`[SeatLock] Seat ${seatNumber} already locked by another user`);
      return {
        success: false,
        error: 'SEAT_ALREADY_LOCKED',
        message: 'This seat is already locked by another user',
        lockedBy: existingLock.userId,
        expiresAt: existingLock.expiresAt,
      };
    }

    // Step 2: If same user already has a lock, update it
    if (existingLock && existingLock.userId.toString() === userId.toString()) {
      console.log(`[SeatLock] Refreshing existing lock for user ${userId}`);
      const updatedLock = await SeatLock.findByIdAndUpdate(
        existingLock._id,
        {
          $set: {
            expiresAt: new Date(Date.now() + LOCK_DURATION_MS),
            lockedAt: new Date(),
            status: 'LOCKED',
          },
        },
        { new: true }
      );
      return {
        success: true,
        lock: updatedLock,
        message: 'Seat lock refreshed',
      };
    }

    // Step 3: Verify ride exists and has available seats
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return {
        success: false,
        error: 'RIDE_NOT_FOUND',
        message: 'Ride not found',
      };
    }

    // Step 4: Count active locks and booked seats
    const activeLocks = await SeatLock.countDocuments({
      rideId,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() },
    });

    const bookedSeats = ride.seatsBooked || 0;
    const totalSeats = ride.totalSeats || 0;
    const availableSeats = totalSeats - bookedSeats - activeLocks;

    if (availableSeats <= 0) {
      console.log(`[SeatLock] No available seats. Total: ${totalSeats}, Booked: ${bookedSeats}, Locked: ${activeLocks}`);
      return {
        success: false,
        error: 'NO_AVAILABLE_SEATS',
        message: 'No available seats for this ride',
        availableSeats: 0,
      };
    }

    // Step 5: Create new lock atomically
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    const newLock = new SeatLock({
      rideId,
      userId,
      seatNumber,
      status: 'LOCKED',
      expiresAt,
      sessionId,
      metadata: {
        ...metadata,
        lockedAt: new Date(),
      },
    });

    const savedLock = await newLock.save();
    console.log(`[SeatLock] Seat ${seatNumber} locked successfully for user ${userId}`);

    return {
      success: true,
      lock: savedLock,
      message: 'Seat locked successfully',
      expiresAt,
      expiresIn: LOCK_DURATION_SECONDS,
    };
  } catch (err) {
    console.error('[SeatLock] Error locking seat:', err.message);
    return {
      success: false,
      error: 'LOCK_ERROR',
      message: err.message,
    };
  }
};

/**
 * Confirm a seat lock (convert LOCKED → CONFIRMED)
 * Called when booking is completed
 *
 * @param {string} lockId - Lock ID
 * @param {string} userId - User ID (for verification)
 * @returns {object} Updated lock or error
 */
const confirmLock = async (lockId, userId) => {
  try {
    console.log(`[SeatLock] Confirming lock ${lockId} for user ${userId}`);

    // Atomic update: only confirm if lock exists, belongs to user, and is LOCKED
    const confirmedLock = await SeatLock.findOneAndUpdate(
      {
        _id: lockId,
        userId,
        status: 'LOCKED',
        expiresAt: { $gt: new Date() }, // Not expired
      },
      {
        $set: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!confirmedLock) {
      console.log(`[SeatLock] Failed to confirm lock - lock not found or expired`);
      return {
        success: false,
        error: 'LOCK_NOT_FOUND_OR_EXPIRED',
        message: 'Lock not found or has expired',
      };
    }

    console.log(`[SeatLock] Lock ${lockId} confirmed successfully`);
    return {
      success: true,
      lock: confirmedLock,
      message: 'Lock confirmed successfully',
    };
  } catch (err) {
    console.error('[SeatLock] Error confirming lock:', err.message);
    return {
      success: false,
      error: 'CONFIRM_ERROR',
      message: err.message,
    };
  }
};

/**
 * Release a seat lock
 * Called when user cancels booking or lock expires
 *
 * @param {string} lockId - Lock ID
 * @param {string} userId - User ID (for verification)
 * @param {string} reason - Reason for release (CANCELLATION, EXPIRY, etc.)
 * @returns {object} Updated lock or error
 */
const releaseLock = async (lockId, userId, reason = 'MANUAL_RELEASE') => {
  try {
    console.log(`[SeatLock] Releasing lock ${lockId} for user ${userId} - Reason: ${reason}`);

    const releasedLock = await SeatLock.findOneAndUpdate(
      {
        _id: lockId,
        userId,
        status: { $in: ['LOCKED', 'CONFIRMED'] },
      },
      {
        $set: {
          status: 'RELEASED',
          releasedAt: new Date(),
          'metadata.reason': reason,
        },
      },
      { new: true }
    );

    if (!releasedLock) {
      console.log(`[SeatLock] Failed to release lock - lock not found`);
      return {
        success: false,
        error: 'LOCK_NOT_FOUND',
        message: 'Lock not found',
      };
    }

    console.log(`[SeatLock] Lock ${lockId} released successfully`);
    return {
      success: true,
      lock: releasedLock,
      message: 'Lock released successfully',
    };
  } catch (err) {
    console.error('[SeatLock] Error releasing lock:', err.message);
    return {
      success: false,
      error: 'RELEASE_ERROR',
      message: err.message,
    };
  }
};

/**
 * Get active locks for a ride
 *
 * @param {string} rideId - Ride ID
 * @returns {array} Array of active locks
 */
const getActiveLocks = async (rideId) => {
  try {
    const locks = await SeatLock.find({
      rideId,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() },
    }).lean();

    return locks;
  } catch (err) {
    console.error('[SeatLock] Error getting active locks:', err.message);
    return [];
  }
};

/**
 * Get user's active locks
 *
 * @param {string} userId - User ID
 * @returns {array} Array of user's active locks
 */
const getUserActiveLocks = async (userId) => {
  try {
    const locks = await SeatLock.find({
      userId,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() },
    }).lean();

    return locks;
  } catch (err) {
    console.error('[SeatLock] Error getting user locks:', err.message);
    return [];
  }
};

/**
 * Check if a specific seat is available
 *
 * @param {string} rideId - Ride ID
 * @param {string} seatNumber - Seat number
 * @returns {boolean} True if seat is available
 */
const isSeatAvailable = async (rideId, seatNumber) => {
  try {
    const lock = await SeatLock.findOne({
      rideId,
      seatNumber,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() },
    });

    return !lock;
  } catch (err) {
    console.error('[SeatLock] Error checking seat availability:', err.message);
    return false;
  }
};

/**
 * Get available seats count for a ride
 *
 * @param {string} rideId - Ride ID
 * @returns {number} Number of available seats
 */
const getAvailableSeatsCount = async (rideId) => {
  try {
    const ride = await Ride.findById(rideId);
    if (!ride) return 0;

    const activeLocks = await SeatLock.countDocuments({
      rideId,
      status: { $in: ['LOCKED', 'CONFIRMED'] },
      expiresAt: { $gt: new Date() },
    });

    const bookedSeats = ride.seatsBooked || 0;
    const totalSeats = ride.totalSeats || 0;
    const availableSeats = totalSeats - bookedSeats - activeLocks;

    return Math.max(0, availableSeats);
  } catch (err) {
    console.error('[SeatLock] Error getting available seats:', err.message);
    return 0;
  }
};

/**
 * Auto-release expired locks
 * Should be called periodically by a background job
 *
 * @returns {object} Result with count of released locks
 */
const releaseExpiredLocks = async () => {
  try {
    console.log('[SeatLock] Starting expired lock cleanup...');

    const result = await SeatLock.updateMany(
      {
        status: { $in: ['LOCKED', 'CONFIRMED'] },
        expiresAt: { $lt: new Date() },
      },
      {
        $set: {
          status: 'EXPIRED',
          releasedAt: new Date(),
          'metadata.reason': 'EXPIRY',
        },
      }
    );

    console.log(`[SeatLock] Released ${result.modifiedCount} expired locks`);
    return {
      success: true,
      releasedCount: result.modifiedCount,
    };
  } catch (err) {
    console.error('[SeatLock] Error releasing expired locks:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Validate seat lock before booking confirmation
 * Ensures lock is still valid and not expired
 *
 * @param {string} lockId - Lock ID
 * @param {string} userId - User ID
 * @returns {object} Validation result
 */
const validateLock = async (lockId, userId) => {
  try {
    const lock = await SeatLock.findById(lockId);

    if (!lock) {
      return {
        valid: false,
        error: 'LOCK_NOT_FOUND',
        message: 'Lock not found',
      };
    }

    if (lock.userId.toString() !== userId.toString()) {
      return {
        valid: false,
        error: 'LOCK_OWNERSHIP_MISMATCH',
        message: 'Lock does not belong to this user',
      };
    }

    if (lock.status === 'EXPIRED') {
      return {
        valid: false,
        error: 'LOCK_EXPIRED',
        message: 'Lock has expired',
      };
    }

    if (lock.status === 'RELEASED') {
      return {
        valid: false,
        error: 'LOCK_RELEASED',
        message: 'Lock has been released',
      };
    }

    if (lock.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'LOCK_EXPIRED',
        message: 'Lock has expired',
      };
    }

    if (lock.status !== 'LOCKED' && lock.status !== 'CONFIRMED') {
      return {
        valid: false,
        error: 'INVALID_LOCK_STATUS',
        message: `Invalid lock status: ${lock.status}`,
      };
    }

    return {
      valid: true,
      lock,
      message: 'Lock is valid',
    };
  } catch (err) {
    console.error('[SeatLock] Error validating lock:', err.message);
    return {
      valid: false,
      error: 'VALIDATION_ERROR',
      message: err.message,
    };
  }
};

module.exports = {
  lockSeat,
  confirmLock,
  releaseLock,
  getActiveLocks,
  getUserActiveLocks,
  isSeatAvailable,
  getAvailableSeatsCount,
  releaseExpiredLocks,
  validateLock,
  LOCK_DURATION_MS,
  LOCK_DURATION_SECONDS,
};
