const seatLockService = require('../services/seatLockService');
const SeatLock = require('../models/SeatLock');

/**
 * POST /api/seat-locks/lock
 * Lock a seat for a ride
 */
exports.lockSeat = async (req, res) => {
  try {
    const { rideId, seatNumber } = req.body;
    const userId = req.user._id;
    const sessionId = req.sessionID || `session_${Date.now()}`;

    // Validation
    if (!rideId || !seatNumber) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'rideId and seatNumber are required',
      });
    }

    // Attempt to lock seat
    const result = await seatLockService.lockSeat(
      rideId,
      seatNumber,
      userId,
      sessionId,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json({
      success: true,
      data: result.lock,
      expiresIn: result.expiresIn,
      message: result.message,
    });
  } catch (err) {
    console.error('[SeatLock] Error in lockSeat controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'LOCK_ERROR',
      message: err.message,
    });
  }
};

/**
 * POST /api/seat-locks/:lockId/confirm
 * Confirm a seat lock (convert to CONFIRMED)
 */
exports.confirmLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user._id;

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_LOCK_ID',
        message: 'lockId is required',
      });
    }

    const result = await seatLockService.confirmLock(lockId, userId);

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json({
      success: true,
      data: result.lock,
      message: result.message,
    });
  } catch (err) {
    console.error('[SeatLock] Error in confirmLock controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'CONFIRM_ERROR',
      message: err.message,
    });
  }
};

/**
 * POST /api/seat-locks/:lockId/release
 * Release a seat lock
 */
exports.releaseLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_LOCK_ID',
        message: 'lockId is required',
      });
    }

    const result = await seatLockService.releaseLock(lockId, userId, reason || 'MANUAL_RELEASE');

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json({
      success: true,
      data: result.lock,
      message: result.message,
    });
  } catch (err) {
    console.error('[SeatLock] Error in releaseLock controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'RELEASE_ERROR',
      message: err.message,
    });
  }
};

/**
 * GET /api/seat-locks/ride/:rideId
 * Get all active locks for a ride
 */
exports.getRideLocks = async (req, res) => {
  try {
    const { rideId } = req.params;

    if (!rideId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_RIDE_ID',
        message: 'rideId is required',
      });
    }

    const locks = await seatLockService.getActiveLocks(rideId);
    const availableSeats = await seatLockService.getAvailableSeatsCount(rideId);

    res.json({
      success: true,
      data: {
        locks,
        lockedSeatsCount: locks.length,
        availableSeats,
      },
    });
  } catch (err) {
    console.error('[SeatLock] Error in getRideLocks controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: err.message,
    });
  }
};

/**
 * GET /api/seat-locks/user/active
 * Get user's active locks
 */
exports.getUserLocks = async (req, res) => {
  try {
    const userId = req.user._id;

    const locks = await seatLockService.getUserActiveLocks(userId);

    res.json({
      success: true,
      data: locks,
      count: locks.length,
    });
  } catch (err) {
    console.error('[SeatLock] Error in getUserLocks controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: err.message,
    });
  }
};

/**
 * GET /api/seat-locks/:lockId/validate
 * Validate a seat lock
 */
exports.validateLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user._id;

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_LOCK_ID',
        message: 'lockId is required',
      });
    }

    const result = await seatLockService.validateLock(lockId, userId);

    res.json(result);
  } catch (err) {
    console.error('[SeatLock] Error in validateLock controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message,
    });
  }
};

/**
 * GET /api/seat-locks/ride/:rideId/available
 * Check if a specific seat is available
 */
exports.checkSeatAvailability = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { seatNumber } = req.query;

    if (!rideId || !seatNumber) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'rideId and seatNumber are required',
      });
    }

    const isAvailable = await seatLockService.isSeatAvailable(rideId, seatNumber);

    res.json({
      success: true,
      data: {
        seatNumber,
        isAvailable,
      },
    });
  } catch (err) {
    console.error('[SeatLock] Error in checkSeatAvailability controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'CHECK_ERROR',
      message: err.message,
    });
  }
};

/**
 * POST /api/seat-locks/cleanup
 * Manually trigger cleanup of expired locks (admin only)
 */
exports.cleanupExpiredLocks = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can trigger cleanup',
      });
    }

    const result = await seatLockService.releaseExpiredLocks();

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[SeatLock] Error in cleanupExpiredLocks controller:', err.message);
    res.status(500).json({
      success: false,
      error: 'CLEANUP_ERROR',
      message: err.message,
    });
  }
};
