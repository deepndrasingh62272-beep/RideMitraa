const Ride = require('../models/Ride');
const User = require('../models/User');
const { calculateFareByVehicle, haversineDistance, getSurgeMultiplier } = require('../utils/fare');
const { calculateAvailableSeats, validatePassengerCount, SEAT_RULES } = require('../utils/seatValidation');
const { findMatchingRides } = require('../utils/rideMatch');
const { notify } = require('../utils/notify');
const BookingRequest = require('../models/BookingRequest');
const { recalculateTrustScore } = require('../utils/trustScore');
const { geocodeLocation } = require('../utils/geocoding');
const { getRoadDistance } = require('../utils/routing');
const { getFuelPrice } = require('../utils/fuelPrice');
const { computePerSeatPricing } = require('../utils/pricingEngine');
const { obfuscateRidePickup } = require('../utils/locationPrivacy');
const { getPlatformConfig } = require('../services/platformConfigService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const buildDepartureDate = (date, time) => {
  const dt = new Date(`${date}T${time}:00+05:30`); // IST
  if (isNaN(dt)) throw Object.assign(new Error('Invalid date or time'), { status: 400 });
  return dt;
};

const getRidePolicy = async () => {
  const cfg = await getPlatformConfig();
  return {
    defaultFuelPrice: Number(cfg?.pricing?.defaultFuelPrice ?? 103),
    freeWaitMinutes: Number(cfg?.penalties?.freeWaitMinutes ?? 5),
  };
};

const deriveRideVehicleType = (vehicleType, legacyVehicleType) => {
  const explicit = String(vehicleType || '').toUpperCase();
  if (explicit === 'CAR' || explicit === 'BIKE') return explicit;
  return String(legacyVehicleType || '').toUpperCase() === 'BIKE' ? 'BIKE' : 'CAR';
};

