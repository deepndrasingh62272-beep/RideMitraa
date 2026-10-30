const Ride = require('../models/Ride');

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Atomically lock `seats` on a ride for a given bookingId.
 * Uses findOneAndUpdate with conditions to prevent race conditions.
 *
 * Returns the updated ride, or null if lock could not be acquired
 * (not enough effective seats, or another unexpired lock exists for a different booking).
 */
exports.lockSeats = async (rideId, seats, bookingId) => {
  const now = new Date();
  const expiry = new Date(now.getTime() + LOCK_DURATION_MS);

  // First, clear any expired lock so it doesn't block new requests
  await Ride.updateOne(
    {
      _id: rideId,
      seatLockExpiry: { $lte: now },
      seatLockBookingId: { $ne: bookingId },
    },
    {
      $set: { lockedSeats: 0, seatLockExpiry: null, seatLockBookingId: null },
    }
  );

  // Now try to acquire the lock
  const ride = await Ride.findOneAndUpdate(
    {
      _id: rideId,
      status: 'BOOKING_OPEN',
      $expr: {
        $gte: [
          { $subtract: ['$availableSeats', '$lockedSeats'] },
          seats,
        ],
      },
      $or: [
        { seatLockExpiry: null },
        { seatLockExpiry: { $lte: now } },           // expired lock — can overwrite
        { seatLockBookingId: bookingId },             // same booking re-locking
      ],
    },
    {
      $set: {
        lockedSeats:        seats,
        seatLockExpiry:     expiry,
        seatLockBookingId:  bookingId,
      },
    },
    { new: true }
  );

  return ride; // null means lock failed
};

/**
 * Release the seat lock for a specific bookingId.
 * Only clears the lock if it still belongs to this booking.
 */
exports.releaseSeats = async (rideId, bookingId) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, seatLockBookingId: bookingId },
    {
      $set: {
        lockedSeats:        0,
        seatLockExpiry:     null,
        seatLockBookingId:  null,
      },
    },
    { new: true }
  );

  return ride;
};

/**
 * Permanently deduct seats after driver accepts.
 * Clears the lock and decrements availableSeats atomically.
 */
exports.confirmSeats = async (rideId, seats, bookingId) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, seatLockBookingId: bookingId },
    {
      $inc: { availableSeats: -seats },
      $set: {
        lockedSeats:        0,
        seatLockExpiry:     null,
        seatLockBookingId:  null,
      },
    },
    { new: true }
  );

  if (ride && ride.availableSeats === 0) {
    ride.status = 'FULL';
    await ride.save();
  }

  return ride;
};
