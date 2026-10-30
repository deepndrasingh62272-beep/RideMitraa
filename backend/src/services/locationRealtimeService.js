const RideLocation = require('../models/RideLocation');
const Ride = require('../models/Ride');
const BookingRequest = require('../models/BookingRequest');
const { haversineDistance } = require('../utils/fare');
const { notify } = require('../utils/notify');

const DRIVER_NEARBY_THRESHOLD_KM = 0.5;

const toStatusError = (message, status = 400) =>
  Object.assign(new Error(message), { status });

const normalizeRideId = (rideId) => String(rideId || '').trim();
const normalizeUserId = (userId) => String(userId || '').trim();

const normalizeCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2)
    throw toStatusError('coordinates must be [lng, lat]', 400);

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat))
    throw toStatusError('coordinates must be numbers', 400);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw toStatusError('coordinates out of range', 400);

  return [lng, lat];
};

const assertRideDriver = async (rideId, driverId) => {
  const ride = await Ride.findById(rideId).select('driverId').lean();
  if (!ride) throw toStatusError('Ride not found', 404);

  if (String(ride.driverId) !== normalizeUserId(driverId))
    throw toStatusError('Only the ride driver can update location', 403);

  return ride;
};

const notifyNearbyPassengers = async ({ rideId, coordinates, location }) => {
  const acceptedBookings = await BookingRequest.find({
    rideId,
    status: { $in: ['ACCEPTED', 'ONGOING'] },
  }).lean();

  for (const booking of acceptedBookings) {
    const pickupCoords = booking.pickup?.coordinates?.coordinates;
    if (!Array.isArray(pickupCoords) || pickupCoords.length !== 2) continue;

    const distKm = haversineDistance(coordinates, pickupCoords);
    if (distKm > DRIVER_NEARBY_THRESHOLD_KM) continue;

    const passengerId = booking.passengerId;
    const alreadyNotified = location.notifiedPassengers?.some(
      (id) => String(id) === String(passengerId)
    );
    if (alreadyNotified) continue;

    await notify({
      userId: passengerId,
      type: 'DRIVER_NEARBY',
      title: 'Driver is nearby',
      body: 'Your driver is less than 500 m away from your pickup point.',
      data: { rideId },
    });

    await RideLocation.updateOne(
      { rideId },
      { $addToSet: { notifiedPassengers: passengerId } }
    );
  }
};

/**
 * Canonical location update path shared by REST + Socket handlers.
 */
const processDriverLocationUpdate = async ({
  rideId,
  driverId,
  coordinates,
  heading,
  speedKmh,
  source = 'REST',
  onBroadcast,
}) => {
  const normalizedRideId = normalizeRideId(rideId);
  if (!normalizedRideId) throw toStatusError('rideId is required', 400);

  await assertRideDriver(normalizedRideId, driverId);

  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const normalizedHeading = heading == null ? null : Number(heading);
  const normalizedSpeed = speedKmh == null ? null : Number(speedKmh);

  if (normalizedHeading != null && (!Number.isFinite(normalizedHeading) || normalizedHeading < 0 || normalizedHeading > 360)) {
    throw toStatusError('heading must be between 0 and 360', 400);
  }
  if (normalizedSpeed != null && (!Number.isFinite(normalizedSpeed) || normalizedSpeed < 0)) {
    throw toStatusError('speedKmh must be a non-negative number', 400);
  }

  const now = new Date();
  const point = {
    coordinates: normalizedCoordinates,
    heading: normalizedHeading,
    speedKmh: normalizedSpeed,
    recordedAt: now,
  };

  const location = await RideLocation.findOneAndUpdate(
    { rideId: normalizedRideId },
    {
      $set: {
        driverId,
        current: {
          coordinates: normalizedCoordinates,
          heading: normalizedHeading,
          speedKmh: normalizedSpeed,
          updatedAt: now,
        },
        driverHeartbeatAt: now,
        driverOnline: true,
        driverOfflineAt: null,
      },
      $push: {
        history: { $each: [point], $slice: -500 },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const payload = {
    rideId: normalizedRideId,
    driverId: normalizeUserId(driverId),
    coordinates: normalizedCoordinates,
    heading: normalizedHeading,
    speedKmh: normalizedSpeed,
    updatedAt: now,
    source,
  };

  if (typeof onBroadcast === 'function') {
    await onBroadcast(payload);
  }

  // Non-blocking safety checks.
  try {
    const { checkAndRecordDeviation } = require('../controllers/safety.controller');
    Promise.resolve(checkAndRecordDeviation(normalizedRideId)).catch(() => {});
  } catch {
    // non-critical
  }
  notifyNearbyPassengers({
    rideId: normalizedRideId,
    coordinates: normalizedCoordinates,
    location,
  }).catch(() => {});

  return { location, payload };
};

const recordDriverHeartbeat = async ({ rideId, driverId, at = new Date() }) => {
  const normalizedRideId = normalizeRideId(rideId);
  if (!normalizedRideId) throw toStatusError('rideId is required', 400);

  await assertRideDriver(normalizedRideId, driverId);

  const result = await RideLocation.updateOne(
    { rideId: normalizedRideId },
    {
      $set: {
        driverHeartbeatAt: at,
        driverOnline: true,
        driverOfflineAt: null,
      },
    }
  );

  return result.modifiedCount > 0;
};

const markStaleDriversOffline = async ({
  timeoutMs = 30000,
  batchSize = 100,
  onDriverOffline,
} = {}) => {
  const cutoff = new Date(Date.now() - timeoutMs);

  const stale = await RideLocation.find({
    driverOnline: true,
    driverHeartbeatAt: { $lt: cutoff },
  })
    .select('_id rideId driverId driverHeartbeatAt')
    .limit(batchSize)
    .lean();

  let marked = 0;
  for (const row of stale) {
    const updated = await RideLocation.findOneAndUpdate(
      {
        _id: row._id,
        driverOnline: true,
        driverHeartbeatAt: row.driverHeartbeatAt,
      },
      {
        $set: {
          driverOnline: false,
          driverOfflineAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) continue;
    marked += 1;

    if (typeof onDriverOffline === 'function') {
      await onDriverOffline({
        rideId: String(updated.rideId),
        driverId: String(updated.driverId),
        offlineAt: updated.driverOfflineAt,
      });
    }
  }

  return { marked };
};

module.exports = {
  processDriverLocationUpdate,
  recordDriverHeartbeat,
  markStaleDriversOffline,
};
