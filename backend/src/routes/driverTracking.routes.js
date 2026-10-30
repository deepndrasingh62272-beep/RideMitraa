const router = require('express').Router();
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/driverTracking.controller');

/**
 * POST /api/tracking/go-online
 * Mark driver as online
 */
router.post(
  '/go-online',
  authenticate,
  [
    body('platform').optional().isString(),
    body('appVersion').optional().isString(),
    body('osVersion').optional().isString(),
  ],
  validate,
  ctrl.goOnline
);

/**
 * POST /api/tracking/go-offline
 * Mark driver as offline
 */
router.post(
  '/go-offline',
  authenticate,
  ctrl.goOffline
);

/**
 * POST /api/tracking/:rideId/location
 * Update driver location with speed and heading
 */
router.post(
  '/:rideId/location',
  authenticate,
  [
    param('rideId').notEmpty().withMessage('rideId is required'),
    body('latitude').isFloat().withMessage('latitude must be a number'),
    body('longitude').isFloat().withMessage('longitude must be a number'),
    body('speed').optional().isFloat({ min: 0 }),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('accuracy').optional().isFloat({ min: 0 }),
    body('altitude').optional().isFloat(),
  ],
  validate,
  ctrl.updateLocation
);

/**
 * POST /api/tracking/heartbeat
 * Record driver heartbeat
 */
router.post(
  '/heartbeat',
  authenticate,
  [
    body('batteryLevel').optional().isInt({ min: 0, max: 100 }),
    body('isCharging').optional().isBoolean(),
    body('networkType').optional().isString(),
  ],
  validate,
  ctrl.recordHeartbeat
);

/**
 * GET /api/tracking/driver/:driverId
 * Get driver's current tracking info
 */
router.get(
  '/driver/:driverId',
  [param('driverId').notEmpty().withMessage('driverId is required')],
  validate,
  ctrl.getDriverTracking
);

/**
 * GET /api/tracking/nearby
 * Get nearby online drivers
 */
router.get(
  '/nearby',
  [
    query('latitude').isFloat().withMessage('latitude must be a number'),
    query('longitude').isFloat().withMessage('longitude must be a number'),
    query('radius').optional().isFloat({ min: 0.1, max: 50 }),
  ],
  validate,
  ctrl.getNearbyDrivers
);

/**
 * GET /api/tracking/online-drivers
 * Get all online drivers
 */
router.get(
  '/online-drivers',
  ctrl.getOnlineDrivers
);

/**
 * GET /api/tracking/driver/:driverId/last-location
 * Get driver's last known location
 */
router.get(
  '/driver/:driverId/last-location',
  [param('driverId').notEmpty().withMessage('driverId is required')],
  validate,
  ctrl.getLastKnownLocation
);

/**
 * GET /api/tracking/driver/:driverId/stats
 * Get driver statistics
 */
router.get(
  '/driver/:driverId/stats',
  [param('driverId').notEmpty().withMessage('driverId is required')],
  validate,
  ctrl.getDriverStats
);

/**
 * GET /api/tracking/my-status
 * Get current user's tracking status
 */
router.get(
  '/my-status',
  authenticate,
  ctrl.getMyStatus
);

module.exports = router;
