const PLATFORM_FEE_PERCENT = 0.05; // 5% of per-seat cost

// ─── Fixed maintenance cost per vehicle type (₹/km) ──────────────────────────
// Optimized maintenance rates - updated for better pricing
const MAINTENANCE_PER_KM = {
  BIKE:      1.0,    // Reduced from 1.2
  AUTO:      1.8,    // Reduced from 2.0
  CAR:       2.4,    // Reduced from 2.75
  HATCHBACK: 2.2,    // Reduced from 2.5
  SEDAN:     2.6,    // Reduced from 3.0
  SUV:       3.0,    // Reduced from 3.5
  VAN:       2.7,    // Reduced from 3.0
};

const DEFAULT_MILEAGE = {
  CAR: 15,
  BIKE: 45, AUTO: 25, HATCHBACK: 18, SEDAN: 15, SUV: 12, VAN: 10,
};

const round2 = (n) => Math.round(n * 100) / 100;
const roundToNearest5 = (n) => Math.round(n / 5) * 5;

const getMaintenancePerKm = (vehicleType) => {
  const vt = String(vehicleType || '').toUpperCase();
  return MAINTENANCE_PER_KM[vt] ?? MAINTENANCE_PER_KM.CAR;
};

/**
 * Per-seat cost model:
 *   totalTripCost = fuelCost + maintenanceCost
 *   fuelCost      = (distanceKm × fuelPrice) / mileage
 *   maintenanceCost = distanceKm × maintenancePerKm
 *   perSeatCost   = totalTripCost / seatingCapacity
 *   pricePerSeat  = perSeatCost + platformFee  (rounded to nearest ₹5)
 *
 * NO surge, NO distance multipliers — only fuel + maintenance + platform fee.
 */
function computePerSeatPricing({
  distanceKm,
  fuelPrice,
  vehicleType,
  seatingCapacity,
  availableSeats,
  durationMin,
  mileageKmPerLitre,
  platformFeePerSeat = PLATFORM_FEE_PERCENT,
}) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0)
    throw Object.assign(new Error('distanceKm must be greater than 0'), { status: 400 });
  if (!Number.isFinite(fuelPrice) || fuelPrice <= 0)
    throw Object.assign(new Error('fuelPrice must be greater than 0'), { status: 400 });
  if (!Number.isFinite(seatingCapacity) || seatingCapacity < 2)
    throw Object.assign(new Error('seatingCapacity must be at least 2'), { status: 400 });
  if (!Number.isFinite(availableSeats) || availableSeats < 0)
    throw Object.assign(new Error('availableSeats must be 0 or more'), { status: 400 });

  const vt = String(vehicleType || '').toUpperCase();
  const mileage = mileageKmPerLitre ?? DEFAULT_MILEAGE[vt] ?? 15;
  if (!Number.isFinite(mileage) || mileage <= 0)
    throw Object.assign(new Error('mileageKmPerLitre must be greater than 0'), { status: 400 });

  const maintenancePerKm = getMaintenancePerKm(vt);

  const fuelCost        = round2((distanceKm * fuelPrice) / mileage);
  const maintenanceCost = round2(distanceKm * maintenancePerKm);
  const totalTripCost   = round2(fuelCost + maintenanceCost);

  const perSeatCost              = round2(totalTripCost / seatingCapacity);
  // platformFeePerSeat is a percentage (0.05 = 5%) — compute fee from per-seat cost
  const feeAmount                = round2(perSeatCost * platformFeePerSeat);
  const rawPassengerPricePerSeat = round2(perSeatCost + feeAmount);
  const passengerPricePerSeat    = roundToNearest5(rawPassengerPricePerSeat);

  const breakdown = {
    source: 'SMART',
    currency: 'INR',
    model: 'PER_SEAT_FULL_CAPACITY',
    computedAt: new Date(),
    inputs: {
      distanceKm: round2(distanceKm),
      durationMin: durationMin ?? null,
      fuelPrice: round2(fuelPrice),
      vehicleType: vt || null,
      seatingCapacity,
      availableSeats,
      mileageKmPerLitre: round2(mileage),
      maintenancePerKm,
      platformFeePerSeat,
      platformFeeAmount: feeAmount,
    },
    components: {
      fuelCost,
      maintenanceCost,
      totalTripCost,
      perSeatCost,
    },
    passenger: {
      rawPricePerSeat: rawPassengerPricePerSeat,
      pricePerSeat: passengerPricePerSeat,
      rounding: 'NEAREST_5',
    },
  };

  return {
    pricePerSeat: passengerPricePerSeat,
    breakdown,
  };
}

module.exports = {
  computePerSeatPricing,
  getMaintenancePerKm,
  PLATFORM_FEE_PERCENT,
  DEFAULT_MILEAGE,
  MAINTENANCE_PER_KM,
};
