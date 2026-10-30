/**
 * Fare Calculation Routes
 */

const express = require('express');
const router = express.Router();
const {
  calculateFare,
  compareFares,
  estimateFare,
  getVehicleConfig,
} = require('../controllers/fareCalculation.controller');

/**
 * POST /api/fare/calculate
 * Calculate fare for a specific vehicle type with full breakdown
 */
router.post('/calculate', calculateFare);

/**
 * POST /api/fare/compare
 * Compare fares across multiple vehicle types
 */
router.post('/compare', compareFares);

/**
 * GET /api/fare/estimate
 * Quick fare estimate using query parameters
 */
router.get('/estimate', estimateFare);

/**
 * GET /api/fare/vehicle-config
 * Get vehicle configuration and pricing information
 */
router.get('/vehicle-config', getVehicleConfig);

module.exports = router;
