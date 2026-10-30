const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { checkDuplicateBooking, checkCancellationRate, checkDriverCancellationBlock } = require('../middleware/antifraud');
const ctrl = require('../controllers/booking.controller');
const BookingRequest = require('../models/BookingRequest');

// ─── Validation ───────────────────────────────────────────────────────────────

const locationRules = (prefix) => [
  body(`${prefix}.name`).notEmpty().withMessage(`${prefix} name is required`),
  body(`${prefix}.coordinates`)
    .isArray({ min: 2, max: 2 })
    .withMessage(`${prefix} coordinates must be [lng, lat]`),
  body(`${prefix}.coordinates`).custom((coords) => {
    if (!Array.isArray(coords) || coords.length !== 2) return true;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return true;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error(`${prefix} coordinates out of range`);
    }
    return true;
  }),
  body(`${prefix}.coordinates.*`).isFloat().withMessage(`${prefix} coordinates must be numbers`),
];

const createBookingRules = [
  body('rideId').isMongoId().withMessage('Valid ride ID is required'),
  body('pickup').optional().isObject().withMessage('Pickup location must be an object'),
  body('pickup.name').optional().notEmpty().withMessage('Pickup name is required'),
  body('pickup.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Pickup coordinates must be [longitude, latitude]'),
  body('dropoff').optional().isObject().withMessage('Dropoff location must be an object'),
  body('dropoff.name').optional().notEmpty().withMessage('Dropoff name is required'),
  body('dropoff.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Dropoff coordinates must be [longitude, latitude]'),
  body('paymentMethod').optional().isIn(['CASH', 'UPI', 'CARD', 'WALLET']).withMessage('Invalid payment method'),
  body('passengersCount').optional().isInt({ min: 1, max: 6 }).withMessage('passengersCount must be 1–6'),
  body('seatsBooked').optional().isInt({ min: 1, max: 6 }).withMessage('seatsBooked must be 1–6'),
  body().custom((value, { req }) => {
    const p = req.body.passengersCount;
    const s = req.body.seatsBooked;
    if (p == null && s == null) {
      throw new Error('Either passengersCount or seatsBooked is required');
    }
    if (p != null && s != null && Number(p) !== Number(s)) {
      throw new Error('passengersCount and seatsBooked must match when both are provided');
    }
    // Default payment method to CASH if not provided
    if (!req.body.paymentMethod) {
      req.body.paymentMethod = 'CASH';
    }
    return true;
  }),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// ─── MY BOOKINGS STRUCTURE ───────────────────────────────────────────────────
// GET /api/bookings/my-rides   — rides posted by this user (driver view)
// GET /api/bookings/my-trips   — rides booked by this user (passenger view)
// GET /api/bookings/requests   — incoming requests (driver) + sent requests (passenger)

router.get('/my-rides', authenticate, async (req, res, next) => {
  try {
    const Ride = require('../models/Ride');
    const BookingRequest = require('../models/BookingRequest');
    // Exclude CANCELLED rides by default unless ?showCancelled=true
    const filter = { driverId: req.user._id };
    if (req.query.showCancelled !== 'true') {
      filter.status = { $ne: 'CANCELLED' };
    }
    const rides = await Ride.find(filter)
      .sort({ 'schedule.departureAt': -1 })
      .lean();

    const ridesWithCounts = await Promise.all(rides.map(async (ride) => {
      const pendingCount  = await BookingRequest.countDocuments({ rideId: ride._id, status: 'PENDING' });
      const acceptedCount = await BookingRequest.countDocuments({
        rideId: ride._id,
        status: { $in: ['ACCEPTED', 'ONGOING'] },
      });
      return { ...ride, pendingRequests: pendingCount, acceptedPassengers: acceptedCount };
    }));

    res.json({ rides: ridesWithCounts });
  } catch (err) { next(err); }
});

router.get('/my-trips', authenticate, async (req, res, next) => {
  try {
    const bookings = await BookingRequest.find({ passengerId: req.user._id })
      .populate('rideId', 'pickup dropoff schedule vehicle farePerSeat status driverId startedAt completedAt')
      .populate('driverId', 'name phone rating profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    // Map ride status to booking for easier frontend consumption
    const enriched = bookings.map((b) => ({
      ...b,
      // If ride is STARTED, reflect that in booking status for UI
      rideStatus: b.rideId?.status || null,
    }));

    res.json({ bookings: enriched });
  } catch (err) { next(err); }
});

// GET /api/bookings/requests — incoming (driver) + sent (passenger)
router.get('/requests', authenticate, async (req, res, next) => {
  try {
    console.log('[BookingRequests] Driver ID:', req.user._id);
    const [incoming, sent] = await Promise.all([
      // Incoming: user is the driver — return ALL statuses so driver Upcoming/Completed tabs work
      BookingRequest.find({
        driverId: req.user._id,
        status: { $in: ['PENDING', 'ACCEPTED', 'PAYMENT_DONE', 'OTP_VERIFIED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'REJECTED'] },
      })
        .populate('rideId', 'pickup dropoff schedule vehicle farePerSeat pricePerSeat otpCode')
        .populate('passengerId', 'name phone rating profilePhoto trustScore')
        .sort({ createdAt: -1 })
        .lean(),
      // Sent: user is the passenger, any non-completed status
      BookingRequest.find({ passengerId: req.user._id, status: { $in: ['PENDING', 'ACCEPTED', 'PAYMENT_DONE', 'OTP_VERIFIED', 'ONGOING', 'REJECTED'] } })
        .populate('rideId', 'pickup dropoff schedule vehicle farePerSeat pricePerSeat driverId')
        .populate('driverId', 'name phone rating profilePhoto')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    console.log('[BookingRequests] Incoming:', incoming.length, '| Sent:', sent.length);
    res.json({ incoming, sent, requests: incoming }); // 'requests' alias for backward compat
  } catch (err) { next(err); }
});

// Get all bookings for authenticated user
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const bookings = await BookingRequest.find({
        $or: [
          { passengerId: req.user._id },
          { driverId: req.user._id }
        ]
      }).populate('rideId', 'pickup dropoff schedule vehicle farePerSeat')
        .populate('passengerId', 'name phone')
        .populate('driverId', 'name phone')
        .lean();
      res.json({ bookings });
    } catch (err) {
      next(err);
    }
  }
);

// Passenger creates a booking request (any authenticated user can book)
router.post(
  '/',
  authenticate,
  createBookingRules,
  validate,
  checkDuplicateBooking,
  ctrl.createBooking
);

// Ride owner accepts a booking
router.post('/:id/accept', authenticate, checkDriverCancellationBlock, ctrl.acceptBooking);
router.patch('/:id/accept', authenticate, checkDriverCancellationBlock, ctrl.acceptBooking);

// Ride owner rejects a booking
router.post('/:id/reject', authenticate, ctrl.rejectBooking);
router.patch('/:id/reject', authenticate, ctrl.rejectBooking);

// Passenger cancels a booking
router.post(
  '/:id/cancel',
  authenticate,
  checkCancellationRate,
  ctrl.cancelBooking
);

// Passenger confirms dummy payment — ACCEPTED → PAYMENT_DONE
router.patch('/:id/payment-confirm', authenticate, ctrl.paymentConfirm);
router.post('/:id/payment-confirm', authenticate, ctrl.paymentConfirm);

// Passenger verifies OTP — PAYMENT_DONE → OTP_VERIFIED
router.post('/:id/verify-otp', authenticate, [
  body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
], validate, ctrl.verifyBookingOTP);
router.patch('/:id/verify-otp', authenticate, [
  body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
], validate, ctrl.verifyBookingOTP);

// Get booking details (passenger or driver)
router.get(
  '/:id',
  authenticate,
  ctrl.getBooking
);

// Manually lock seats (any user, before booking flow)
router.post(
  '/lock-seats',
  authenticate,
  [
    body('rideId').isMongoId().withMessage('Valid rideId is required'),
    body('seats').isInt({ min: 1, max: 6 }).withMessage('seats must be 1–6'),
    body('bookingId').isMongoId().withMessage('Valid bookingId is required'),
  ],
  validate,
  ctrl.lockSeatsApi
);

// Manually release a seat lock
router.post(
  '/release-seats',
  authenticate,
  [
    body('rideId').isMongoId().withMessage('Valid rideId is required'),
    body('bookingId').isMongoId().withMessage('Valid bookingId is required'),
  ],
  validate,
  ctrl.releaseSeatsApi
);

// ═══════════════════════════════════════════════════════════════════════════════
// RIDE LIFECYCLE APIS
// ═══════════════════════════════════════════════════════════════════════════════

// Driver starts the ride — generates OTP
router.post(
  '/start-ride',
  authenticate,
  [
    body('rideId').isMongoId().withMessage('Valid rideId is required'),
  ],
  validate,
  ctrl.startRide
);

// Driver ends the ride — marks as completed
router.post(
  '/end-ride',
  authenticate,
  [
    body('rideId').isMongoId().withMessage('Valid rideId is required'),
  ],
  validate,
  ctrl.endRide
);

// Passenger verifies OTP to board
router.post(
  '/verify-otp',
  authenticate,
  [
    body('bookingId').isMongoId().withMessage('Valid bookingId is required'),
    body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  ],
  validate,
  ctrl.verifyOTP
);

module.exports = router;
