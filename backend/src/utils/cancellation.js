const User = require('../models/User');
const Ride = require('../models/Ride');
const { getPlatformConfig } = require('../services/platformConfigService');

// Penalty config
const DRIVER_RATING_DROP        = 0.2;   // deducted from driver rating per cancel
const DRIVER_BLOCK_MS           = 7 * 60 * 1000; // 7-minute temp block

/**
 * Apply passenger cancellation penalty.
 * - Before ACCEPTED: no penalty
 * - After ACCEPTED:  10% of totalAmount deducted (recorded, not charged here)
 *
 * Returns { penaltyApplied, penaltyAmount }
 */
exports.applyPassengerPenalty = async (booking) => {
  if (booking.status !== 'ACCEPTED') {
    return { penaltyApplied: false, penaltyAmount: 0 };
  }

  const cfg = await getPlatformConfig();
  const penaltyPercent = Number(cfg?.penalties?.passengerCancellationPercent ?? 0.1);

  const penaltyAmount = parseFloat(
    (booking.totalAmount * penaltyPercent).toFixed(2)
  );

  // Increment passenger cancellation count
  await User.findByIdAndUpdate(booking.passengerId, {
    $inc: { cancellationCount: 1 },
  });

  return { penaltyApplied: true, penaltyAmount };
};

/**
 * Apply driver cancellation penalty.
 * - Rating drop
 * - Temporary block (cancellationBlockedUntil)
 * - Restore ride seats + status
 *
 * Returns { penaltyApplied, penaltyAmount: 0, blockedUntil }
 */
exports.applyDriverPenalty = async (booking) => {
  const blockedUntil = new Date(Date.now() + DRIVER_BLOCK_MS);

  const driver = await User.findById(booking.driverId);
  if (driver) {
    // Drop rating, floor at 1.0
    driver.rating = Math.max(1.0, parseFloat((driver.rating - DRIVER_RATING_DROP).toFixed(1)));
    driver.cancellationCount      += 1;
    driver.cancellationBlockedUntil = blockedUntil;
    await driver.save();
  }

  // Restore seats on the ride
  await Ride.findByIdAndUpdate(booking.rideId, {
    $inc: { availableSeats: booking.passengersCount },
    $set: { status: 'BOOKING_OPEN' },
  });

  return { penaltyApplied: true, penaltyAmount: 0, blockedUntil };
};
