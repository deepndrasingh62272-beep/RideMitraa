const BookingRequest = require('../models/BookingRequest');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { lockSeats, releaseSeats, confirmSeats } = require('../utils/seatLock');
const { applyPassengerPenalty, applyDriverPenalty } = require('../utils/cancellation');
const { processAutoRefund } = require('./payment.controller');
const { createChatForBooking } = require('./chat.controller');
const { notify } = require('../utils/notify');
const { findNextBestDriver } = require('../utils/matchDriver');
const { validatePassengerCount } = require('../utils/seatValidation');
const { audit } = require('../utils/audit');
const { haversineDistance } = require('../utils/fare');
const { getPlatformConfig } = require('../services/platformConfigService');
const { getIO } = require('../config/socket');

const REQUEST_EXPIRY_MS    = 30 * 60 * 1000; // 30 minutes

// ─── Status Transition Allow-list ────────────────────────────────────────────
// Maps each current status to the set of valid next statuses.
const ALLOWED_TRANSITIONS = {
  PENDING:      new Set(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  ACCEPTED:     new Set(['PAYMENT_DONE', 'CANCELLED']),
  PAYMENT_DONE: new Set(['OTP_VERIFIED', 'CANCELLED']),
  OTP_VERIFIED: new Set(['ONGOING', 'CANCELLED']),
  ONGOING:      new Set(['COMPLETED', 'CANCELLED']),
  REJECTED:     new Set(),
  COMPLETED:    new Set(),
  CANCELLED:    new Set(),
  EXPIRED:      new Set(),
};

/**
 * Throws HTTP 422 if the transition from booking.status → targetStatus is not allowed.
 */
const assertTransition = (booking, targetStatus) => {
  const current = booking.status;
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.has(targetStatus)) {
    const err = new Error(`Cannot transition booking from ${current} to ${targetStatus}`);
    err.status = 422;
    throw err;
  }
};

const DEFAULT_POLICY = {
  platformFeePercent: 0.05,
  waitPenaltyPerMinute: 2,
  freeWaitMinutes: 5,
  autoCancelWaitMinutes: 15,
};

const getPolicyConfig = async () => {
  const config = await getPlatformConfig();
  return {
    platformFeePercent: Number(config?.pricing?.platformFeePercent ?? DEFAULT_POLICY.platformFeePercent),
    waitPenaltyPerMinute: Number(config?.penalties?.waitPenaltyPerMinute ?? DEFAULT_POLICY.waitPenaltyPerMinute),
    freeWaitMinutes: Number(config?.penalties?.freeWaitMinutes ?? DEFAULT_POLICY.freeWaitMinutes),
    autoCancelWaitMinutes: Number(config?.penalties?.autoCancelWaitMinutes ?? DEFAULT_POLICY.autoCancelWaitMinutes),
  };
};

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Normalize any location format to the BookingRequest GeoJSON schema:
 * { name, coordinates: { type: 'Point', coordinates: [lng, lat] } }
 *
 * Handles:
 *  - Frontend sends: { name, coordinates: [lng, lat] }
 *  - Ride model has: { name, coordinates: { type: 'Point', coordinates: [lng, lat] } }
 */
const toGeoPoint = (loc) => {
  if (!loc) return null;

  let lng, lat;

  // Handle different coordinate formats
  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    // Format: [lng, lat]
    lng = Number(loc.coordinates[0]);
    lat = Number(loc.coordinates[1]);
  } else if (Array.isArray(loc.coordinates?.coordinates) && loc.coordinates.coordinates.length === 2) {
    // Format: GeoJSON { type: 'Point', coordinates: [lng, lat] }
    lng = Number(loc.coordinates.coordinates[0]);
    lat = Number(loc.coordinates.coordinates[1]);
  } else if (loc.coordinates && typeof loc.coordinates === 'object' && 'lng' in loc.coordinates && 'lat' in loc.coordinates) {
    // Format: { lat, lng } object (frontend mapped format)
    lng = Number(loc.coordinates.lng);
    lat = Number(loc.coordinates.lat);
  } else {
    throw Object.assign(new Error('Invalid location coordinates format'), { status: 400 });
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat))
    throw Object.assign(new Error('Location coordinates must be valid numbers'), { status: 400 });
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw Object.assign(new Error('Location coordinates out of range'), { status: 400 });

  return {
    name: loc.name || 'Unknown',
    ...(loc.address && { address: loc.address }),
    coordinates: { type: 'Point', coordinates: [lng, lat] },
  };
};

