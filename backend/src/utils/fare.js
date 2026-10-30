/**
 * Smart Fare Calculator
 *
 * Base rates (INR per km) by vehicle type.
 * Applies surge multipliers for peak hours and long distances.
 */

const BASE_RATES = {
  CAR: 12,
  BIKE: 4,
  AUTO: 8,
  HATCHBACK: 10,
  SEDAN: 12,
  SUV: 15,
  VAN: 18,
};

const MIN_FARE = {
  CAR: 80,
  BIKE: 30,
  AUTO: 50,
  HATCHBACK: 60,
  SEDAN: 80,
  SUV: 100,
  VAN: 120,
};

/**
 * Returns a surge multiplier based on hour of day (IST).
 * Peak: 7-10am, 5-9pm → 1.2x
 * Late night: 11pm-5am → 1.15x
 */
const getSurgeMultiplier = (departureAt) => {
  const hour = new Date(departureAt).getUTCHours() + 5; // rough IST offset
  const h = hour % 24;
  if ((h >= 7 && h < 10) || (h >= 17 && h < 21)) return 1.2;
  if (h >= 23 || h < 5) return 1.15;
  return 1.0;
};

/**
 * Long-distance discount: >100km gets 10% off base
 */
const getDistanceMultiplier = (distanceKm) => {
  if (distanceKm > 300) return 0.85;
  if (distanceKm > 100) return 0.9;
  return 1.0;
};

/**
 * calculateFare(vehicleType, distanceKm, departureAt)
 * Returns fare per seat in INR, rounded to nearest ₹5
 */
const calculateFare = (vehicleType, distanceKm, departureAt = new Date()) => {
  const baseRate = BASE_RATES[vehicleType] ?? BASE_RATES.SEDAN;
  const surge = getSurgeMultiplier(departureAt);
  const distMult = getDistanceMultiplier(distanceKm);

  const raw = baseRate * distanceKm * surge * distMult;
  const fare = Math.max(raw, MIN_FARE[vehicleType] ?? 60);

  // Round to nearest ₹5
  return Math.round(fare / 5) * 5;
};

/**
 * Haversine distance between two [lng, lat] coordinate pairs (in km)
 */
const haversineDistance = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Rounds to 2 decimal places */
const round2 = (n) => Math.round(n * 100) / 100;

// ─── Per-km charge by vehicle category ───────────────────────────────────────
const PER_KM_CHARGE = {
  car:  2.75,  // Updated: 2.5-3.0 average
  bike: 1.2,   // Updated: 1.2 per km
};

/**
 * calculateRideFare(distance, fuelPrice, mileage, passengersCount)
 * ─────────────────────────────────────────────────────────────────
 * Original fuel-based engine with a fixed ₹3.5/km road overhead.
 * Kept for backward compatibility with existing ride-publishing flow.
 */
function calculateRideFare(distance, fuelPrice, mileage, passengersCount) {
  return _computeFare(distance, fuelPrice, mileage, passengersCount, 'car');
}

/**
 * calculateFareByVehicle(distance, fuelPrice, vehicleMileage, passengersCount, vehicleType)
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Vehicle-aware cost-sharing engine.
 *
 * Formula:
 *   perKmCharge    = car → ₹3.5/km  |  bike → ₹1.5/km
 *   totalRideCost  = (distance × fuelPrice ÷ vehicleMileage) + (distance × perKmCharge)
 *   totalSeats     = passengersCount + 1   (driver occupies one seat)
 *   perSeatCost    = totalRideCost ÷ totalSeats
 *   platformFee    = 5% of perSeatCost (percentage-based)
 *   pricePerPassenger = perSeatCost + platformFee
 *   totalAmount    = pricePerPassenger × passengersCount
 *   driverEarns    = totalRideCost - (platformFee × passengersCount)
 *
 * @param {number} distance        - Trip distance in km
 * @param {number} fuelPrice       - Fuel price in ₹/litre
 * @param {number} vehicleMileage  - Vehicle mileage in km/litre
 * @param {number} passengersCount - Number of passengers (excluding driver)
 * @param {'car'|'bike'} vehicleType
 * @returns {{
 *   totalRideCost:     number,
 *   perSeatCost:       number,
 *   platformFee:       number,
 *   pricePerPassenger: number,
 *   totalAmount:       number,
 *   driverEarns:       number
 * }}
 */
