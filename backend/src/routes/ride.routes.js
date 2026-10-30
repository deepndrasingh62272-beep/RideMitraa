const router = require('express').Router();
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireApprovedDriver } = require('../middleware/auth');
const ctrl = require('../controllers/ride.controller');
const { uploadRidePhoto } = require('../config/cloudinary');

const { SEAT_RULES } = require('../utils/seatValidation');

// ─── Validation rules ────────────────────────────────────────────────────────

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
  body(`${prefix}.coordinates.*`)
    .isFloat()
    .withMessage(`${prefix} coordinates must be numbers`),
];

const publishRules = [
  ...locationRules('pickup'),
  ...locationRules('dropoff'),
  body('vehicle.type')
    .isIn(['CAR', 'SEDAN', 'SUV', 'HATCHBACK', 'BIKE', 'AUTO', 'VAN'])
    .withMessage('Invalid vehicle type'),
  body('vehicleType')
    .optional()
    .isIn(['CAR', 'BIKE'])
    .withMessage('vehicleType must be CAR or BIKE'),
  body('vehicle.name').notEmpty().withMessage('Vehicle name is required'),
  body('vehicle.registrationNumber')
    .notEmpty().withMessage('Vehicle registration number is required'),
  body('vehicle.seatingCapacity')
    .isInt({ min: 2, max: 9 })
    .withMessage('vehicle.seatingCapacity must be between 2 and 9')
    .custom((capacity, { req }) => {
      const type = req.body?.vehicle?.type?.toUpperCase();
      const rule = SEAT_RULES[type];
      if (rule && !rule.allowedTotal.includes(capacity)) {
        throw new Error(
          `${type} must have seatingCapacity of ${rule.allowedTotal.join(' or ')}`
        );
      }
      return true;
    }),
  body('schedule.date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be YYYY-MM-DD'),
  body('schedule.time')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Time must be HH:MM'),
  body('farePerSeat').optional().isFloat({ min: 0 }).withMessage('Fare must be a positive number'),
  body('pricePerSeat').optional().isFloat({ min: 0 }).withMessage('pricePerSeat must be a positive number'),
  body('genderPreference')
    .optional()
    .isIn(['ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'OTHER_ONLY'])
    .withMessage('Invalid genderPreference'),
  body('pickupRadius')
    .optional()
    .isInt({ min: 300, max: 500 })
    .withMessage('pickupRadius must be between 300 and 500 meters'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// Fare estimate — public, no auth needed
router.get('/fare-estimate', ctrl.fareEstimate);

// Fuel-based fare breakdown — public
router.post('/fare-breakdown', ctrl.fareBreakdown);

// Smart ride matching — public
router.get('/match', ctrl.matchRides);

// Publish a ride — any authenticated user (KYC not required for testing)
router.post('/', authenticate, publishRules, validate, ctrl.publishRide);

// Search rides — public
router.get('/', ctrl.searchRides);

// Search rides — public (alternative endpoint)
router.get('/search', ctrl.searchRides);

// Get driver's own published rides — authenticated drivers only
router.get('/published', authenticate, async (req, res, next) => {
  try {
    const Ride = require('../models/Ride');
    const rides = await Ride.find({ driverId: req.user._id })
      .select('pickup dropoff schedule vehicle totalSeats availableSeats farePerSeat status')
      .lean();
    res.json({ rides });
  } catch (err) {
    next(err);
  }
});

// my-rides alias — excludes CANCELLED rides by default unless ?showCancelled=true
router.get('/my-rides', authenticate, async (req, res, next) => {
  try {
    const Ride = require('../models/Ride');
    const filter = { driverId: req.user._id };
    if (req.query.showCancelled !== 'true') {
      filter.status = { $ne: 'CANCELLED' };
    }
    const rides = await Ride.find(filter)
      .select('pickup dropoff schedule vehicle totalSeats availableSeats farePerSeat status startedAt completedAt')
      .sort({ 'schedule.departureAt': -1 })
      .lean();
    res.json({ rides });
  } catch (err) {
    next(err);
  }
});

// Get scheduled rides — authenticated users
router.get('/scheduled', authenticate, ctrl.getScheduledRides);

// Get carpool rides near a location — authenticated users
router.get('/carpool', authenticate, ctrl.getCarpoolRides);

// Get single ride — public
router.get('/:id', ctrl.getRide);

// Get ride OTP — driver only
router.get('/:id/otp', authenticate, ctrl.getRideOTP);

// Update ride — owning driver only
router.put('/:id', authenticate, requireApprovedDriver, ctrl.updateRide);

// Start ride — driver only (POST and PATCH both supported)
router.post('/:id/start', authenticate, requireApprovedDriver, ctrl.startRide);
router.patch('/:id/start', authenticate, requireApprovedDriver, ctrl.startRide);

// End/complete ride — driver only (POST and PATCH both supported)
router.post('/:id/end', authenticate, requireApprovedDriver, ctrl.endRide);
router.patch('/:id/end', authenticate, requireApprovedDriver, ctrl.endRide);
router.post('/:id/complete', authenticate, requireApprovedDriver, ctrl.endRide);
router.patch('/:id/complete', authenticate, requireApprovedDriver, ctrl.endRide);

// Board a passenger — driver only
router.post(
  '/:id/board-passenger',
  authenticate,
  requireApprovedDriver,
  [body('passengerId').isMongoId().withMessage('Valid passengerId is required')],
  validate,
  ctrl.boardPassenger
);

// Upload ride photo — driver or passenger (during active ride)
router.post(
  '/:id/photo',
  authenticate,
  uploadRidePhoto.single('photo'),
  ctrl.uploadRidePhoto
);

// Cancel ride — driver only, only if BOOKING_OPEN or CREATED (not started)
router.post('/:id/cancel', authenticate, ctrl.cancelRide);

module.exports = router;