const toSeatsBooked = ({ passengersCount, seatsBooked }) => {
  const raw = seatsBooked ?? passengersCount;
  const seats = Number(raw);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
    throw Object.assign(new Error('seatsBooked/passengersCount must be an integer between 1 and 6'), { status: 400 });
  }
  return seats;
};

const isGenderAllowed = (genderPreference, passengerGender) => {
  const pref = String(genderPreference || 'ANY').toUpperCase();
  const g = String(passengerGender || 'UNSPECIFIED').toUpperCase();

  if (pref === 'ANY') return true;
  if (g === 'UNSPECIFIED') return false;
  if (pref === 'MALE_ONLY') return g === 'MALE';
  if (pref === 'FEMALE_ONLY') return g === 'FEMALE';
  if (pref === 'OTHER_ONLY') return g === 'OTHER';
  return true;
};

const validatePickupRadius = (ride, pickupGeoPoint) => {
  const ridePickup = ride?.pickup?.coordinates?.coordinates;
  const bookingPickup = pickupGeoPoint?.coordinates?.coordinates;
  if (!Array.isArray(ridePickup) || !Array.isArray(bookingPickup)) return;

  const allowedMeters = Number(ride.pickupRadius ?? 300);
  const distanceMeters = haversineDistance(ridePickup, bookingPickup) * 1000;
  if (distanceMeters > allowedMeters) {
    throw Object.assign(
      new Error(`Pickup must be within ${allowedMeters}m of the ride pickup point`),
      { status: 400 }
    );
  }
};

const getWaitingMetrics = (booking, policy, now = new Date()) => {
  const freeWaitDefault = Number(policy?.freeWaitMinutes ?? DEFAULT_POLICY.freeWaitMinutes);
  const waitPenaltyPerMinute = Number(policy?.waitPenaltyPerMinute ?? DEFAULT_POLICY.waitPenaltyPerMinute);
  const autoCancelWaitMinutes = Number(policy?.autoCancelWaitMinutes ?? DEFAULT_POLICY.autoCancelWaitMinutes);

  if (!booking?.waitingStartedAt) {
    return {
      waitedMinutes: 0,
      extraMinutes: 0,
      penaltyAmount: 0,
      freeWaitMinutes: booking?.freeWaitMinutes ?? freeWaitDefault,
      autoCancelEligible: false,
      waitStatus: 'NONE',
    };
  }

  const startedAt = new Date(booking.waitingStartedAt);
  const waitedMinutes = Math.max(0, Math.ceil((now.getTime() - startedAt.getTime()) / 60000));
  const freeWaitMinutes = Number(booking.freeWaitMinutes ?? freeWaitDefault);
  const extraMinutes = Math.max(0, waitedMinutes - freeWaitMinutes);
  const penaltyAmount = Number((extraMinutes * waitPenaltyPerMinute).toFixed(2));
  const waitStatus = extraMinutes > 0 ? 'CHARGEABLE' : 'FREE_WINDOW';

  return {
    waitedMinutes,
    extraMinutes,
    penaltyAmount,
    freeWaitMinutes,
    autoCancelEligible: waitedMinutes >= autoCancelWaitMinutes,
    waitStatus,
  };
};

// ─── POST /api/bookings ───────────────────────────────────────────────────────
// Passenger creates a booking request

