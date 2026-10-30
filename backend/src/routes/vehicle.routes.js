const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/vehicle.controller');

/**
 * GET /api/vehicles/info?vehicleNumber=DL01AB1234&fuelType=PETROL
 * Returns seatingCapacity, mileage, vehicleType for a given vehicle
 */
router.get('/info', authenticate, ctrl.getVehicleInfo);

module.exports = router;
