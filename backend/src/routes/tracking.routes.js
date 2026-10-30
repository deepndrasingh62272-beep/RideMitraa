const router = require('express').Router();
const { body } = require('express-validator');
const validate    = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/tracking.controller');

// Ride owner pushes location update (ownership enforced in service/controller)
router.post(
  '/:rideId/location',
  authenticate,
  [
    body('coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('coordinates must be [lng, lat]'),
    body('coordinates.*').isFloat().withMessage('coordinates must be numbers'),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('speedKmh').optional().isFloat({ min: 0 }),
  ],
  validate,
  ctrl.updateLocation
);

// Passenger (or driver) gets live location + ETA
router.get('/:rideId/location', authenticate, ctrl.getLocation);

// Driver or passenger gets full route history
router.get('/:rideId/history', authenticate, ctrl.getHistory);

module.exports = router;
