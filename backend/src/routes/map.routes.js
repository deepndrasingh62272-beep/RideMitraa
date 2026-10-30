const router = require('express').Router();
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/map.controller');
const { proxyImage } = require('../middleware/imageProxy');

/**
 * POST /api/map/fare-estimate
 * Public — no auth needed (for showing price before login)
 */
router.post(
  '/fare-estimate',
  [
    body('originLat').isFloat().withMessage('originLat must be a number'),
    body('originLng').isFloat().withMessage('originLng must be a number'),
    body('destLat').isFloat().withMessage('destLat must be a number'),
    body('destLng').isFloat().withMessage('destLng must be a number'),
    body('vehicleType').optional().isString(),
    body('fuelPrice').optional().isFloat({ min: 1 }),
    body('mileage').optional().isFloat({ min: 1 }),
    body('passengers').optional().isInt({ min: 1 }),
  ],
  validate,
  ctrl.fareEstimate
);

/**
 * POST /api/map/live-location
 * Driver broadcasts live location
 */
router.post(
  '/live-location',
  authenticate,
  [
    body('lat').isFloat().withMessage('lat required'),
    body('lng').isFloat().withMessage('lng required'),
    body('heading').optional().isFloat(),
    body('speed').optional().isFloat(),
  ],
  validate,
  ctrl.updateLiveLocation
);

/**
 * GET /api/map/driver-location/:driverId
 * Get last known location of a driver
 */
router.get('/driver-location/:driverId', authenticate, ctrl.getDriverLocation);

/**
 * GET /api/map/geocode?address=...
 * Convert address to coordinates using Geoapify
 */
router.get(
  '/geocode',
  [query('address').notEmpty().withMessage('address is required')],
  validate,
  ctrl.geoapifyGeocode
);

/**
 * GET /api/map/reverse?lat=...&lng=...
 * Convert coordinates to address using Geoapify
 */
router.get(
  '/reverse',
  [
    query('lat').isFloat().withMessage('lat required'),
    query('lng').isFloat().withMessage('lng required'),
  ],
  validate,
  ctrl.geoapifyReverseGeocode
);

/**
 * GET /api/map/autocomplete?q=...&limit=5
 * Search for places using Geoapify autocomplete
 */
router.get(
  '/autocomplete',
  [query('q').notEmpty().withMessage('search query required')],
  validate,
  ctrl.geoapifySearch
);

/**
 * GET /api/map/route?pickupLat=...&pickupLng=...&dropLat=...&dropLng=...
 * Calculate route between two points using Geoapify
 */
router.get(
  '/route',
  [
    query('pickupLat').isFloat().withMessage('pickupLat required'),
    query('pickupLng').isFloat().withMessage('pickupLng required'),
    query('dropLat').isFloat().withMessage('dropLat required'),
    query('dropLng').isFloat().withMessage('dropLng required'),
  ],
  validate,
  ctrl.geoapifyRoute
);

/**
 * GET /api/image-proxy?url=<encoded-url>
 * Proxy external image requests with caching and error handling
 */
router.get('/image-proxy', proxyImage);

// Note: The geoapify endpoints are now available at the root level:
// - GET /api/map/geocode?address=... (uses Geoapify)
// - GET /api/map/reverse?lat=...&lng=... (uses Geoapify)
// - GET /api/map/autocomplete?q=...&limit=5 (uses Geoapify)
// - GET /api/map/route?pickupLat=...&pickupLng=...&dropLat=...&dropLng=... (uses Geoapify)
// - GET /api/map/image-proxy?url=<encoded-url> (proxies external images)

module.exports = router;
