const BookingRequest = require('../models/BookingRequest');
const Ride = require('../models/Ride');
const Transaction = require('../models/Transaction');

/**
 * Aggregates ride and financial analytics for a given user.
 * @param {ObjectId|string} userId
 * @returns {Promise<{totalRides, totalTripsAsDriver, totalEarnings, totalDistanceCoveredKm, totalSpentAsPassenger}>}
 */
async function getUserAnalytics(userId) {
  const [
    totalRidesResult,
    totalTripsAsDriverResult,
    totalEarningsResult,
    totalDistanceResult,
    totalSpentResult,
  ] = await Promise.all([
    // Total completed rides as passenger
    BookingRequest.aggregate([
      { $match: { passengerId: userId, status: 'COMPLETED' } },
      { $count: 'count' },
    ]),

    // Total completed trips as driver
    Ride.aggregate([
      { $match: { driverId: userId, status: 'COMPLETED' } },
      { $count: 'count' },
    ]),

    // Total earnings (driver)
    Transaction.aggregate([
      { $match: { userId, type: 'EARNING' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Total distance covered as driver
    Ride.aggregate([
      { $match: { driverId: userId, status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$distanceKm' } } },
    ]),

    // Total spent as passenger
    Transaction.aggregate([
      { $match: { userId, type: 'CHARGE' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    totalRides:              totalRidesResult[0]?.count ?? 0,
    totalTripsAsDriver:      totalTripsAsDriverResult[0]?.count ?? 0,
    totalEarnings:           totalEarningsResult[0]?.total ?? 0,
    totalDistanceCoveredKm:  totalDistanceResult[0]?.total ?? 0,
    totalSpentAsPassenger:   totalSpentResult[0]?.total ?? 0,
  };
}

module.exports = { getUserAnalytics };
