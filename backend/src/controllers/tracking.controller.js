const RideLocation   = require('../models/RideLocation');
const Ride           = require('../models/Ride');
const BookingRequest = require('../models/BookingRequest');
const { haversineDistance } = require('../utils/fare');
const { emitRideLocation } = require('../config/socket');
const { processDriverLocationUpdate } = require('../services/locationRealtimeService');

// Average speed assumption for ETA when live speed is unavailable (km/h)
const DEFAULT_SPEED_KMH = 30;

/**
 * Compute ETA in minutes from driver's current position to a target [lng, lat].
 */
const computeETA = (currentCoords, targetCoords, speedKmh = DEFAULT_SPEED_KMH) => {
  const distKm = haversineDistance(currentCoords, targetCoords);
  const speed  = speedKmh > 0 ? speedKmh : DEFAULT_SPEED_KMH;
  return {
    distanceKm:  parseFloat(distKm.toFixed(2)),
    etaMinutes:  Math.ceil((distKm / speed) * 60),
  };
};

// ─── POST /api/tracking/:rideId/location ─────────────────────────────────────
/**
 * Driver pushes their current location.
 * Appends to history, updates current, emits to all passengers in the ride room.
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { coordinates, heading, speedKmh } = req.body; // coordinates: [lng, lat]

    const { location } = await processDriverLocationUpdate({
      rideId,
      driverId: req.user._id,
      coordinates,
      heading,
      speedKmh,
      source: 'REST',
      onBroadcast: async (payload) => {
        emitRideLocation(rideId, payload);
      },
    });

    res.json({ message: 'Location updated', current: location.current });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/tracking/:rideId/location ──────────────────────────────────────
/**
 * Passenger (or driver) fetches the latest driver location + ETA to their pickup.
 */
exports.getLocation = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    // Only passengers with an ACCEPTED booking on this ride, or the driver, can query
    const ride = await Ride.findById(rideId).lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const uid = req.user._id.toString();
    const isDriver = ride.driverId.toString() === uid;

    if (!isDriver) {
      const booking = await BookingRequest.findOne({
        rideId,
        passengerId: req.user._id,
        status: { $in: ['ACCEPTED', 'ONGOING'] },
      }).lean();
      if (!booking) return res.status(403).json({ error: 'No accepted booking for this ride' });
    }

    const location = await RideLocation.findOne({ rideId }).lean();
    if (!location) return res.status(404).json({ error: 'No location data yet for this ride' });

    // ETA to pickup — use passenger's pickup coords if available, else ride pickup
    let eta = null;
    if (!isDriver) {
      const booking = await BookingRequest.findOne({
        rideId,
        passengerId: req.user._id,
        status: { $in: ['ACCEPTED', 'ONGOING'] },
      }).lean();

      const pickupCoords =
        booking?.pickup?.coordinates?.coordinates ??
        ride.pickup?.coordinates?.coordinates;

      if (pickupCoords) {
        eta = computeETA(
          location.current.coordinates,
          pickupCoords,
          location.current.speedKmh
        );
      }
    }

    res.json({
      rideId,
      current:   location.current,
      eta,
      updatedAt: location.current.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/tracking/:rideId/history ───────────────────────────────────────
/**
 * Returns the full route history for safety / replay.
 * Accessible by driver or any passenger with a booking on this ride.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId).lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const uid      = req.user._id.toString();
    const isDriver = ride.driverId.toString() === uid;

    if (!isDriver) {
      const booking = await BookingRequest.findOne({
        rideId,
        passengerId: req.user._id,
        status: { $in: ['ACCEPTED', 'ONGOING', 'CANCELLED'] },
      }).lean();
      if (!booking) return res.status(403).json({ error: 'Access denied' });
    }

    const location = await RideLocation.findOne({ rideId }, 'history current').lean();
    if (!location) return res.status(404).json({ error: 'No tracking data for this ride' });

    res.json({
      rideId,
      totalPoints: location.history.length,
      history:     location.history,
    });
  } catch (err) {
    next(err);
  }
};
