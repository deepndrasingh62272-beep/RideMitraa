const BookingRequest = require('../models/BookingRequest');
const Ride           = require('../models/Ride');
const { notify }     = require('../utils/notify');
const { processAutoRefund } = require('../controllers/payment.controller');

/**
 * Expire all PENDING bookings whose requestExpiry has passed.
 *
 * For each expired booking:
 *  1. Mark status → EXPIRED
 *  2. Release locked seats on the ride (atomic $inc + clear lock fields)
 *  3. Auto-refund if payment was already made
 *  4. Notify the passenger
 *
 * Returns a summary { processed, errors }
 */
const expirePendingBookings = async () => {
  const now     = new Date();
  const summary = { processed: 0, errors: 0 };

  // Fetch all expired PENDING bookings
  const expired = await BookingRequest.find({
    status:        'PENDING',
    requestExpiry: { $lte: now },
  }).lean();

  if (!expired.length) return summary;

  await Promise.allSettled(
    expired.map(async (booking) => {
      try {
        // 1. Mark EXPIRED — use findOneAndUpdate to avoid race with driver accept
        const updated = await BookingRequest.findOneAndUpdate(
          { _id: booking._id, status: 'PENDING' }, // guard: only if still PENDING
          { $set: { status: 'EXPIRED' } },
          { new: true }
        );

        if (!updated) return; // already handled by another process / driver accepted

        // 2. Release seat lock atomically — only if this booking holds the lock
        await Ride.findOneAndUpdate(
          { _id: booking.rideId, seatLockBookingId: booking._id },
          {
            $set: {
              lockedSeats:        0,
              seatLockExpiry:     null,
              seatLockBookingId:  null,
            },
          }
        );

        // 3. Auto-refund if payment was made
        await processAutoRefund(booking._id);

        // 4. Notify passenger
        notify({
          userId: booking.passengerId,
          type:   'REJECTED',
          title:  'Booking Expired',
          body:   'Your booking request expired as the driver did not respond in time.',
          data:   { bookingId: booking._id, rideId: booking.rideId },
        });

        summary.processed++;
      } catch (err) {
        summary.errors++;
        console.error(`[ExpireJob] Failed for booking ${booking._id}:`, err.message);
      }
    })
  );

  if (summary.processed > 0 || summary.errors > 0) {
    console.log(
      `[ExpireJob] ${now.toISOString()} — expired: ${summary.processed}, errors: ${summary.errors}`
    );
  }

  return summary;
};

module.exports = { expirePendingBookings };