const normalizeGenderPreference = (value) => {
  const normalized = String(value || 'ANY').toUpperCase();
  const allowed = new Set(['ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'OTHER_ONLY']);
  if (!allowed.has(normalized)) {
    throw Object.assign(new Error('Invalid genderPreference'), { status: 400 });
  }
  return normalized;
};

const normalizePickupRadius = (value) => {
  const n = Number(value ?? 300);
  if (!Number.isFinite(n) || n < 300 || n > 500) {
    throw Object.assign(new Error('pickupRadius must be between 300 and 500 meters'), { status: 400 });
  }
  return n;
};

const applyVehicleTypeFilter = (filter, vehicleType) => {
  if (!vehicleType) return;
  const vt = String(vehicleType).toUpperCase();
  if (vt === 'CAR' || vt === 'BIKE') filter.vehicleType = vt;
  else filter['vehicle.type'] = vt;
};

// ─── POST /api/rides ─────────────────────────────────────────────────────────

exports.publishRide = async (req, res, next) => {
  try {
    const {
      pickup,    // { name, address, coordinates: [lng, lat] }
      dropoff,
      vehicle,   // { type, name, registrationNumber, seatingCapacity }
      schedule,  // { date: 'YYYY-MM-DD', time: 'HH:MM' }
      farePerSeat,
      pricePerSeat,
      isScheduled,
      scheduledTime,
      isCarpool,
      carpoolGroupId,
      vehicleType,
      genderPreference,
      pickupRadius,
    } = req.body;

    // ── KYC/Photo verification guard ────────────────────────────────────────
    const driver = await User.findById(req.user._id).select('faceVerified kycStatus').lean();
    if (driver.kycStatus !== 'APPROVED') {
      return res.status(403).json({ error: 'KYC verification required before publishing rides' });
    }

    // ── Location validation ─────────────────────────────────────────────────
    const toLngLat = (loc, label) => {
      const coords = loc?.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2)
        throw Object.assign(new Error(`${label}.coordinates must be [lng, lat]`), { status: 400 });
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat))
        throw Object.assign(new Error(`${label}.coordinates must be numbers`), { status: 400 });
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw Object.assign(new Error(`${label}.coordinates out of range`), { status: 400 });
      return { lng, lat };
    };

    const pickupLL = toLngLat(pickup, 'pickup');
    const dropoffLL = toLngLat(dropoff, 'dropoff');

    // Optional geocoding enrichment (city/state) — do not hard-fail on external lookups
    let pickupGeo = null;
    let dropoffGeo = null;
    try {
      [pickupGeo, dropoffGeo] = await Promise.all([
        geocodeLocation(pickup.address || pickup.name),
        geocodeLocation(dropoff.address || dropoff.name),
      ]);
    } catch {
      // Non-fatal
    }

    // ── Scheduled ride validation ────────────────────────────────────────────
    if (isScheduled === true) {
      if (!scheduledTime)
        return res.status(400).json({ error: 'scheduledTime is required for scheduled rides' });

      const parsedScheduledTime = new Date(scheduledTime);
      const minScheduledTime = new Date(Date.now() + 15 * 60 * 1000);
      if (parsedScheduledTime < minScheduledTime)
        return res.status(400).json({ error: 'scheduledTime must be at least 15 minutes in the future' });
    }

    const normalizedGenderPreference = normalizeGenderPreference(genderPreference);
    const normalizedPickupRadius = normalizePickupRadius(pickupRadius);

    // ── Vehicle validation (strict mandatory checks) ────────────────────────
    if (!vehicle || typeof vehicle !== 'object') {
      return res.status(400).json({ success: false, error: 'vehicle object is required' });
    }
    if (!vehicle.type || typeof vehicle.type !== 'string') {
      return res.status(400).json({ success: false, error: 'vehicle.type is required (CAR, BIKE, SEDAN, SUV, etc.)' });
    }
    if (!vehicle.name || typeof vehicle.name !== 'string' || vehicle.name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'vehicle.name is required (e.g. "Honda City")' });
    }
    if (!vehicle.registrationNumber || typeof vehicle.registrationNumber !== 'string' || vehicle.registrationNumber.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'vehicle.registrationNumber is required (e.g. "DL01AB1234")' });
    }
    // Validate Indian vehicle registration format
    const regPattern = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;
    if (!regPattern.test(vehicle.registrationNumber.trim().toUpperCase())) {
      return res.status(400).json({ success: false, error: 'vehicle.registrationNumber must follow Indian format (e.g. DL01AB1234)' });
    }
    if (!vehicle.seatingCapacity || !Number.isFinite(Number(vehicle.seatingCapacity)) || Number(vehicle.seatingCapacity) < 1) {
      return res.status(400).json({ success: false, error: 'vehicle.seatingCapacity must be a positive number' });
    }

    const normalizedVehicleType = deriveRideVehicleType(vehicleType, vehicle.type);
    if (normalizedVehicleType === 'BIKE' && String(vehicle.type || '').toUpperCase() !== 'BIKE') {
      return res.status(400).json({ error: 'vehicleType BIKE requires vehicle.type BIKE' });
    }

    // ── Seat validation ──────────────────────────────────────────────────────
    let seatInfo;
    try {
      seatInfo = calculateAvailableSeats(vehicle.type, vehicle.seatingCapacity);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let { availableSeats, maxPassengers } = seatInfo;
    if (normalizedVehicleType === 'BIKE') {
      availableSeats = 1;
      maxPassengers = 1;
    }

    const departureAt = buildDepartureDate(schedule.date, schedule.time);
    if (departureAt < new Date())
      return res.status(400).json({ error: 'Departure time must be in the future' });

    // ── Road distance + ETA + polyline ──────────────────────────────────────
    const route = await getRoadDistance(
      { lat: pickupLL.lat, lng: pickupLL.lng },
      { lat: dropoffLL.lat, lng: dropoffLL.lng }
    );

    const ridePolicy = await getRidePolicy();
    const fuelPrice = pickupGeo?.city ? getFuelPrice(pickupGeo.city, vehicle?.fuelType || 'Petrol') : ridePolicy.defaultFuelPrice;

    // ── Per-seat pricing (full seating capacity आधारित) ─────────────────────
    // Extract mileage from vehicle data if provided, otherwise use default
    const userMileage = vehicle?.mileageKmPerLitre || vehicle?.mileage;
    
    const smart = computePerSeatPricing({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      fuelPrice,
        vehicleType: normalizedVehicleType,
      seatingCapacity: vehicle.seatingCapacity,
      availableSeats: seatInfo.availableSeats,
      mileageKmPerLitre: userMileage,
    });

    const manual = pricePerSeat ?? farePerSeat;
    const finalPricePerSeat = manual != null ? Number(manual) : smart.pricePerSeat;
    if (!Number.isFinite(finalPricePerSeat) || finalPricePerSeat < 0)
      return res.status(400).json({ error: 'pricePerSeat/farePerSeat must be a non-negative number' });

    const pricingBreakdown =
      manual != null
        ? {
            ...smart.breakdown,
            source: 'MANUAL',
            manualPricePerSeat: finalPricePerSeat,
            recommendedPricePerSeat: smart.pricePerSeat,
          }
        : smart.breakdown;

    // Attach surge info for transparency (kept separate from base price)
    pricingBreakdown.surgeMultiplier = getSurgeMultiplier(departureAt);

    const ride = await Ride.create({
      driverId: req.user._id,
      pickup:   { ...pickup,  coordinates: { type: 'Point', coordinates: [pickupLL.lng, pickupLL.lat] } },
      dropoff:  { ...dropoff, coordinates: { type: 'Point', coordinates: [dropoffLL.lng, dropoffLL.lat] } },

      distanceKm: route.distanceKm,
      etaMinutes: route.durationMin,
      routePolyline: route.polyline,
      routeLine: route.routeCoords && route.routeCoords.length >= 2
        ? { type: 'LineString', coordinates: route.routeCoords }
        : null,

      vehicle:  {
        ...vehicle,
        seatingCapacity: vehicle.seatingCapacity,
        helmetRequired: normalizedVehicleType === 'BIKE',
      },
      vehicleType: normalizedVehicleType,
      totalSeats:     vehicle.seatingCapacity,
      availableSeats,
      maxPassengers,
      farePerSeat:    finalPricePerSeat,
      pricePerSeat:   finalPricePerSeat,
      pricingBreakdown,

      surgeMultiplier: getSurgeMultiplier(departureAt),
      schedule: { date: schedule.date, time: schedule.time, departureAt },
      genderPreference: normalizedGenderPreference,
      pickupRadius: normalizedPickupRadius,
      pickupText:  pickup.name.toLowerCase(),
      dropoffText: dropoff.name.toLowerCase(),
      isScheduled:    isScheduled    ?? false,
      scheduledTime:  scheduledTime  ? new Date(scheduledTime) : null,
      isCarpool:      isCarpool      ?? false,
      carpoolGroupId: carpoolGroupId ?? null,
    });

    res.status(201).json({ success: true, data: ride, message: 'Ride published' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides ──────────────────────────────────────────────────────────

exports.searchRides = async (req, res, next) => {
  try {
    const {
      pickup,         // text search
      dropoff,
      vehicleType,
      genderPreference,
      maxFare,
      minSeats = 1,
      date,           // YYYY-MM-DD
      sortBy = 'distance', // distance | price | seats
      page = 1,
      limit = 20,
      // geo search (optional, higher priority than text)
      pickupLng,
      pickupLat,
      radiusKm = 10,
      dropoffLng,
      dropoffLat,
      dropoffRadiusKm,
    } = req.query;

    const hasValue = (v) => v !== undefined && v !== null && v !== '';
    const parseCoord = (v, name) => {
      if (!hasValue(v)) throw Object.assign(new Error(`${name} is required`), { status: 400 });
      const n = Number(v);
      if (!Number.isFinite(n)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
      return n;
    };
    const assertLngLat = (lng, lat, prefix) => {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw Object.assign(new Error(`${prefix} coordinates out of range`), { status: 400 });
    };

    if (hasValue(pickupLng) !== hasValue(pickupLat))
      return res.status(400).json({ error: 'pickupLng and pickupLat must be provided together' });
    if (hasValue(dropoffLng) !== hasValue(dropoffLat))
      return res.status(400).json({ error: 'dropoffLng and dropoffLat must be provided together' });

    const minSeatsNum = parseInt(minSeats);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (!Number.isFinite(minSeatsNum) || minSeatsNum <= 0)
      return res.status(400).json({ error: 'minSeats must be a positive integer' });
    if (!Number.isFinite(pageNum) || pageNum <= 0)
      return res.status(400).json({ error: 'page must be a positive integer' });
    if (!Number.isFinite(limitNum) || limitNum <= 0)
      return res.status(400).json({ error: 'limit must be a positive integer' });

    const maxFareNum = hasValue(maxFare) ? Number(maxFare) : undefined;
    if (maxFareNum != null && (!Number.isFinite(maxFareNum) || maxFareNum < 0))
      return res.status(400).json({ error: 'maxFare must be a non-negative number' });

    const filter = {
      status: 'BOOKING_OPEN',
      availableSeats: { $gte: minSeatsNum },
    };

    // Date filter
    if (date) {
      const start = new Date(`${date}T00:00:00+05:30`);
      const end = new Date(`${date}T23:59:59+05:30`);
      filter['schedule.departureAt'] = { $gte: start, $lte: end };
    } else {
      // Default: only future rides
      filter['schedule.departureAt'] = { $gte: new Date() };
    }

    applyVehicleTypeFilter(filter, vehicleType);
    if (genderPreference) filter.genderPreference = normalizeGenderPreference(genderPreference);
    if (maxFareNum != null) filter.farePerSeat = { $lte: maxFareNum };

    // Text search on location names
    if (pickup) filter.pickupText = { $regex: pickup.toLowerCase(), $options: 'i' };
    if (dropoff) filter.dropoffText = { $regex: dropoff.toLowerCase(), $options: 'i' };

    // Dropoff proximity filter
    if (hasValue(dropoffLng) && hasValue(dropoffLat)) {
      const dLng = parseCoord(dropoffLng, 'dropoffLng');
      const dLat = parseCoord(dropoffLat, 'dropoffLat');
      assertLngLat(dLng, dLat, 'dropoff');
      const dRadius = Number(dropoffRadiusKm ?? 10);
      if (!Number.isFinite(dRadius) || dRadius <= 0)
        return res.status(400).json({ error: 'dropoffRadiusKm must be a positive number' });
      // Use geoWithin instead of near so this can safely combine with pickup near search.
      filter['dropoff.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[dLng, dLat], dRadius / 6378.1],
        },
      };
    }

    // Sort mapping
    const sortMap = {
      distance: { distanceKm: 1 },
      price: { farePerSeat: 1 },
      seats: { availableSeats: -1 },
    };
    const sort = sortMap[sortBy] ?? sortMap.distance;

    const skip = (pageNum - 1) * limitNum;

    let query;
    let countFilter = filter;

    // Geo-proximity search overrides text pickup search
    if (hasValue(pickupLng) && hasValue(pickupLat)) {
      const pLng = parseCoord(pickupLng, 'pickupLng');
      const pLat = parseCoord(pickupLat, 'pickupLat');
      assertLngLat(pLng, pLat, 'pickup');
      const r = Number(radiusKm);
      if (!Number.isFinite(r) || r <= 0)
        return res.status(400).json({ error: 'radiusKm must be a positive number' });
      query = Ride.find({
        ...filter,
        'pickup.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [pLng, pLat] },
            $maxDistance: r * 1000, // metres
          },
        },
      });
      countFilter = {
        ...filter,
        'pickup.coordinates': {
          $geoWithin: {
            $centerSphere: [[pLng, pLat], r / 6378.1],
          },
        },
      };
    } else {
      query = Ride.find(filter).sort(sort);
      countFilter = filter;
    }

    const now = new Date();
    const [rides, total] = await Promise.all([
      query
        .skip(skip)
        .limit(limitNum)
        .populate('driverId', 'name avatar rating totalRatings kycStatus')
        .lean(),
      Ride.countDocuments(countFilter),
    ]);

    // Add effectiveAvailableSeats (excludes active seat locks) for accurate UI display
    const enrichedRides = rides.map((r) => {
      const lockActive = r.seatLockExpiry && new Date(r.seatLockExpiry) > now;
      const effectiveSeats = lockActive
        ? Math.max(0, r.availableSeats - r.lockedSeats)
        : r.availableSeats;
      return {
        ...obfuscateRidePickup(r, r._id),
        effectiveAvailableSeats: effectiveSeats,
      };
    });

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      rides: enrichedRides,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/match ────────────────────────────────────────────────────
// Smart ride matching — pickup + dropoff proximity, time window, scored ranking
// Query: pickupLng, pickupLat, dropoffLng, dropoffLat, date, time?,
//        seats?, vehicleType?, maxFare?, sortBy?, page?, limit?

exports.matchRides = async (req, res, next) => {
  try {
    const {
      pickupLng, pickupLat,
      dropoffLng, dropoffLat,
      date, time,
      seats      = 1,
      vehicleType,
      maxFare,
      sortBy     = 'match',
      page       = 1,
      limit      = 20,
    } = req.query;

    const hasValue = (v) => v !== undefined && v !== null && v !== '';
    const parseCoord = (v, name) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
      return n;
    };
    const assertLngLat = (lng, lat, prefix) => {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw Object.assign(new Error(`${prefix} coordinates out of range`), { status: 400 });
    };

    const seatsNum = parseInt(seats);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (!Number.isFinite(seatsNum) || seatsNum <= 0)
      return res.status(400).json({ error: 'seats must be a positive integer' });
    if (!Number.isFinite(pageNum) || pageNum <= 0)
      return res.status(400).json({ error: 'page must be a positive integer' });
    if (!Number.isFinite(limitNum) || limitNum <= 0)
      return res.status(400).json({ error: 'limit must be a positive integer' });

    if (!hasValue(pickupLng) || !hasValue(pickupLat) || !hasValue(dropoffLng) || !hasValue(dropoffLat) || !hasValue(date))
      return res.status(400).json({
        error: 'pickupLng, pickupLat, dropoffLng, dropoffLat, and date are required',
      });

    const pLng = parseCoord(pickupLng, 'pickupLng');
    const pLat = parseCoord(pickupLat, 'pickupLat');
    const dLng = parseCoord(dropoffLng, 'dropoffLng');
    const dLat = parseCoord(dropoffLat, 'dropoffLat');
    assertLngLat(pLng, pLat, 'pickup');
    assertLngLat(dLng, dLat, 'dropoff');

    const maxFareNum = hasValue(maxFare) ? Number(maxFare) : undefined;
    if (maxFareNum != null && (!Number.isFinite(maxFareNum) || maxFareNum < 0))
      return res.status(400).json({ error: 'maxFare must be a non-negative number' });

    const result = await findMatchingRides({
      pickupCoords:  [pLng, pLat],
      dropoffCoords: [dLng, dLat],
      date,
      time,
      seats:       seatsNum,
      vehicleType,
      maxFare:     maxFareNum,
      sortBy,
      page:        pageNum,
      limit:       limitNum,
    });

    res.json({
      ...result,
      rides: result.rides.map((r) => obfuscateRidePickup(r, r._id || r.id)),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/:id ──────────────────────────────────────────────────────
exports.getRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driverId', 'name phone rating totalRatings kycStatus')
      .lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(obfuscateRidePickup(ride, ride._id));
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/rides/:id ──────────────────────────────────────────────────────

exports.updateRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    // Only the owning driver can update
    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your ride' });

    if (['CANCELLED', 'COMPLETED', 'STARTED'].includes(ride.status))
      return res.status(400).json({ error: `Cannot update a ${ride.status} ride` });

    // ── Vehicle + seat validation ──────────────────────────────────────────
    const vehiclePatch = req.body.vehicle;
    if (vehiclePatch) {
      const nextVehicle = { ...ride.vehicle.toObject(), ...vehiclePatch };

      let seatInfo;
      try {
        seatInfo = calculateAvailableSeats(nextVehicle.type, nextVehicle.seatingCapacity);
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
      }

      ride.vehicle = nextVehicle;
      ride.totalSeats = nextVehicle.seatingCapacity;
      ride.maxPassengers = seatInfo.maxPassengers;

      const maxOfferable = seatInfo.availableSeats;
      const requested = req.body.availableSeats != null ? Number(req.body.availableSeats) : ride.availableSeats;
      if (!Number.isFinite(requested) || requested < 0)
        return res.status(400).json({ error: 'availableSeats must be a non-negative number' });
      if (requested > maxOfferable)
        return res.status(400).json({ error: `availableSeats cannot exceed ${maxOfferable} for this vehicle` });
      ride.availableSeats = requested;
    } else if (req.body.availableSeats != null) {
      const requested = Number(req.body.availableSeats);
      if (!Number.isFinite(requested) || requested < 0)
        return res.status(400).json({ error: 'availableSeats must be a non-negative number' });
      const cap = ride.totalSeats ?? ride.vehicle?.seatingCapacity;
      const maxOfferable = Math.max(0, (cap ?? 0) - 1);
      if (cap && requested > maxOfferable)
        return res.status(400).json({ error: `availableSeats cannot exceed ${maxOfferable}` });
      ride.availableSeats = requested;
    }

    if (req.body.vehicleType != null || vehiclePatch) {
      const nextVehicleType = deriveRideVehicleType(
        req.body.vehicleType ?? ride.vehicleType,
        ride.vehicle?.type
      );

      if (nextVehicleType === 'BIKE' && String(ride.vehicle?.type || '').toUpperCase() !== 'BIKE') {
        return res.status(400).json({ error: 'vehicleType BIKE requires vehicle.type BIKE' });
      }

      if (nextVehicleType === 'BIKE') {
        if (ride.totalSeats !== 2)
          return res.status(400).json({ error: 'Bike rides must have totalSeats 2' });
        if (ride.availableSeats > 1)
          return res.status(400).json({ error: 'Bike rides allow maximum 1 available seat' });
        ride.maxPassengers = 1;
        ride.vehicle.helmetRequired = true;
      } else if (ride.vehicle.helmetRequired == null) {
        ride.vehicle.helmetRequired = false;
      }

      ride.vehicleType = nextVehicleType;
    }

    if (req.body.genderPreference != null) {
      ride.genderPreference = normalizeGenderPreference(req.body.genderPreference);
    }

    if (req.body.pickupRadius != null) {
      ride.pickupRadius = normalizePickupRadius(req.body.pickupRadius);
    }

    // ── Schedule update ────────────────────────────────────────────────────
    if (req.body.schedule) {
      ride.schedule = {
        ...ride.schedule.toObject(),
        ...req.body.schedule,
      };
      ride.schedule.departureAt = buildDepartureDate(ride.schedule.date, ride.schedule.time);
    }

    // ── Status update ──────────────────────────────────────────────────────
    if (req.body.status != null) ride.status = req.body.status;

    // ── Pricing update (keep legacy farePerSeat + new pricePerSeat synced) ─
    const manual = req.body.pricePerSeat ?? req.body.farePerSeat;
    if (manual != null) {
      const v = Number(manual);
      if (!Number.isFinite(v) || v < 0)
        return res.status(400).json({ error: 'pricePerSeat/farePerSeat must be a non-negative number' });
      ride.farePerSeat = v;
      ride.pricePerSeat = v;
      ride.pricingBreakdown = {
        ...(ride.pricingBreakdown || {}),
        source: 'MANUAL',
        manualPricePerSeat: v,
        updatedAt: new Date(),
      };
    } else if (vehiclePatch || req.body.schedule) {
      // Recompute smart pricing if vehicle/schedule changed and price wasn't manually overridden.
      // Fuel price is not persisted per ride today; default is acceptable for recompute.
      try {
        const ridePolicy = await getRidePolicy();
        const fuelPrice = ridePolicy.defaultFuelPrice;
        const smart = computePerSeatPricing({
          distanceKm: ride.distanceKm,
          durationMin: ride.etaMinutes ?? null,
          fuelPrice,
          vehicleType: ride.vehicleType || ride.vehicle.type,
          seatingCapacity: ride.totalSeats,
          availableSeats: ride.availableSeats,
        });
        ride.farePerSeat = smart.pricePerSeat;
        ride.pricePerSeat = smart.pricePerSeat;
        ride.pricingBreakdown = {
          ...smart.breakdown,
          // Preserve existing surge field behavior
          surgeMultiplier: getSurgeMultiplier(ride.schedule.departureAt),
        };
      } catch {
        // Pricing recompute must not block a ride update
      }
    }

    await ride.save();
    res.json({ message: 'Ride updated', ride });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/fare-estimate ────────────────────────────────────────────
// Formula: fuelCost + maintenanceCost + platformFee — NO surge, NO extra charges.

exports.fareEstimate = async (req, res) => {
  const { pickupLng, pickupLat, dropoffLng, dropoffLat, vehicleType = 'SEDAN', date, time, city, fuelType, mileage } = req.query;

  const hasValue = (v) => v !== undefined && v !== null && v !== '';
  const parseCoord = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
    return n;
  };
  const assertLngLat = (lng, lat, prefix) => {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
      throw Object.assign(new Error(`${prefix} coordinates out of range`), { status: 400 });
  };

  if (!hasValue(pickupLng) || !hasValue(pickupLat) || !hasValue(dropoffLng) || !hasValue(dropoffLat))
    return res.status(400).json({ error: 'Coordinates required' });

  const pLng = parseCoord(pickupLng, 'pickupLng');
  const pLat = parseCoord(pickupLat, 'pickupLat');
  const dLng = parseCoord(dropoffLng, 'dropoffLng');
  const dLat = parseCoord(dropoffLat, 'dropoffLat');
  assertLngLat(pLng, pLat, 'pickup');
  assertLngLat(dLng, dLat, 'dropoff');

  const vt = String(vehicleType || '').toUpperCase();
  if (!SEAT_RULES[vt])
    return res.status(400).json({ error: 'Invalid vehicleType' });

  const distanceKm = parseFloat(
    haversineDistance([pLng, pLat], [dLng, dLat]).toFixed(2)
  );

  const ridePolicy = await getRidePolicy();
  const fuelPrice = city ? getFuelPrice(city, fuelType || 'Petrol') : ridePolicy.defaultFuelPrice;

  // Default seating capacity for fare estimation (representative values)
  const ESTIMATE_SEATS = {
    CAR: 5, BIKE: 2, AUTO: 3, HATCHBACK: 5, SEDAN: 5, SUV: 7, VAN: 9,
  };

  // Build estimates for all vehicle types — plain object with number values
  const allEstimates = {};
  Object.keys(SEAT_RULES).forEach((type) => {
    try {
      const seatingCapacity = ESTIMATE_SEATS[type] ?? SEAT_RULES[type].allowedTotal[0];
      const availableSeats  = Math.max(1, seatingCapacity - 1);
      const smart = computePerSeatPricing({
        distanceKm,
        durationMin: null,
        fuelPrice,
        vehicleType: type,
        seatingCapacity,
        availableSeats,
        mileageKmPerLitre: mileage ? Number(mileage) : undefined,
      });
      allEstimates[type] = smart.pricePerSeat;   // plain number — no nesting
    } catch {
      allEstimates[type] = 0;
    }
  });

  res.json({
    distanceKm,
    requestedVehicle: vt,
    farePerSeat: allEstimates[vt] ?? null,
    fuelPrice,
    allEstimates,   // { CAR: 120, BIKE: 75, ... }
  });
};

// ─── POST /api/rides/fare-breakdown ──────────────────────────────────────────
// Returns a full cost-sharing breakdown based on fuel price + mileage.
// Body: { distance, fuelPrice, mileage, passengersCount, vehicleType? }
// vehicleType: "car" (default, ₹3.5/km) | "bike" (₹1.5/km)

exports.fareBreakdown = (req, res) => {
  const { distance, fuelPrice, mileage, passengersCount, vehicleType = 'car' } = req.body;

  const missing = ['distance', 'fuelPrice', 'mileage', 'passengersCount']
    .filter((k) => req.body[k] == null);
  if (missing.length)
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

  try {
    const result = calculateFareByVehicle(
      parseFloat(distance),
      parseFloat(fuelPrice),
      parseFloat(mileage),
      parseInt(passengersCount),
      vehicleType
    );

    res.json({
      input: {
        distance:        parseFloat(distance),
        fuelPrice:       parseFloat(fuelPrice),
        mileage:         parseFloat(mileage),
        passengersCount: parseInt(passengersCount),
        vehicleType:     String(vehicleType).toLowerCase(),
        totalSeats:      parseInt(passengersCount) + 1,
      },
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── POST /api/rides/:id/start ───────────────────────────────────────────────
// Driver starts the ride — transitions OTP_VERIFIED bookings → ONGOING

exports.startRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });

    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Not your ride' });

    if (!['BOOKING_OPEN', 'FULL'].includes(ride.status))
      return res.status(400).json({ success: false, error: `Cannot start a ride in ${ride.status} state` });

    // Must have at least one OTP_VERIFIED (or ACCEPTED for backward compat) booking
    const hasPassenger = await BookingRequest.exists({
      rideId: ride._id,
      status: { $in: ['OTP_VERIFIED', 'ACCEPTED'] },
    });
    if (!hasPassenger)
      return res.status(400).json({ success: false, error: 'No verified passengers — cannot start ride' });

    ride.status    = 'STARTED';
    ride.startedAt = new Date();
    await ride.save();

    // Transition OTP_VERIFIED → ONGOING (also handle legacy ACCEPTED bookings)
    const waitingStartedAt = ride.startedAt;
    const ridePolicy = await getRidePolicy();
    await BookingRequest.updateMany(
      { rideId: ride._id, status: { $in: ['OTP_VERIFIED', 'ACCEPTED'] } },
      {
        $set: {
          status: 'ONGOING',
          rideStartedAt: waitingStartedAt,
          waitingStartedAt,
          freeWaitMinutes: ridePolicy.freeWaitMinutes,
          waitedMinutes: 0,
          waitPenaltyApplied: false,
          waitPenaltyAmount: 0,
          waitStatus: 'FREE_WINDOW',
        },
      }
    );

    // Emit socket events to all involved passengers and driver
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();

      const activeBookings = await BookingRequest.find({
        rideId: ride._id,
        status: 'ONGOING',
      }).select('passengerId driverId').lean();

      const payload = {
        rideId: ride._id,
        status: 'ONGOING',
        message: 'Ride has started',
        startedAt: ride.startedAt,
        updatedAt: new Date(),
      };

      activeBookings.forEach(({ passengerId, driverId }) => {
        io.to(`user:${passengerId}`).emit('booking:update', { ...payload });
        if (driverId) io.to(`user:${driverId}`).emit('booking:update', { ...payload });
      });

      // Also emit ride:started to the ride room
      io.to(`ride:${ride._id}`).emit('ride:started', { rideId: ride._id, startedAt: ride.startedAt });
    } catch (socketErr) {
      console.error('[Socket] Failed to emit ride:started:', socketErr.message);
    }

    // Notify all active passengers
    const activeBookings = await BookingRequest.find({
      rideId: ride._id,
      status: 'ONGOING',
    }).select('passengerId');

    activeBookings.forEach(({ passengerId }) => {
      notify({
        userId: passengerId,
        type:   'RIDE_STARTED',
        title:  'Your ride has started',
        body:   'The driver has started the ride.',
        data:   { rideId: ride._id },
      });
    });

    res.json({ success: true, message: 'Ride started', data: ride });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/rides/:id/end ─────────────────────────────────────────────────
// Driver ends the ride — transitions ONGOING → COMPLETED

exports.endRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });

    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Not your ride' });

    if (ride.status !== 'STARTED')
      return res.status(400).json({ success: false, error: `Cannot end a ride in ${ride.status} state` });

    ride.status      = 'COMPLETED';
    ride.completedAt = new Date();
    ride.otpCode     = null; // Clear OTP after ride completes
    await ride.save();

    // Mark all ONGOING bookings as COMPLETED
    const completedBookings = await BookingRequest.find({
      rideId: ride._id,
      status: 'ONGOING',
    }).select('passengerId driverId');

    await BookingRequest.updateMany(
      { rideId: ride._id, status: 'ONGOING' },
      { $set: { status: 'COMPLETED', rideEndedAt: new Date() } }
    );

    // Escrow settlement
    try {
      const { settleEscrowOnRideCompletion } = require('./payment.controller');
      await settleEscrowOnRideCompletion(ride._id);
    } catch (settlementErr) {
      console.error('[PaymentSettlement] Failed for ride', ride._id.toString(), settlementErr.message);
    }

    // Lock all chats for this ride
    const Chat = require('../models/Chat');
    await Chat.updateMany({ rideId: ride._id }, { $set: { isActive: false } });

    // Emit socket events to all involved parties
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();

      const payload = {
        rideId: ride._id,
        status: 'COMPLETED',
        message: 'Ride completed',
        completedAt: ride.completedAt,
        updatedAt: new Date(),
      };

      completedBookings.forEach(({ passengerId, driverId }) => {
        io.to(`user:${passengerId}`).emit('booking:update', { ...payload });
        if (driverId) io.to(`user:${driverId}`).emit('booking:update', { ...payload });
      });

      io.to(`ride:${ride._id}`).emit('ride:completed', { rideId: ride._id, completedAt: ride.completedAt });
    } catch (socketErr) {
      console.error('[Socket] Failed to emit ride:completed:', socketErr.message);
    }

    // Notify all passengers
    completedBookings.forEach(({ passengerId }) => {
      notify({
        userId: passengerId,
        type:   'RIDE_COMPLETED',
        title:  'Ride Completed',
        body:   'Your ride has been completed. Please rate your experience.',
        data:   { rideId: ride._id },
      });
    });

    // Recalculate trust scores
    try {
      const passengerIds = completedBookings.map((b) => b.passengerId);
      await Promise.all([
        recalculateTrustScore(ride.driverId),
        ...passengerIds.map((id) => recalculateTrustScore(id)),
      ]);
    } catch (trustErr) {
      console.error('Trust score recalculation failed:', trustErr.message);
    }

    res.json({ success: true, message: 'Ride completed', data: ride });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/:id/otp ──────────────────────────────────────────────────
// Driver-only endpoint — returns the shared OTP for the ride.
// NEVER accessible by passengers.

exports.getRideOTP = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).select('driverId otpCode').lean();
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });

    // Only the ride's driver can access the OTP
    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Only the driver can access this' });

    if (!ride.otpCode)
      return res.status(404).json({ success: false, error: 'OTP not yet generated for this ride' });

    res.json({ success: true, data: { otpCode: ride.otpCode } });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/rides/:id/board-passenger ─────────────────────────────────────
