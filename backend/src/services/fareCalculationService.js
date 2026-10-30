/**
 * Fare Calculation Service
 * 
 * Integrates Geoapify map distance with dynamic fare calculation.
 * Supports multiple vehicle types with helmet logic and cost-sharing.
 */

const axios = require('axios');
const { getRoute } = require('./geoapifyService');

// ─── Vehicle Configuration ──────────────────────────────────────────────────

const VEHICLE_CONFIG = {
  BIKE: {
    maxPassengers: 1,
    helmetRequired: true,
    helmetCost: 50, // ₹ per helmet (if passenger doesn't bring)
    maintenancePerKm: 1.5,
    defaultMileage: 45,
    platformFeePercent: 0.05, // 5% of per-seat cost
  },
  AUTO: {
    maxPassengers: 2,
    helmetRequired: false,
    maintenancePerKm: 2.5,
    defaultMileage: 25,
    platformFeePercent: 0.05,
  },
  HATCHBACK: {
    maxPassengers: 4,
    helmetRequired: false,
    maintenancePerKm: 2.8,
    defaultMileage: 18,
    platformFeePercent: 0.05,
  },
  SEDAN: {
    maxPassengers: 4,
    helmetRequired: false,
    maintenancePerKm: 3.2,
    defaultMileage: 15,
    platformFeePercent: 0.05,
  },
  SUV: {
    maxPassengers: 6,
    helmetRequired: false,
    maintenancePerKm: 4.5,
    defaultMileage: 12,
    platformFeePercent: 0.05,
  },
  VAN: {
    maxPassengers: 7,
    helmetRequired: false,
    maintenancePerKm: 5.0,
    defaultMileage: 10,
    platformFeePercent: 0.05,
  },
};

// ─── Pricing Constants ───────────────────────────────────────────────────────

const PRICING_CONFIG = {
  MIN_FARE: {
    BIKE: 30,
    AUTO: 50,
    HATCHBACK: 60,
    SEDAN: 80,
    SUV: 100,
    VAN: 120,
  },
  SURGE_MULTIPLIERS: {
    PEAK_MORNING: { hours: [7, 10], multiplier: 1.2 }, // 7-10 AM
    PEAK_EVENING: { hours: [17, 21], multiplier: 1.2 }, // 5-9 PM
    LATE_NIGHT: { hours: [23, 5], multiplier: 1.15 }, // 11 PM - 5 AM
    NORMAL: { multiplier: 1.0 },
  },
  DISTANCE_DISCOUNTS: {
    LONG_DISTANCE: { threshold: 100, multiplier: 0.9 }, // >100km = 10% off
    VERY_LONG_DISTANCE: { threshold: 300, multiplier: 0.85 }, // >300km = 15% off
  },
};

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get surge multiplier based on departure time (IST)
 */
const getSurgeMultiplier = (departureAt) => {
  if (!departureAt) return 1.0;
  
  const date = new Date(departureAt);
  const istHour = (date.getUTCHours() + 5.5) % 24; // IST offset
  
  const { PEAK_MORNING, PEAK_EVENING, LATE_NIGHT } = PRICING_CONFIG.SURGE_MULTIPLIERS;
  
  if (istHour >= PEAK_MORNING.hours[0] && istHour < PEAK_MORNING.hours[1]) {
    return PEAK_MORNING.multiplier;
  }
  if (istHour >= PEAK_EVENING.hours[0] && istHour < PEAK_EVENING.hours[1]) {
    return PEAK_EVENING.multiplier;
  }
  if (istHour >= LATE_NIGHT.hours[0] || istHour < LATE_NIGHT.hours[1]) {
    return LATE_NIGHT.multiplier;
  }
  
  return PRICING_CONFIG.SURGE_MULTIPLIERS.NORMAL.multiplier;
};

/**
 * Get distance-based discount multiplier
 */
const getDistanceMultiplier = (distanceKm) => {
  if (distanceKm > PRICING_CONFIG.DISTANCE_DISCOUNTS.VERY_LONG_DISTANCE.threshold) {
    return PRICING_CONFIG.DISTANCE_DISCOUNTS.VERY_LONG_DISTANCE.multiplier;
  }
  if (distanceKm > PRICING_CONFIG.DISTANCE_DISCOUNTS.LONG_DISTANCE.threshold) {
    return PRICING_CONFIG.DISTANCE_DISCOUNTS.LONG_DISTANCE.multiplier;
  }
  return 1.0;
};

