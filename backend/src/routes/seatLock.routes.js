const router = require('express').Router();
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/seatLock.controller');

/**
 * POST /api/seat-locks/lock
 * Lock a seat for a ride
 */
router.post(
  '/lock',
  authenticate,
  [
    body('rideId').notEmpty().withMessage('rideId is required'),
    body('seatNumber').notEmpty().withMessage('seatNumber is required'),
  ],
  validate,
  ctrl.lockSeat
);

/**
 * POST /api/seat-locks/:lockId/confirm
 * Confirm a seat lock
 */
router.post(
  '/:lockId/confirm',
  authenticate,
  [param('lockId').notEmpty().withMessage('lockId is required')],
  validate,
  ctrl.confirmLock
);

/**
 * POST /api/seat-locks/:lockId/release
 * Release a seat lock
 */
router.post(
  '/:lockId/release',
  authenticate,
  [param('lockId').notEmpty().withMessage('lockId is required')],
  validate,
  ctrl.releaseLock
);

/**
 * GET /api/seat-locks/ride/:rideId
 * Get all active locks for a ride
 */
router.get(
  '/ride/:rideId',
  [param('rideId').notEmpty().withMessage('rideId is required')],
  validate,
  ctrl.getRideLocks
);

/**
 * GET /api/seat-locks/user/active
 * Get user's active locks
 */
router.get(
  '/user/active',
  authenticate,
  ctrl.getUserLocks
);

/**
 * GET /api/seat-locks/:lockId/validate
 * Validate a seat lock
 */
router.get(
  '/:lockId/validate',
  authenticate,
  [param('lockId').notEmpty().withMessage('lockId is required')],
  validate,
  ctrl.validateLock
);

/**
 * GET /api/seat-locks/ride/:rideId/available
 * Check if a specific seat is available
 */
router.get(
  '/ride/:rideId/available',
  [
    param('rideId').notEmpty().withMessage('rideId is required'),
    query('seatNumber').notEmpty().withMessage('seatNumber is required'),
  ],
  validate,
  ctrl.checkSeatAvailability
);

/**
 * POST /api/seat-locks/cleanup
 * Cleanup expired locks (admin only)
 */
router.post(
  '/cleanup',
  authenticate,
  ctrl.cleanupExpiredLocks
);

module.exports = router;
