/**
 * vehicleService.js
 * Fetches vehicle metadata by registration number + fuelType.
 * Tries external API first; falls back to smart defaults.
 */

const FUEL_DEFAULTS = {
  PETROL: { mileage: 18, vehicleType: 'SEDAN', seatingCapacity: 5 },
  DIESEL: { mileage: 22, vehicleType: 'SUV',   seatingCapacity: 7 },
  CNG:    { mileage: 25, vehicleType: 'SEDAN', seatingCapacity: 5 },
  EV:     { mileage: 0,  vehicleType: 'SEDAN', seatingCapacity: 5 },
};

const VALID_FUEL_TYPES = Object.keys(FUEL_DEFAULTS);

/**
 * @param {string} vehicleNumber - e.g. "DL01AB1234"
 * @param {string} fuelType      - PETROL | DIESEL | CNG | EV
 * @returns {Promise<{vehicleNumber, fuelType, mileage, vehicleType, seatingCapacity, fallback}>}
 */
exports.getVehicleInfo = async (vehicleNumber, fuelType) => {
  const normalized = fuelType?.toUpperCase();

  if (!VALID_FUEL_TYPES.includes(normalized)) {
    throw new Error('Invalid fuelType');
  }

  // Try external vehicle API if configured
  if (process.env.VEHICLE_API_KEY && process.env.VEHICLE_API_URL) {
    try {
      const axios = require('axios');
      const response = await axios.get(process.env.VEHICLE_API_URL, {
        params: { reg: vehicleNumber, key: process.env.VEHICLE_API_KEY },
        timeout: 3000,
      });

      const data = response.data;
      if (data && data.seatingCapacity && data.mileage) {
        return {
          vehicleNumber,
          fuelType: normalized,
          mileage: data.mileage,
          vehicleType: data.vehicleType || FUEL_DEFAULTS[normalized].vehicleType,
          seatingCapacity: data.seatingCapacity,
          fallback: false,
        };
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Return smart defaults based on fuelType
  const defaults = FUEL_DEFAULTS[normalized];
  return {
    vehicleNumber,
    fuelType: normalized,
    ...defaults,
    fallback: true,
  };
};

exports.VALID_FUEL_TYPES = VALID_FUEL_TYPES;