/**
 * Round to nearest ₹5
 */
const roundToNearest5 = (amount) => {
  return Math.round(amount / 5) * 5;
};

/**
 * Round to 2 decimal places
 */
const round2 = (n) => Math.round(n * 100) / 100;

// ─── Main Fare Calculation ──────────────────────────────────────────────────

/**
 * Calculate fare for a ride using Geoapify distance
 * 
 * @param {Object} params
 * @param {number} params.pickupLat - Pickup latitude
 * @param {number} params.pickupLng - Pickup longitude
 * @param {number} params.dropLat - Dropoff latitude
 * @param {number} params.dropLng - Dropoff longitude
 * @param {string} params.vehicleType - BIKE, AUTO, HATCHBACK, SEDAN, SUV, VAN
 * @param {number} params.fuelPrice - Fuel price in ₹/litre
 * @param {number} [params.seatingCapacity] - Total seats (incl. driver)
 * @param {number} [params.availableSeats] - Passenger seats offered
 * @param {Date} [params.departureAt] - Departure time for surge calculation
 * @param {Object} [params.helmetInfo] - { passengerBringsHelmet: boolean }
 * @param {number} [params.mileage] - Vehicle mileage in km/litre
 * 
 * @returns {Promise<Object>} Fare breakdown with farePerSeat and totalRideCost
 */
async function calculateFareWithDistance({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  vehicleType,
  fuelPrice,
  seatingCapacity,
  availableSeats,
  departureAt,
  helmetInfo = {},
  mileage,
}) {
  try {
    // Validate inputs
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      throw new Error('Pickup and dropoff coordinates are required');
    }

    const vt = String(vehicleType || 'SEDAN').toUpperCase();
    if (!VEHICLE_CONFIG[vt]) {
      throw new Error(`Invalid vehicle type: ${vt}`);
    }

    if (!fuelPrice || fuelPrice <= 0) {
      throw new Error('Fuel price must be greater than 0');
    }

    // Get distance from Geoapify
    console.log(`[FareCalculation] Fetching route: (${pickupLat}, ${pickupLng}) → (${dropLat}, ${dropLng})`);
    const routeData = await getRoute(pickupLat, pickupLng, dropLat, dropLng);
    const distanceKm = routeData.distanceKm;
    const durationMin = routeData.durationMin;

    console.log(`[FareCalculation] Route: ${distanceKm}km, ${durationMin}min`);

    // Get vehicle config
    const config = VEHICLE_CONFIG[vt];
    const vehicleMileage = mileage || config.defaultMileage;
    const totalSeats = seatingCapacity || (vt === 'BIKE' ? 2 : 5);
    const passengerSeats = availableSeats || Math.max(1, totalSeats - 1);

    // Calculate base costs
    const fuelCost = round2((distanceKm * fuelPrice) / vehicleMileage);
    const maintenanceCost = round2(distanceKm * config.maintenancePerKm);
    const totalTripCost = round2(fuelCost + maintenanceCost);

    // Apply surge multiplier
    const surgeMultiplier = getSurgeMultiplier(departureAt);
    const surgedTripCost = round2(totalTripCost * surgeMultiplier);

    // Apply distance discount
    const distanceMultiplier = getDistanceMultiplier(distanceKm);
    const finalTripCost = round2(surgedTripCost * distanceMultiplier);

    // Calculate per-seat cost
    const perSeatCost = round2(finalTripCost / totalSeats);

    // Helmet logic (for bikes)
    let helmetCharge = 0;
    if (vt === 'BIKE' && !helmetInfo.passengerBringsHelmet) {
      helmetCharge = config.helmetCost;
    }

    // Platform fee — 5% of per-seat cost
    const platformFeePercent = config.platformFeePercent;
    const platformFee = round2(perSeatCost * platformFeePercent);

    // Final passenger price per seat
    const rawFarePerSeat = round2(perSeatCost + platformFee + helmetCharge);
    const farePerSeat = roundToNearest5(rawFarePerSeat);

    // Total ride cost for all passengers
    const totalRideCost = round2(farePerSeat * passengerSeats);

    // Driver earnings (total trip cost minus platform fees)
    const totalPlatformFees = round2(platformFee * passengerSeats);
    const driverEarnings = round2(finalTripCost - totalPlatformFees);

    // Detailed breakdown
    const breakdown = {
      source: 'GEOAPIFY_INTEGRATED',
      currency: 'INR',
      timestamp: new Date(),
      
      // Route info
      route: {
        distanceKm: round2(distanceKm),
        durationMin,
        pickupCoordinates: [pickupLng, pickupLat],
        dropoffCoordinates: [dropLng, dropLat],
      },

      // Vehicle info
      vehicle: {
        type: vt,
        seatingCapacity: totalSeats,
        passengerSeats,
        mileage: round2(vehicleMileage),
        maintenancePerKm: config.maintenancePerKm,
      },

      // Cost components
      costs: {
        fuelPrice: round2(fuelPrice),
        fuelCost: round2(fuelCost),
        maintenanceCost: round2(maintenanceCost),
        baseTripCost: round2(totalTripCost),
        surgeMultiplier: round2(surgeMultiplier),
        surgedTripCost: round2(surgedTripCost),
        distanceMultiplier: round2(distanceMultiplier),
        finalTripCost: round2(finalTripCost),
      },

      // Per-seat breakdown
      perSeat: {
        baseCost: round2(perSeatCost),
        platformFeePercent,
        platformFee,
        helmetCharge,
        rawFarePerSeat: round2(rawFarePerSeat),
        farePerSeat,
        rounding: 'NEAREST_5',
      },

      // Totals
      totals: {
        passengerCount: passengerSeats,
        totalRideCost,
        totalPlatformFees,
        totalHelmetCharges: round2(helmetCharge * passengerSeats),
        driverEarnings,
      },

      // Helmet info
      helmet: {
        required: config.helmetRequired,
        passengerBringsHelmet: helmetInfo.passengerBringsHelmet || false,
        chargeIfNotBrought: config.helmetCost,
      },
    };

    return {
      success: true,
      farePerSeat,
      totalRideCost,
      breakdown,
    };
  } catch (err) {
    console.error('[FareCalculation] Error:', err.message);
    throw err;
  }
}

