const cron = require('node-cron');
const { expirePendingBookings } = require('./expireBookings');
const { startSeatLockCleanup } = require('./seatLockCleanup');
const { startInactivityDetection } = require('./driverInactivityDetection');
const Ride = require('../models/Ride');
const BookingRequest = require('../models/BookingRequest');
const { notify } = require('../utils/notify');
const { getPlatformConfig } = require('../services/platformConfigService');

/**
 * Register and start all background cron jobs.
 * Call once from server.js after DB is connected.
 */
const startScheduler = () => {
  // Start seat lock cleanup job
  startSeatLockCleanup();

  // Start driver inactivity detection job
  startInactivityDetection();
  // Run every minute — checks for PENDING bookings past their requestExpiry
  cron.schedule('* * * * *', async () => {
    try {
      await expirePendingBookings();
    } catch (err) {
      console.error('[Scheduler] expirePendingBookings crashed:', err.message);
    }
  });

  // Run every minute — auto-start or cancel scheduled rides whose scheduledTime has passed
  cron.schedule('* * * * *', async () => {
    try {
      const cfg = await getPlatformConfig();
      const freeWaitMinutes = Number(cfg?.penalties?.freeWaitMinutes ?? 5);

      const dueRides = await Ride.find({
        status: 'BOOKING_OPEN',
        isScheduled: true,
        scheduledTime: { $lte: new Date() },
      });

      for (const ride of dueRides) {
        const acceptedCount = await BookingRequest.countDocuments({
          rideId: ride._id,
          status: { $in: ['ACCEPTED', 'ONGOING'] },
        });

        if (acceptedCount > 0) {
          ride.status = 'STARTED';
          ride.startedAt = new Date();
          await ride.save();

          // Booking status transition: ACCEPTED → ONGOING
          await BookingRequest.updateMany(
            { rideId: ride._id, status: 'ACCEPTED' },
            {
              $set: {
                status: 'ONGOING',
                waitingStartedAt: ride.startedAt,
                freeWaitMinutes,
                waitedMinutes: 0,
                waitPenaltyApplied: false,
                waitPenaltyAmount: 0,
                waitStatus: 'FREE_WINDOW',
              },
            }
          );

          const acceptedBookings = await BookingRequest.find({
            rideId: ride._id,
            status: { $in: ['ACCEPTED', 'ONGOING'] },
          });

          for (const booking of acceptedBookings) {
            await notify({
              userId: booking.passengerId,
              type: 'RIDE_STARTED',
              title: 'Your ride has started',
              body: 'Your scheduled ride has started. Have a safe journey!',
              data: { rideId: ride._id },
            });
          }
        } else {
          ride.status = 'CANCELLED';
          await ride.save();

          await notify({
            userId: ride.driverId,
            type: 'CANCELLED',
            title: 'Scheduled ride cancelled',
            body: 'Your scheduled ride was cancelled because no passengers booked.',
            data: { rideId: ride._id },
          });
        }
      }
    } catch (err) {
      console.error('[Scheduler] scheduledRideTransition crashed:', err.message);
    }
  });

  console.log('[Scheduler] Background jobs started');
};

module.exports = { startScheduler };