// Driver marks a passenger as boarded

exports.boardPassenger = async (req, res, next) => {
  try {
    const { passengerId } = req.body;
    if (!passengerId)
      return res.status(400).json({ error: 'passengerId is required' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your ride' });

    if (ride.status !== 'STARTED')
      return res.status(400).json({ error: 'Ride has not started yet' });

    // Verify passenger has an active booking on this ride
    const booking = await BookingRequest.findOne({
      rideId:      ride._id,
      passengerId,
      status:      { $in: ['ACCEPTED', 'ONGOING'] },
    });
    if (!booking)
      return res.status(404).json({ error: 'No accepted booking found for this passenger' });

    // Idempotent — skip if already boarded
    const alreadyBoarded = ride.boardedPassengers.some(
      (id) => id.toString() === passengerId
    );
    if (alreadyBoarded)
      return res.status(409).json({ error: 'Passenger already marked as boarded' });

    ride.boardedPassengers.push(passengerId);
    await ride.save();

    // TODO: emit socket event — io.to(passengerId).emit('passenger_boarded', { rideId: ride._id })

    res.json({ message: 'Passenger boarded', boardedCount: ride.boardedPassengers.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/scheduled ────────────────────────────────────────────────
// Returns scheduled rides for the authenticated user.
// DRIVER: their own scheduled rides with status BOOKING_OPEN, sorted by scheduledTime asc
// PASSENGER: scheduled rides they have an ACCEPTED booking on

// GET /api/rides/scheduled — works for both ride owners and passengers
exports.getScheduledRides = async (req, res, next) => {
  try {
    // Rides posted by this user (acting as driver)
    const postedRides = await Ride.find({
      driverId:    req.user._id,
      isScheduled: true,
      status:      'BOOKING_OPEN',
    }).sort({ scheduledTime: 1 }).lean();

    // Rides booked by this user (acting as passenger)
    const acceptedBookings = await BookingRequest.find({
      passengerId: req.user._id,
      status:      'ACCEPTED',
    }).select('rideId').lean();

    const rideIds = acceptedBookings.map((b) => b.rideId);
    const bookedRides = await Ride.find({
      _id:         { $in: rideIds },
      isScheduled: true,
      status:      'BOOKING_OPEN',
    }).sort({ scheduledTime: 1 }).lean();

    res.json({
      postedRides,
      bookedRides,
      total: postedRides.length + bookedRides.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rides/carpool ──────────────────────────────────────────────────
// Returns carpool rides near a given location.
// Query: pickupLng, pickupLat, radiusKm (default 10)

exports.getCarpoolRides = async (req, res, next) => {
  try {
    const { pickupLng, pickupLat, radiusKm = 10 } = req.query;

    const hasValue = (v) => v !== undefined && v !== null && v !== '';
    const parseCoord = (v, name) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
      return n;
    };
    const assertLngLat = (lng, lat, prefix) => {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw Object.assign(new Error(`${prefix} coordinates out of range`), { status: 400 });
    };

    if (hasValue(pickupLng) !== hasValue(pickupLat))
      return res.status(400).json({ error: 'pickupLng and pickupLat must be provided together' });

    let pLng;
    let pLat;
    if (hasValue(pickupLng) && hasValue(pickupLat)) {
      pLng = parseCoord(pickupLng, 'pickupLng');
      pLat = parseCoord(pickupLat, 'pickupLat');
      assertLngLat(pLng, pLat, 'pickup');
    }

    const radiusNum = Number(radiusKm);
    if (!Number.isFinite(radiusNum) || radiusNum <= 0)
      return res.status(400).json({ error: 'radiusKm must be a positive number' });

    const filter = {
      isCarpool: true,
      status: 'BOOKING_OPEN',
      availableSeats: { $gt: 0 },
    };

    let query;
    if (pLng != null && pLat != null) {
      query = Ride.find({
        ...filter,
        'pickup.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [pLng, pLat] },
            $maxDistance: radiusNum * 1000, // metres
          },
        },
      });
    } else {
      query = Ride.find(filter);
    }

    const rides = await query
      .populate('driverId', 'name rating totalRatings')
      .lean();

    res.json({
      rides: rides.map((r) => obfuscateRidePickup(r, r._id)),
      total: rides.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/rides/:id/photo ───────────────────────────────────────────────
// Passenger or driver uploads a photo during an active ride.
// Requires multipart/form-data with field name "photo".

exports.uploadRidePhoto = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    if (ride.status !== 'STARTED')
      return res.status(400).json({ error: 'Photos can only be uploaded during an active ride' });

    // Caller must be the driver or a passenger with an accepted booking
    const userId = req.user._id.toString();
    const isDriver = ride.driverId.toString() === userId;

    if (!isDriver) {
      const booking = await BookingRequest.findOne({
        rideId: ride._id,
        passengerId: req.user._id,
        status: { $in: ['ACCEPTED', 'ONGOING'] },
      }).lean();
      if (!booking)
        return res.status(403).json({ error: 'You are not part of this ride' });
    }

    if (!req.file)
      return res.status(400).json({ error: 'No photo uploaded. Use field name "photo".' });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: {
        url:       req.file.path,        // Cloudinary secure URL
        publicId:  req.file.filename,    // Cloudinary public_id
        rideId:    ride._id,
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/rides/:id/cancel ───────────────────────────────────────────────
// Driver cancels their own posted ride (only if not yet started)
exports.cancelRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    if (ride.driverId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'You can only cancel your own rides' });

    if (['STARTED', 'COMPLETED', 'CANCELLED'].includes(ride.status))
      return res.status(400).json({ error: `Cannot cancel a ride that is ${ride.status.toLowerCase()}` });

    // Cancel all pending/accepted booking requests for this ride
    const { processAutoRefund } = require('./payment.controller');
    const { notify } = require('../utils/notify');

    const activeBookings = await BookingRequest.find({
      rideId: ride._id,
      status: { $in: ['PENDING', 'ACCEPTED'] },
    });

    // Try to get socket io instance for real-time updates
    let io = null;
    try { io = require('../config/socket').getIO(); } catch (_) { /* socket not available */ }

    // Refund and notify all affected passengers
    await Promise.all(activeBookings.map(async (booking) => {
      booking.status = 'CANCELLED';
      booking.cancelledBy = 'DRIVER';
      booking.cancellationReason = req.body.reason || 'Driver cancelled the ride';
      await booking.save();

      // Silently attempt refund — won't crash if replica set not available
      try { await processAutoRefund(booking._id); } catch (e) { /* standalone MongoDB — skip */ }

      notify({
        userId: booking.passengerId,
        type: 'CANCELLED',
        title: 'Ride Cancelled',
        body: 'The driver has cancelled this ride. Any payment will be refunded.',
        data: { rideId: ride._id, bookingId: booking._id },
      });

      // Emit real-time socket event to passenger
      if (io) {
        io.to(`user:${booking.passengerId}`).emit('booking:updated', {
          _id: booking._id,
          id: booking._id,
          status: 'CANCELLED',
          cancelledBy: 'DRIVER',
          rideId: ride._id,
        });
      }
    }));

    ride.status = 'CANCELLED';
    await ride.save();

    // Lock all chats for this ride — no more messaging after cancellation
    const Chat = require('../models/Chat');
    await Chat.updateMany({ rideId: ride._id }, { $set: { isActive: false } });

    // Emit real-time socket event to remove ride from FindRide page
    if (io) {
      io.emit('ride:updated', { _id: ride._id, id: ride._id, status: 'CANCELLED' });
    }

    res.json({ message: 'Ride cancelled successfully', ride });
  } catch (err) {
    next(err);
  }
};
