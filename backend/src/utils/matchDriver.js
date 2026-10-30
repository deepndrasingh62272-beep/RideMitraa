const mongoose = require('mongoose');
const Ride          = require('../models/Ride');
const User          = require('../models/User');
const RideLocation  = require('../models/RideLocation');
const { haversine } = require('./haversine');

// Scoring weights — must sum to 1.0
const W_DISTANCE = 0.5;
const W_RATING   = 0.3;
const W_SEATS    = 0.2;

// Search radius for candidate rides (km)
const SEARCH_RADIUS_KM = 15;

/**
 * Score a candidate ride on a 0–1 scale.
 *
 * @param {Object} ride         - Ride document (with driverRating attached)
 * @param {number} distanceKm   - Distance from passenger pickup to ride pickup
 * @param {number} seatsNeeded  - Seats the passenger needs
 * @returns {number} composite score (higher = better)
 */
const scoreRide = (ride, distanceKm, seatsNeeded) => {
  // Distance score: closer = higher (normalised against search radius)
  const distScore = Math.max(0, 1 - distanceKm / SEARCH_RADIUS_KM);

  // Rating score: normalised 1–5 → 0–1
  const ratingScore = (ride._driverRating - 1) / 4;

  // Availability score: more spare seats = higher
  const availScore = Math.min(1, (ride.availableSeats - seatsNeeded) / ride.totalSeats + 0.2);

  return W_DISTANCE * distScore + W_RATING * ratingScore + W_SEATS * availScore;
};

/**
 * Find the best alternative ride for a passenger after their booking was rejected.
 *
 * Strategy:
 *  1. Load the rejected booking to get passenger pickup coords + seats needed.
 *  2. Find BOOKING_OPEN rides near that pickup (geo query), same departure date,
 *     excluding the driver who just rejected.
 *  3. Exclude drivers who are currently blocked (cancellationBlockedUntil).
 *  4. Score each candidate by distance + driver rating + available seats.
 *  5. Return the top-ranked ride (or null if none found).
 *
 * @param {string|ObjectId} bookingId  - The rejected BookingRequest _id
 * @returns {{ ride, score } | null}
 */
const findNextBestDriver = async (bookingId) => {
  const BookingRequest = require('../models/BookingRequest');

  const booking = await BookingRequest.findById(bookingId).lean();
  if (!booking) return null;

  const { passengersCount, rideId, driverId: rejectedDriverId } = booking;

  // Get the original ride for departure date + pickup coords reference
  const originalRide = await Ride.findById(rideId).lean();
  if (!originalRide) return null;

  const passengerCoords = booking.pickup.coordinates.coordinates; // [lng, lat]
  const departureDate   = originalRide.schedule.date;

  // Date window: same calendar day (IST)
  const dayStart = new Date(`${departureDate}T00:00:00+05:30`);
  const dayEnd   = new Date(`${departureDate}T23:59:59+05:30`);

  // 1. Geo-query: rides with pickup within radius, correct date, enough seats
  const candidates = await Ride.find({
    status:         'BOOKING_OPEN',
    availableSeats: { $gte: passengersCount },
    driverId:       { $ne: rejectedDriverId },
    'schedule.departureAt': { $gte: dayStart, $lte: dayEnd },
    'pickup.coordinates': {
      $near: {
        $geometry:    { type: 'Point', coordinates: passengerCoords },
        $maxDistance: SEARCH_RADIUS_KM * 1000,
      },
    },
  })
    .limit(20)
    .lean();

  if (!candidates.length) return null;

  // 2. Fetch driver ratings + block status in one query
  const driverIds = candidates.map((r) => r.driverId);
  const drivers   = await User.find(
    { _id: { $in: driverIds }, kycStatus: 'APPROVED', deletedAt: null },
    { _id: 1, rating: 1, cancellationBlockedUntil: 1 }
  ).lean();

  const driverMap = Object.fromEntries(drivers.map((d) => [d._id.toString(), d]));

  const now = new Date();

  // 3. Score and rank
  const scored = candidates
    .filter((ride) => {
      const driver = driverMap[ride.driverId.toString()];
      if (!driver) return false; // not approved / deleted
      if (driver.cancellationBlockedUntil && driver.cancellationBlockedUntil > now) return false;
      return true;
    })
    .map((ride) => {
      const driver = driverMap[ride.driverId.toString()];
      ride._driverRating = driver.rating ?? 5.0;

      // Distance from passenger pickup to this ride's pickup (straight-line, degrees → km approx)
      const [rLng, rLat] = ride.pickup.coordinates.coordinates;
      const [pLng, pLat] = passengerCoords;
      const distanceKm   = haversine([pLng, pLat], [rLng, rLat]);

      const score = scoreRide(ride, distanceKm, passengersCount);
      return { ride, score, distanceKm };
    })
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0] : null;
};

module.exports = { findNextBestDriver };