exports.createBooking = async (req, res, next) => {
  try {
    const policy = await getPolicyConfig();
    const { rideId, passengersCount, seatsBooked, pickup, dropoff } = req.body;
    // Default to CASH payment method for cash mode (no payment gateway required)
    const paymentMethod = req.body.paymentMethod || 'CASH';
    const requestedSeats = toSeatsBooked({ passengersCount, seatsBooked });

    const ride = await Ride.findById(rideId).populate('driverId', 'name phone');
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });
    if (ride.status !== 'BOOKING_OPEN') return res.status(400).json({ success: false, error: 'Ride is not available for booking' });

    // Prevent user from booking their own ride
    if (ride.driverId._id.toString() === req.user._id.toString())
      return res.status(403).json({ success: false, error: 'You cannot book your own ride' });

    const passenger = await User.findById(req.user._id).select('gender').lean();
    if (!isGenderAllowed(ride.genderPreference, passenger?.gender)) {
      return res.status(403).json({
        error: 'Ride gender preference does not match your profile. Please update your gender in profile settings.',
      });
    }

    // Validate seat count against vehicle rules
    try {
      validatePassengerCount(requestedSeats, ride.availableSeats, ride.vehicle.type);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const pickupGeo = toGeoPoint(pickup ?? ride.pickup);
    const dropoffGeo = toGeoPoint(dropoff ?? ride.dropoff);

    try {
      validatePickupRadius(ride, pickupGeo);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const pricePerSeat = ride.pricePerSeat ?? ride.farePerSeat;
    if (!Number.isFinite(pricePerSeat) || pricePerSeat < 0)
      return res.status(500).json({ success: false, error: 'Ride pricing is invalid' });
    const subtotal     = pricePerSeat * requestedSeats;
    const platformFee  = parseFloat((subtotal * policy.platformFeePercent).toFixed(2));
    const totalAmount  = parseFloat((subtotal + platformFee).toFixed(2));

    // Create booking first so we have an _id for the seat lock
    const booking = await BookingRequest.create({
      passengerId:     req.user._id,
      driverId:        ride.driverId._id,
      rideId:          ride._id,
      pickup:          pickupGeo,
      dropoff:         dropoffGeo,
      passengersCount: requestedSeats,
      seatsBooked:     requestedSeats,
      rideTime:        ride.schedule.departureAt,
      pricePerSeat,
      platformFee,
      totalAmount,
      paymentMethod,
      requestExpiry:   new Date(Date.now() + REQUEST_EXPIRY_MS),
    });

    // Atomically lock seats — prevents race conditions with concurrent bookings
    const locked = await lockSeats(rideId, requestedSeats, booking._id);
    if (!locked) {
      // Could not acquire lock — not enough seats or another lock is active
      await BookingRequest.findByIdAndDelete(booking._id);
      const freshRide = await Ride.findById(rideId).select('availableSeats lockedSeats').lean();
      const effectiveSeats = (freshRide?.availableSeats || 0) - (freshRide?.lockedSeats || 0);
      return res.status(409).json({
        success: false,
        error: effectiveSeats <= 0
          ? 'No seats available for this ride'
          : `Only ${effectiveSeats} seat(s) available. Please reduce your passenger count.`,
        availableSeats: effectiveSeats,
      });
    }

    audit({
      req,
      user:       req.user,
      action:     'BOOKING_CREATED',
      resource:   'BookingRequest',
      resourceId: booking._id,
      meta:       { rideId, seatsBooked: requestedSeats, paymentMethod },
    });

    notify({
      userId: ride.driverId._id,
      type:   'NEW_BOOKING',
      title:  'New Booking Request',
      body:   `You have a new booking request for ${requestedSeats} seat(s).`,
      data:   { bookingId: booking._id, rideId },
    });

    // Emit real-time socket events
    try {
      const io = getIO();

      // 1. Notify passenger that their request was sent
      io.to(`user:${req.user._id}`).emit('booking:update', {
        bookingId: booking._id,
        status: 'PENDING',
        message: 'Booking request sent',
        seatsBooked: requestedSeats,
        rideId: rideId,
        createdAt: new Date(),
      });

      // 2. Notify driver of the new incoming booking request
      io.to(`user:${ride.driverId._id}`).emit('booking:new', {
        bookingId: booking._id,
        rideId: rideId,
        passengerId: req.user._id,
        seatsBooked: requestedSeats,
        message: 'New booking request received',
        createdAt: new Date(),
      });

      console.log(`[Socket] booking:new emitted to driver user:${ride.driverId._id}`);
    } catch (socketErr) {
      console.error('[Socket] Failed to emit booking events:', socketErr.message);
    }

    res.status(201).json({ success: true, data: booking, message: 'Booking request sent' });  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/:id/accept ────────────────────────────────────────────
// Driver accepts a booking

exports.acceptBooking = async (req, res, next) => {
  try {
    const booking = await BookingRequest.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your booking to accept' });

    // Enforce status transition
    try { assertTransition(booking, 'ACCEPTED'); } catch (err) {
      return res.status(err.status || 422).json({ success: false, error: err.message });
    }

    if (booking.requestExpiry < new Date())
      return res.status(400).json({ error: 'Booking request has expired' });

    // Atomically deduct seats and clear the lock
    let ride = await confirmSeats(booking.rideId, booking.passengersCount, booking._id);
    if (!ride) {
      // Lock was released (expired) before driver accepted — re-check seats
      const freshRide = await Ride.findById(booking.rideId);
      if (!freshRide || freshRide.availableSeats < booking.passengersCount)
        return res.status(400).json({ error: 'Seats are no longer available' });

      // Seats still exist but lock expired — deduct directly
      freshRide.availableSeats -= booking.passengersCount;
      if (freshRide.availableSeats === 0) freshRide.status = 'FULL';
      await freshRide.save();
      ride = freshRide;
    }

    // ── OTP generation: one OTP per Ride, shared across all accepted bookings ──
    // Re-fetch ride to get latest otpCode (another booking may have already set it)
    const rideDoc = await Ride.findById(booking.rideId);
    if (!rideDoc.otpCode) {
      // First acceptance on this ride — generate and persist OTP
      rideDoc.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await rideDoc.save();
    }
    const otpCode = rideDoc.otpCode;

    booking.status = 'ACCEPTED';
    await booking.save();

    // Auto-create chat between driver and passenger
    await createChatForBooking(booking);

    audit({
      req,
      user:       req.user,
      action:     'BOOKING_ACCEPTED',
      resource:   'BookingRequest',
      resourceId: booking._id,
    });

    notify({
      userId: booking.passengerId,
      type:   'ACCEPTED',
      title:  'Booking Accepted',
      body:   'Your booking has been accepted by the driver.',
      data:   { bookingId: booking._id, rideId: booking.rideId },
    });

    // Emit real-time socket events — OTP only to driver room, NOT passenger
    try {
      const io = getIO();

      // Passenger: no OTP in payload
      io.to(`user:${booking.passengerId}`).emit('booking:update', {
        bookingId: booking._id,
        status: 'ACCEPTED',
        message: 'Booking accepted by driver',
        rideId: booking.rideId,
        updatedAt: new Date(),
      });

      // Driver: include OTP
      io.to(`user:${booking.driverId}`).emit('booking:update', {
        bookingId: booking._id,
        status: 'ACCEPTED',
        message: 'You accepted the booking',
        rideId: booking.rideId,
        otpCode,
        updatedAt: new Date(),
      });
    } catch (socketErr) {
      console.error('[Socket] Failed to emit booking:update:', socketErr.message);
    }

    res.json({ success: true, message: 'Booking accepted', data: booking });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/:id/reject ────────────────────────────────────────────
// Driver rejects a booking — triggers auto-match to next best driver

exports.rejectBooking = async (req, res, next) => {
  try {
    const booking = await BookingRequest.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your booking to reject' });

    // Enforce status transition
    try { assertTransition(booking, 'REJECTED'); } catch (err) {
      return res.status(err.status || 422).json({ success: false, error: err.message });
    }

    booking.status = 'REJECTED';
    await booking.save();

    // Release the seat lock so other passengers can book
    await releaseSeats(booking.rideId, booking._id);

    // Auto-refund passenger if payment was already made
    await processAutoRefund(booking._id);

    audit({
      req,
      user:       req.user,
      action:     'BOOKING_REJECTED',
      resource:   'BookingRequest',
      resourceId: booking._id,
    });

    // ── Auto-match: find next best available ride ─────────────────────────
    let autoMatch = null;
    try {
      const policy = await getPolicyConfig();
      const match = await findNextBestDriver(booking._id);

      if (match) {
        const { ride } = match;

        // Create a new booking request on the matched ride
        const rematchPricePerSeat = ride.pricePerSeat ?? ride.farePerSeat;
        const newBooking = await BookingRequest.create({
          passengerId:     booking.passengerId,
          driverId:        ride.driverId,
          rideId:          ride._id,
          pickup:          booking.pickup,
          dropoff:         booking.dropoff,
          passengersCount: booking.passengersCount,
          seatsBooked:     booking.passengersCount,
          rideTime:        ride.schedule.departureAt,
          pricePerSeat:    rematchPricePerSeat,
          platformFee:     booking.platformFee,
          totalAmount:     parseFloat(
            (rematchPricePerSeat * booking.passengersCount * (1 + policy.platformFeePercent)).toFixed(2)
          ),
          paymentMethod:   booking.paymentMethod,
          requestExpiry:   new Date(Date.now() + REQUEST_EXPIRY_MS),
        });

        // Lock seats on the new ride
        const locked = await lockSeats(ride._id, booking.passengersCount, newBooking._id);
        if (locked) {
          // Notify new driver
          notify({
            userId: ride.driverId,
            type:   'NEW_BOOKING',
            title:  'New Booking Request',
            body:   `You have a new booking request for ${booking.passengersCount} seat(s).`,
            data:   { bookingId: newBooking._id, rideId: ride._id },
          });

          // Notify passenger of the re-match
          notify({
            userId: booking.passengerId,
            type:   'REJECTED',
            title:  'Booking Rejected — Finding You Another Ride',
            body:   'Your previous driver declined. We found a new match and sent them a request.',
            data:   { oldBookingId: booking._id, newBookingId: newBooking._id, newRideId: ride._id },
          });

          autoMatch = { newBookingId: newBooking._id, newRideId: ride._id, score: match.score };

          audit({
            req,
            user:       req.user,
            action:     'AUTO_MATCH_CREATED',
            resource:   'BookingRequest',
            resourceId: newBooking._id,
            meta:       { originalBookingId: booking._id, score: match.score },
          });
        } else {
          // Seats grabbed between find and lock — discard silently
          await BookingRequest.findByIdAndDelete(newBooking._id);
        }
      } else {
        // No match found — notify passenger
        notify({
          userId: booking.passengerId,
          type:   'REJECTED',
          title:  'Booking Rejected',
          body:   'Your booking was declined and no alternative rides are available right now.',
          data:   { bookingId: booking._id },
        });
      }
    } catch (matchErr) {
      // Auto-match failure must not break the rejection response
      console.error('[AutoMatch] Error:', matchErr.message);
      notify({
        userId: booking.passengerId,
        type:   'REJECTED',
        title:  'Booking Rejected',
        body:   'Your booking request was declined by the driver.',
        data:   { bookingId: booking._id, rideId: booking.rideId },
      });
    }

    // Emit real-time socket event to passenger
    try {
      const io = getIO();
      io.to(`user:${booking.passengerId}`).emit('booking:update', {
        bookingId: booking._id,
        status: 'REJECTED',
        message: 'Booking rejected by driver',
        rideId: booking.rideId,
        updatedAt: new Date(),
        autoMatch: autoMatch || null
      });
      
      // Also emit to driver
      io.to(`user:${booking.driverId}`).emit('booking:update', {
        bookingId: booking._id,
        status: 'REJECTED',
        message: 'You rejected the booking',
        rideId: booking.rideId,
        updatedAt: new Date()
      });
    } catch (socketErr) {
      console.error('[Socket] Failed to emit booking:update:', socketErr.message);
    }

    res.json({ message: 'Booking rejected', booking, autoMatch });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/:id/cancel ────────────────────────────────────────────
// Unified cancel — passenger or driver can cancel with appropriate penalties
// Time-based refund rules:
// - Passenger cancels BEFORE 1 hour of ride: Partial refund (with fee)
// - Passenger cancels WITHIN 1 hour: NO REFUND
// - Passenger cancels AFTER ride started: NO REFUND
// - Driver cancels BEFORE ride start: Allowed (with penalty)
// - Driver cancels AFTER ride start: NOT allowed

exports.cancelBooking = async (req, res, next) => {
  try {
    const policy = await getPolicyConfig();
    const booking = await BookingRequest.findById(req.params.id).populate('rideId');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const uid           = req.user._id.toString();
    const isPassenger   = booking.passengerId.toString() === uid;
    const isDriver      = booking.driverId?.toString()   === uid;

    if (!isPassenger && !isDriver)
      return res.status(403).json({ error: 'Not your booking to cancel' });

    // Enforce status transition
    try { assertTransition(booking, 'CANCELLED'); } catch (err) {
      return res.status(err.status || 422).json({ success: false, error: err.message });
    }

    const { reason } = req.body; // optional cancellation reason

    let penaltyApplied = false;
    let penaltyAmount  = 0;
    let refundAmount   = booking.totalAmount;
    let refundPolicy   = 'FULL_REFUND';

    const waiting = getWaitingMetrics(booking, policy);
    booking.waitedMinutes = waiting.waitedMinutes;

    // Driver cancellation logic
    if (isDriver) {
      // Driver CANNOT cancel after ride started
      if (booking.status === 'ONGOING' || booking.rideStartedAt) {
        return res.status(403).json({ 
          error: 'Cannot cancel after ride has started',
          message: 'Ride is already in progress'
        });
      }

      // Driver cancels before ride — always a penalty
      ({ penaltyApplied, penaltyAmount } = await applyDriverPenalty(booking));
      await releaseSeats(booking.rideId, booking._id);
      await Ride.findByIdAndUpdate(booking.rideId, {
        $inc: { availableSeats: booking.passengersCount },
        $set: { status: 'BOOKING_OPEN' },
      });

      booking.cancelledBy = 'DRIVER';
      refundPolicy = 'NO_REFUND'; // Driver doesn't pay, passenger gets full refund
    } else {
      // Passenger cancellation logic
      const now = new Date();
      const rideTime = booking.rideTime;
      const hoursUntilRide = (rideTime - now) / (1000 * 60 * 60); // Convert to hours

      // Calculate time-based penalties
      if (booking.status === 'ONGOING' || booking.rideStartedAt) {
        // Ride already started — NO REFUND
        penaltyApplied = true;
        penaltyAmount = booking.totalAmount;
        refundAmount = 0;
        refundPolicy = 'NO_REFUND';
        
        if (waiting.extraMinutes > 0) {
          penaltyAmount = waiting.penaltyAmount;
        }
        
        booking.waitStatus = waiting.autoCancelEligible ? 'AUTO_CANCELLED' : 'CHARGEABLE';
        
      } else if (booking.status === 'PENDING') {
        // Pending booking — check time
        if (hoursUntilRide <= 1) {
          // Within 1 hour — NO REFUND
          penaltyApplied = true;
          penaltyAmount = booking.totalAmount;
          refundAmount = 0;
          refundPolicy = 'NO_REFUND';
        } else {
          // More than 1 hour — Partial refund with small fee
          const cancelFee = Math.min(50, booking.totalAmount * 0.1); // Max 50 or 10%
          penaltyApplied = true;
          penaltyAmount = cancelFee;
          refundAmount = booking.totalAmount - cancelFee;
          refundPolicy = 'PARTIAL_REFUND';
        }
        await releaseSeats(booking.rideId, booking._id);
        
      } else if (booking.status === 'ACCEPTED') {
        // Accepted but not started
        if (hoursUntilRide <= 1) {
          // Within 1 hour — NO REFUND
          penaltyApplied = true;
          penaltyAmount = booking.totalAmount;
          refundAmount = 0;
          refundPolicy = 'NO_REFUND';
        } else {
          // More than 1 hour — Partial refund
          const cancelFee = Math.min(100, booking.totalAmount * 0.15); // Max 100 or 15%
          penaltyApplied = true;
          penaltyAmount = cancelFee;
          refundAmount = booking.totalAmount - cancelFee;
          refundPolicy = 'PARTIAL_REFUND';
        }
        
        // Restore seats
        await Ride.findByIdAndUpdate(booking.rideId, {
          $inc: { availableSeats: booking.passengersCount },
          $set: { status: 'BOOKING_OPEN' },
        });
      }

      booking.cancelledBy = 'PASSENGER';
    }

    booking.cancellationReason = reason ?? null;
    booking.penaltyApplied     = penaltyApplied;
    booking.penaltyAmount      = penaltyAmount;
    booking.waitPenaltyApplied = penaltyApplied;
    booking.waitPenaltyAmount  = penaltyAmount;
    booking.status             = 'CANCELLED';
    await booking.save();

    // Auto-refund for online payments (penalty amount is informational for now)
    await processAutoRefund(booking._id);

    audit({
      req,
      user:       req.user,
      action:     'BOOKING_CANCELLED',
      resource:   'BookingRequest',
      resourceId: booking._id,
      meta:       { cancelledBy: booking.cancelledBy, penaltyApplied, penaltyAmount, reason },
    });

    // Notify the other party about cancellation
    const otherUserId = isPassenger ? booking.driverId : booking.passengerId;
    notify({
      userId: otherUserId,
      type:   'CANCELLED',
      title:  'Booking Cancelled',
      body:   `The booking was cancelled by the ${booking.cancelledBy.toLowerCase()}.`,
      data:   { bookingId: booking._id, rideId: booking.rideId, cancelledBy: booking.cancelledBy },
    });

    res.json({
      message:       'Booking cancelled',
      cancelledBy:   booking.cancelledBy,
      penaltyApplied,
      penaltyAmount,
      waiting: {
        waitedMinutes: waiting.waitedMinutes,
        freeWaitMinutes: waiting.freeWaitMinutes,
        waitStatus: booking.waitStatus,
      },
      booking,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
// Get booking details — accessible by the passenger or driver involved

exports.getBooking = async (req, res, next) => {
  try {
    const booking = await BookingRequest.findById(req.params.id)
      .populate('passengerId', 'name phone rating')
      .populate('driverId',    'name phone rating')
      .populate('rideId',      'vehicle schedule distanceKm')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const uid = req.user._id.toString();
    const isInvolved =
      booking.passengerId._id.toString() === uid ||
      booking.driverId?._id?.toString()  === uid;

    if (!isInvolved)
      return res.status(403).json({ error: 'Access denied' });

    res.json(booking);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/bookings/:id/payment-confirm ─────────────────────────────────
// Passenger confirms dummy payment — transitions ACCEPTED → PAYMENT_DONE

exports.paymentConfirm = async (req, res, next) => {
  try {
    const booking = await BookingRequest.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    // Only the passenger can confirm payment
    if (booking.passengerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Only the passenger can confirm payment' });

    // Enforce status transition
    try { assertTransition(booking, 'PAYMENT_DONE'); } catch (err) {
      return res.status(err.status || 422).json({ success: false, error: err.message });
    }

    booking.status = 'PAYMENT_DONE';
    await booking.save();

    audit({
      req,
      user:       req.user,
      action:     'PAYMENT_CONFIRMED',
      resource:   'BookingRequest',
      resourceId: booking._id,
    });

    // Emit to both passenger and driver
    try {
      const io = getIO();
      const payload = {
        bookingId: booking._id,
        status: 'PAYMENT_DONE',
        message: 'Payment confirmed',
        rideId: booking.rideId,
        updatedAt: new Date(),
      };
      io.to(`user:${booking.passengerId}`).emit('booking:update', payload);
      io.to(`user:${booking.driverId}`).emit('booking:update', payload);
    } catch (socketErr) {
      console.error('[Socket] Failed to emit booking:update (payment-confirm):', socketErr.message);
    }

    res.json({ success: true, message: 'Payment confirmed', data: booking });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/:id/verify-otp (new per-booking endpoint) ─────────────
// Passenger verifies OTP — transitions PAYMENT_DONE → OTP_VERIFIED

exports.verifyBookingOTP = async (req, res, next) => {
  try {
    const { otpCode } = req.body;
    if (!otpCode) return res.status(400).json({ success: false, error: 'otpCode is required' });

    const booking = await BookingRequest.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    // Only the passenger can verify OTP
    if (booking.passengerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Only the passenger can verify OTP' });

    // Enforce status transition
    try { assertTransition(booking, 'OTP_VERIFIED'); } catch (err) {
      return res.status(err.status || 422).json({ success: false, error: err.message });
    }

    // Validate OTP against the Ride record (single shared OTP per ride)
    const ride = await Ride.findById(booking.rideId).select('otpCode').lean();
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });
    if (!ride.otpCode || ride.otpCode !== String(otpCode).trim()) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    booking.status = 'OTP_VERIFIED';
    booking.otpVerified = true;
    booking.otpVerifiedAt = new Date();
    await booking.save();

    audit({
      req,
      user:       req.user,
      action:     'OTP_VERIFIED',
      resource:   'BookingRequest',
      resourceId: booking._id,
    });

    // Emit to both passenger and driver
    try {
      const io = getIO();
      const payload = {
        bookingId: booking._id,
        status: 'OTP_VERIFIED',
        message: 'OTP verified — boarding confirmed',
        rideId: booking.rideId,
        updatedAt: new Date(),
      };
      io.to(`user:${booking.passengerId}`).emit('booking:update', payload);
      io.to(`user:${booking.driverId}`).emit('booking:update', payload);
    } catch (socketErr) {
      console.error('[Socket] Failed to emit booking:update (verify-otp):', socketErr.message);
    }

    res.json({ success: true, message: 'OTP verified. You may now board the ride.', data: booking });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/lock-seats ───────────────────────────────────────────
// Manually lock seats on a ride (called before creating a booking request)

exports.lockSeatsApi = async (req, res, next) => {
  try {
    const { rideId, seats, bookingId } = req.body;
    if (!rideId || !seats || !bookingId)
      return res.status(400).json({ error: 'rideId, seats, and bookingId are required' });

    const ride = await lockSeats(rideId, seats, bookingId);
    if (!ride)
      return res.status(409).json({ error: 'Unable to lock seats — not enough available or another lock is active' });

    res.json({ message: 'Seats locked', lockedSeats: ride.lockedSeats, seatLockExpiry: ride.seatLockExpiry });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/release-seats ────────────────────────────────────────
// Manually release a seat lock (e.g. passenger abandons booking flow)

exports.releaseSeatsApi = async (req, res, next) => {
  try {
    const { rideId, bookingId } = req.body;
    if (!rideId || !bookingId)
      return res.status(400).json({ error: 'rideId and bookingId are required' });

    const ride = await releaseSeats(rideId, bookingId);
    if (!ride)
      return res.status(404).json({ error: 'No active lock found for this booking on the given ride' });

    res.json({ message: 'Seats released', availableSeats: ride.availableSeats });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// RIDE LIFECYCLE APIs
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/bookings/start-ride ────────────────────────────────────────────
// Driver starts the ride — generates OTP for all passengers

exports.startRide = async (req, res, next) => {
  try {
    const { rideId } = req.body;
    const driverId = req.user?._id;

    if (!rideId) return res.status(400).json({ error: 'rideId is required' });
    if (!driverId) return res.status(401).json({ error: 'Authentication required' });

    // Verify driver owns this ride
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    
    // Defensive check for driverId
    const rideDriverId = ride.driverId?.toString ? ride.driverId.toString() : ride.driverId;
    const currentUserId = driverId.toString ? driverId.toString() : driverId;
    
    if (rideDriverId !== currentUserId) {
      return res.status(403).json({ error: 'Only the driver can start this ride' });
    }

    // Check ride can be started
    // Allow BOOKING_OPEN, FULL (old flow) and STARTED (new per-booking OTP flow)
    const validStartStatuses = ['BOOKING_OPEN', 'FULL', 'STARTED'];
    if (!validStartStatuses.includes(ride.status)) {
      return res.status(400).json({ 
        error: `Ride cannot be started in current status: ${ride.status}` 
      });
    }

    // Generate or reuse OTP
    const otpCode = ride.otpCode || Math.floor(100000 + Math.random() * 900000).toString();

    // Update ride status to STARTED
    ride.status = 'STARTED';
    ride.startedAt = ride.startedAt || new Date();
    ride.otpCode = otpCode;
    await ride.save();

    // Update all accepted OR otp_verified bookings for this ride to ONGOING
    await BookingRequest.updateMany(
      { rideId, status: { $in: ['ACCEPTED', 'OTP_VERIFIED'] } },
      { 
        $set: { 
          status: 'ONGOING',
          otpCode: otpCode,
          rideStartedAt: new Date()
        }
      }
    );

    // Notify passengers via socket (if implemented)
    // io.to(`ride_${rideId}`).emit('ride-started', { rideId, otpCode });

    res.json({
      success: true,
      message: 'Ride started successfully',
      otpCode,
      rideId,
      startedAt: ride.startedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/end-ride ──────────────────────────────────────────────
// Driver ends the ride — marks ride as completed

exports.endRide = async (req, res, next) => {
  try {
    const { rideId } = req.body;
    const driverId = req.user?._id;

    if (!rideId) return res.status(400).json({ error: 'rideId is required' });
    if (!driverId) return res.status(401).json({ error: 'Authentication required' });

    // Verify driver owns this ride
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    
    // Defensive check for driverId
    const rideDriverId = ride.driverId?.toString ? ride.driverId.toString() : ride.driverId;
    const currentUserId = driverId.toString ? driverId.toString() : driverId;
    
    if (rideDriverId !== currentUserId) {
      return res.status(403).json({ error: 'Only the driver can end this ride' });
    }

    // Check ride can be ended
    if (ride.status !== 'STARTED') {
      return res.status(400).json({ error: `Ride is not in progress. Current status: ${ride.status}` });
    }

    // Update ride status
    ride.status = 'COMPLETED';
    ride.completedAt = new Date();
    ride.otpCode = null; // Clear OTP
    await ride.save();

    // Update all ongoing bookings for this ride
    await BookingRequest.updateMany(
      { rideId, status: 'ONGOING' },
      { 
        $set: { 
          status: 'COMPLETED',
          rideEndedAt: new Date(),
          otpCode: null
        }
      }
    );

    res.json({
      success: true,
      message: 'Ride completed successfully',
      rideId,
      completedAt: ride.completedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bookings/verify-otp ────────────────────────────────────────────
// Passenger verifies OTP to board the ride

exports.verifyOTP = async (req, res, next) => {
  try {
    const { bookingId, otpCode } = req.body;
    const passengerId = req.user._id;

    if (!bookingId || !otpCode) {
      return res.status(400).json({ error: 'bookingId and otpCode are required' });
    }

    // Find booking
    const booking = await BookingRequest.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Verify passenger owns this booking
    if (booking.passengerId.toString() !== passengerId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check booking status
    if (booking.status !== 'ONGOING') {
      return res.status(400).json({ error: 'Booking is not in ongoing status' });
    }

    // Verify OTP
    if (booking.otpCode !== otpCode) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Mark OTP as verified
    booking.otpVerified = true;
    booking.otpVerifiedAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: 'OTP verified successfully. You may now board the ride.',
      bookingId,
      verifiedAt: booking.otpVerifiedAt,
    });
  } catch (err) {
    next(err);
  }
};