/**
 * Calculate fare for multiple vehicle types
 * Returns comparison of all vehicle options
 */
async function calculateFareComparison({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  fuelPrice,
  departureAt,
  vehicleTypes = ['BIKE', 'AUTO', 'HATCHBACK', 'SEDAN', 'SUV'],
}) {
  try {
    const results = {};

    for (const vt of vehicleTypes) {
      try {
        const fare = await calculateFareWithDistance({
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
          vehicleType: vt,
          fuelPrice,
          departureAt,
        });

        results[vt] = {
          farePerSeat: fare.farePerSeat,
          totalRideCost: fare.totalRideCost,
          maxPassengers: VEHICLE_CONFIG[vt].maxPassengers,
          breakdown: fare.breakdown,
        };
      } catch (err) {
        console.warn(`[FareCalculation] Failed for ${vt}:`, err.message);
        results[vt] = { error: err.message };
      }
    }

    return {
      success: true,
      comparison: results,
      recommended: Object.entries(results)
        .filter(([_, data]) => !data.error)
        .sort((a, b) => a[1].farePerSeat - b[1].farePerSeat)[0]?.[0] || 'SEDAN',
    };
  } catch (err) {
    console.error('[FareCalculation] Comparison error:', err.message);
    throw err;
  }
}

/**
 * Validate fare calculation parameters
 */
function validateFareParams({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  vehicleType,
  fuelPrice,
}) {
  const errors = [];

  if (!pickupLat || !pickupLng) errors.push('Pickup coordinates required');
  if (!dropLat || !dropLng) errors.push('Dropoff coordinates required');
  if (!vehicleType) errors.push('Vehicle type required');
  if (!fuelPrice || fuelPrice <= 0) errors.push('Valid fuel price required');

  if (pickupLat && (pickupLat < -90 || pickupLat > 90)) errors.push('Invalid pickup latitude');
  if (pickupLng && (pickupLng < -180 || pickupLng > 180)) errors.push('Invalid pickup longitude');
  if (dropLat && (dropLat < -90 || dropLat > 90)) errors.push('Invalid dropoff latitude');
  if (dropLng && (dropLng < -180 || dropLng > 180)) errors.push('Invalid dropoff longitude');

  if (vehicleType && !VEHICLE_CONFIG[String(vehicleType).toUpperCase()]) {
    errors.push(`Invalid vehicle type: ${vehicleType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  calculateFareWithDistance,
  calculateFareComparison,
  validateFareParams,
  getSurgeMultiplier,
  getDistanceMultiplier,
  VEHICLE_CONFIG,
  PRICING_CONFIG,
};
