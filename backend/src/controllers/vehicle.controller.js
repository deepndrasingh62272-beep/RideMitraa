const { getVehicleInfo, VALID_FUEL_TYPES } = require('../utils/vehicleService');

/**
 * GET /api/vehicles/info?vehicleNumber=DL01AB1234&fuelType=PETROL
 */
exports.getVehicleInfo = async (req, res, next) => {
  try {
    const { vehicleNumber, fuelType } = req.query;

    if (!vehicleNumber || !fuelType) {
      return res.status(400).json({ error: 'vehicleNumber and fuelType are required' });
    }

    if (!VALID_FUEL_TYPES.includes(fuelType.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid fuelType',
        validValues: VALID_FUEL_TYPES,
      });
    }

    const info = await getVehicleInfo(vehicleNumber, fuelType);
    res.json(info);
  } catch (err) {
    if (err.message === 'Invalid fuelType') {
      return res.status(400).json({ error: 'Invalid fuelType', validValues: VALID_FUEL_TYPES });
    }
    next(err);
  }
};
