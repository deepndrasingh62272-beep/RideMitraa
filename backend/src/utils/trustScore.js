const User = require('../models/User');
const BookingRequest = require('../models/BookingRequest');
const Ride = require('../models/Ride');

/**
 * Pure function to calculate trust score from user stats.
 * @param {Object} params
 * @param {number} params.rating - User rating in [1, 5]
 * @param {number} params.completedRides - Number of completed rides
 * @param {number} params.cancelledRides - Number of cancelled rides
 * @param {number} params.cancellationCount - Raw cancellation count
 * @param {string} params.kycStatus - User KYC status
 * @returns {number} Trust score clamped to [0, 100]
 */
function calculateTrustScore({ rating, completedRides, cancelledRides, cancellationCount, kycStatus }) {
  const ratingNormalized = (rating - 1) / 4;

  const total = completedRides + cancelledRides;
  const completionRateNormalized = total === 0 ? 1.0 : completedRides / total;

  const cancellationPenaltyNormalized = Math.max(0, 1 - cancellationCount / 10);

  const status = String(kycStatus || 'PENDING').toUpperCase();
  const kycNormalized = status === 'APPROVED' ? 1 : status === 'REJECTED' ? 0 : 0.5;

  const score =
    (ratingNormalized * 0.45 +
      completionRateNormalized * 0.25 +
      cancellationPenaltyNormalized * 0.2 +
      kycNormalized * 0.1) *
    100;

  return Math.min(100, Math.max(0, score));
}

/**
 * Aggregates user stats from DB and atomically updates trustScore on the User document.
 * @param {string|ObjectId} userId
 * @returns {Promise<User>} Updated user document
 */
async function recalculateTrustScore(userId) {
  // Count completed and cancelled bookings as passenger
  const [completedAgg, cancelledAgg] = await Promise.all([
    BookingRequest.countDocuments({ passengerId: userId, status: 'COMPLETED' }),
    BookingRequest.countDocuments({ passengerId: userId, status: 'CANCELLED' }),
  ]);

  // Count completed rides as driver
  const completedAsDriver = await Ride.countDocuments({ driverId: userId, status: 'COMPLETED' });

  // Fetch user for rating and cancellationCount
  const user = await User.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const totalCompleted = completedAgg + completedAsDriver;
  const score = calculateTrustScore({
    rating: user.rating,
    completedRides: totalCompleted,
    cancelledRides: cancelledAgg,
    cancellationCount: user.cancellationCount,
    kycStatus: user.kycStatus,
  });

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { trustScore: score } },
    { new: true }
  );

  return updated;
}

module.exports = { calculateTrustScore, recalculateTrustScore };
