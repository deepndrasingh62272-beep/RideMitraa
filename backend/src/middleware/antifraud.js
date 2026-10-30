const BookingRequest = require('../models/BookingRequest');
const FraudFlag      = require('../models/FraudFlag');
const { audit }      = require('../utils/audit');

const DUPLICATE_WINDOW_MS      = 10 * 60 * 1000; // 10 minutes
const CANCELLATION_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const MAX_CANCELLATIONS        = parseInt(process.env.MAX_CANCELLATIONS_PER_HOUR) || 3;
const MAX_DUPLICATE_BOOKINGS   = parseInt(process.env.MAX_DUPLICATE_BOOKINGS)     || 2;

/**
 * Middleware: blocks duplicate booking attempts for the same ride within a window.
 * Attach to POST /api/bookings
 */
exports.checkDuplicateBooking = async (req, res, next) => {
  try {
    const { rideId } = req.body;
    const userId     = req.user._id;
    const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS);

    const recentCount = await BookingRequest.countDocuments({
      passengerId: userId,
      rideId,
      createdAt:   { $gte: windowStart },
      status:      { $in: ['PENDING', 'ACCEPTED', 'ONGOING'] },
    });

    if (recentCount >= MAX_DUPLICATE_BOOKINGS) {
      await _recordFlag(userId, 'DUPLICATE_BOOKING', windowStart, { rideId });
      audit({
        req,
        user:     req.user,
        action:   'FRAUD_DUPLICATE_BOOKING_BLOCKED',
        resource: 'BookingRequest',
        meta:     { rideId, recentCount },
        severity: 'WARN',
      });
      return res.status(429).json({
        error: 'Duplicate booking detected. Please wait before trying again.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: blocks users who cancel too frequently within a rolling window.
 * Attach to POST /api/bookings/:id/cancel
 */
exports.checkCancellationRate = async (req, res, next) => {
  try {
    const userId      = req.user._id;
    const windowStart = new Date(Date.now() - CANCELLATION_WINDOW_MS);

    const cancelCount = await BookingRequest.countDocuments({
      passengerId: userId,
      status:      'CANCELLED',
      updatedAt:   { $gte: windowStart },
    });

    if (cancelCount >= MAX_CANCELLATIONS) {
      await _recordFlag(userId, 'EXCESSIVE_CANCELLATIONS', windowStart, { cancelCount });
      audit({
        req,
        user:     req.user,
        action:   'FRAUD_EXCESSIVE_CANCELLATIONS_BLOCKED',
        resource: 'BookingRequest',
        meta:     { cancelCount, windowHours: 1 },
        severity: 'WARN',
      });
      return res.status(429).json({
        error: `Too many cancellations. You have cancelled ${cancelCount} bookings in the last hour.`,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Upserts a FraudFlag record, incrementing the count within the same window.
 */
const _recordFlag = async (userId, flagType, windowStart, meta) => {
  await FraudFlag.findOneAndUpdate(
    { userId, flagType, windowStart },
    { $inc: { count: 1 }, $set: { meta } },
    { upsert: true, new: true }
  );
};

/**
 * Middleware: blocks a driver from accepting new bookings while temporarily blocked
 * due to a recent cancellation penalty.
 * Attach to POST /api/bookings/:id/accept
 */
exports.checkDriverCancellationBlock = async (req, res, next) => {
  try {
    const user = req.user;
    // In carpooling, any user acting as ride owner can be blocked
    if (user.cancellationBlockedUntil && user.cancellationBlockedUntil > new Date()) {
      const remainingSecs = Math.ceil(
        (user.cancellationBlockedUntil - Date.now()) / 1000
      );
      return res.status(403).json({
        error: `You are temporarily blocked from accepting bookings due to a recent cancellation. Try again in ${remainingSecs}s.`,
        blockedUntil: user.cancellationBlockedUntil,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};