function calculateFareByVehicle(distance, fuelPrice, vehicleMileage, passengersCount, vehicleType) {
  const type = String(vehicleType).toLowerCase();
  if (!PER_KM_CHARGE[type])
    throw new Error(`vehicleType must be "car" or "bike", got "${vehicleType}"`);
  return _computeFare(distance, fuelPrice, vehicleMileage, passengersCount, type);
}

/**
 * Shared core computation used by both exported functions.
 */
function _computeFare(distance, fuelPrice, mileage, passengersCount, vehicleType) {
  if (distance <= 0)       throw new Error('distance must be greater than 0');
  if (fuelPrice <= 0)      throw new Error('fuelPrice must be greater than 0');
  if (mileage <= 0)        throw new Error('mileage must be greater than 0');
  if (passengersCount < 1) throw new Error('passengersCount must be at least 1');

  const PLATFORM_FEE_PERCENT = 0.05; // 5% of per-seat cost
  const perKmCharge  = PER_KM_CHARGE[vehicleType];

  const fuelCost      = (distance * fuelPrice) / mileage;
  const overhead      = distance * perKmCharge;
  const totalRideCost = round2(fuelCost + overhead);

  const totalSeats        = passengersCount + 1;
  const perSeatCost       = round2(totalRideCost / totalSeats);
  const platformFee       = round2(perSeatCost * PLATFORM_FEE_PERCENT);
  const pricePerPassenger = round2(perSeatCost + platformFee);
  const totalAmount       = round2(pricePerPassenger * passengersCount);
  const driverEarns       = round2(totalRideCost - platformFee * passengersCount);

  return { totalRideCost, perSeatCost, platformFee, pricePerPassenger, totalAmount, driverEarns };
}

module.exports = { calculateFare, haversineDistance, calculateRideFare, calculateFareByVehicle, getSurgeMultiplier, MIN_FARE };

// ─── Real Fare Calculator ────────────────────────────────────────────────────

const DEFAULT_MILEAGE = {
  CAR: 15,
  BIKE: 45, AUTO: 25, HATCHBACK: 18, SEDAN: 15, SUV: 12, VAN: 10,
};
const MAINTENANCE_PER_KM = 3.5;
const REAL_FARE_PLATFORM_FEE_PERCENT = 0.05; // 5% of per-seat cost

/**
 * calculateRealFare — cost-sharing fare based on fuel + maintenance
 * @param {object} opts
 * @param {number} opts.distanceKm
 * @param {number} opts.fuelPrice  ₹/litre
 * @param {number} [opts.mileage]  km/litre (defaults by vehicleType)
 * @param {number} opts.availableSeats
 * @param {string} [opts.vehicleType]
 * @returns {number} per-seat fare rounded to nearest ₹5
 */
function calculateRealFare({ distanceKm, fuelPrice, mileage, availableSeats, vehicleType }) {
  if (distanceKm <= 0) throw new Error('distanceKm must be greater than 0');
  if (availableSeats < 1) throw new Error('availableSeats must be at least 1');
  const m = mileage ?? DEFAULT_MILEAGE[(vehicleType || '').toUpperCase()] ?? 15;
  const fuelCost = (distanceKm * fuelPrice) / m;
  const maintenanceCost = distanceKm * MAINTENANCE_PER_KM;
  const totalCost = fuelCost + maintenanceCost;
  const perSeatCost = totalCost / availableSeats;
  const platformFee = perSeatCost * REAL_FARE_PLATFORM_FEE_PERCENT;
  const finalPrice = perSeatCost + platformFee;
  return Math.round(finalPrice / 5) * 5;
}

// Re-export with calculateRealFare included
module.exports.calculateRealFare = calculateRealFare;
