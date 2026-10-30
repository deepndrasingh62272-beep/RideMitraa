/**
 * Fare Calculation Controller
 * 
 * Endpoints for calculating fares using Geoapify distance integration
 */

const {
  calculateFareWithDistance,
  calculateFareComparison,
  validateFareParams,
} = require('../services/fareCalculationService');

/**
 * POST /api/fare/calculate
 * Calculate fare for a specific vehicle type
 * 
 * Body:
 * {
 *   pickupLat: number,
 *   pickupLng: number,
 *   dropLat: number,
 *   dropLng: number,
 *   vehicleType: 'BIKE' | 'AUTO' | 'HATCHBACK' | 'SEDAN' | 'SUV' | 'VAN',
 *   fuelPrice: number,
 *   seatingCapacity?: number,
 *   availableSeats?: number,
 *   departureAt?: ISO8601 date,
 *   helmetInfo?: { passengerBringsHelmet: boolean },
 *   mileage?: number
 * }
 */
exports.calculateFare = async (req, res, next) => {
  try {
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      vehicleType,
      fuelPrice,
      seatingCapacity,
      availableSeats,
      departureAt,
      helmetInfo,
      mileage,
    } = req.body;

    // Validate required parameters
    const validation = validateFareParams({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      vehicleType,
      fuelPrice,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Calculate fare
    const result = await calculateFareWithDistance({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
      vehicleType,
      fuelPrice: parseFloat(fuelPrice),
      seatingCapacity: seatingCapacity ? parseInt(seatingCapacity) : undefined,
      availableSeats: availableSeats ? parseInt(availableSeats) : undefined,
      departureAt: departureAt ? new Date(departureAt) : new Date(),
      helmetInfo: helmetInfo || {},
      mileage: mileage ? parseFloat(mileage) : undefined,
    });

    res.json({
      success: true,
      data: {
        farePerSeat: result.farePerSeat,
        totalRideCost: result.totalRideCost,
        breakdown: result.breakdown,
      },
    });
  } catch (err) {
    console.error('[FareCalculation] Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Fare calculation failed',
    });
  }
};

/**
 * POST /api/fare/compare
 * Compare fares across multiple vehicle types
 * 
 * Body:
 * {
 *   pickupLat: number,
 *   pickupLng: number,
 *   dropLat: number,
 *   dropLng: number,
 *   fuelPrice: number,
 *   departureAt?: ISO8601 date,
 *   vehicleTypes?: string[] (default: all types)
 * }
 */
exports.compareFares = async (req, res, next) => {
  try {
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      fuelPrice,
      departureAt,
      vehicleTypes,
    } = req.body;

    // Validate required parameters
    const validation = validateFareParams({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      vehicleType: 'SEDAN', // Just for validation
      fuelPrice,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Calculate comparison
    const result = await calculateFareComparison({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
      fuelPrice: parseFloat(fuelPrice),
      departureAt: departureAt ? new Date(departureAt) : new Date(),
      vehicleTypes: vehicleTypes || ['BIKE', 'AUTO', 'HATCHBACK', 'SEDAN', 'SUV', 'VAN'],
    });

    res.json({
      success: true,
      data: {
        comparison: result.comparison,
        recommended: result.recommended,
      },
    });
  } catch (err) {
    console.error('[FareCalculation] Comparison error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Fare comparison failed',
    });
  }
};

/**
 * GET /api/fare/estimate
 * Quick fare estimate (query parameters)
 * 
 * Query Params:
 *   - pickupLat, pickupLng, dropLat, dropLng (required)
 *   - vehicleType (required)
 *   - fuelPrice (required)
 *   - seatingCapacity, availableSeats, mileage (optional)
 */
exports.estimateFare = async (req, res, next) => {
  try {
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      vehicleType,
      fuelPrice,
      seatingCapacity,
      availableSeats,
      mileage,
    } = req.query;

    // Validate required parameters
    const validation = validateFareParams({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
      vehicleType,
      fuelPrice: parseFloat(fuelPrice),
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Calculate fare
    const result = await calculateFareWithDistance({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
      vehicleType,
      fuelPrice: parseFloat(fuelPrice),
      seatingCapacity: seatingCapacity ? parseInt(seatingCapacity) : undefined,
      availableSeats: availableSeats ? parseInt(availableSeats) : undefined,
      mileage: mileage ? parseFloat(mileage) : undefined,
    });

    res.json({
      success: true,
      data: {
        farePerSeat: result.farePerSeat,
        totalRideCost: result.totalRideCost,
        breakdown: result.breakdown,
      },
    });
  } catch (err) {
    console.error('[FareCalculation] Estimate error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Fare estimation failed',
    });
  }
};

/**
 * GET /api/fare/vehicle-config
 * Get vehicle configuration and pricing info
 */
exports.getVehicleConfig = async (req, res, next) => {
  try {
    const { VEHICLE_CONFIG, PRICING_CONFIG } = require('../services/fareCalculationService');

    res.json({
      success: true,
      data: {
        vehicles: VEHICLE_CONFIG,
        pricing: PRICING_CONFIG,
      },
    });
  } catch (err) {
    console.error('[FareCalculation] Config error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
    });
  }
};
