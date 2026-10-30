const mongoose = require('mongoose');
const Ride          = require('../models/Ride');
const User          = require('../models/User');
const { haversine } = require('./haversine');

// ─── Tuning constants ─────────────────────────────────────────────────────────

const PICKUP_RADIUS_KM  = 5;   // how close ride pickup must be to passenger pickup
const DROPOFF_RADIUS_KM = 8;   // how close ride dropoff must be to passenger destination
const TIME_WINDOW_MINS  = 60;  // ± minutes around requested departure time

// Route overlap corridor (passenger pickup/dropoff must lie near ride route)
const ROUTE_CORRIDOR_KM = 3;

// Composite score weights (must sum to 1.0)
const W_PICKUP_DIST  = 0.35;
const W_DROPOFF_DIST = 0.25;
const W_RATING       = 0.25;
const W_PRICE        = 0.15;

// ─── Scoring ──────────────────────────────────────────────────────────────────

const scoreMatch = (ride, pickupDistKm, dropoffDistKm, driverRating) => {
  const pickupScore  = Math.max(0, 1 - pickupDistKm  / PICKUP_RADIUS_KM);
  const dropoffScore = Math.max(0, 1 - dropoffDistKm / DROPOFF_RADIUS_KM);
  const ratingScore  = (driverRating - 1) / 4;                          // 1–5 → 0–1
  // Price score: lower fare = higher score (normalised against ₹200 cap)
  const ridePrice    = ride.pricePerSeat ?? ride.farePerSeat;
  const priceScore   = Math.max(0, 1 - (ridePrice || 0) / 200);

  return (
    W_PICKUP_DIST  * pickupScore  +
    W_DROPOFF_DIST * dropoffScore +
    W_RATING       * ratingScore  +
    W_PRICE        * priceScore
  );
};

// ─── Route overlap helpers ──────────────────────────────────────────────────

const getRideRouteCoords = (ride) => {
  const route = ride?.routeLine?.coordinates;
  if (Array.isArray(route) && route.length >= 2) return route;

  const pickup = ride?.pickup?.coordinates?.coordinates;
  const dropoff = ride?.dropoff?.coordinates?.coordinates;
  if (Array.isArray(pickup) && pickup.length === 2 && Array.isArray(dropoff) && dropoff.length === 2) {
    return [pickup, dropoff];
  }
  return [];
};

const toXYMeters = ([lng, lat], refLatRad) => {
  const R = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return {
    x: lngRad * Math.cos(refLatRad) * R,
    y: latRad * R,
  };
};

const pointToSegmentDistanceMeters = (p, a, b) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) return Math.hypot(apx, apy);

  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * abx;
  const projY = a.y + t * aby;
  return Math.hypot(p.x - projX, p.y - projY);
};

const minDistancePointToLineKm = (point, lineCoords) => {
  if (!Array.isArray(lineCoords) || lineCoords.length < 2) return Number.POSITIVE_INFINITY;
  const refLatRad = (point[1] * Math.PI) / 180;
  const p = toXYMeters(point, refLatRad);
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = toXYMeters(lineCoords[i], refLatRad);
    const b = toXYMeters(lineCoords[i + 1], refLatRad);
    const d = pointToSegmentDistanceMeters(p, a, b);
    if (d < min) min = d;
  }

  return min / 1000;
};

const closestVertexIndex = (point, lineCoords) => {
  if (!Array.isArray(lineCoords) || lineCoords.length === 0) return -1;
  const refLatRad = (point[1] * Math.PI) / 180;
  const p = toXYMeters(point, refLatRad);
  let bestIdx = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lineCoords.length; i++) {
    const v = toXYMeters(lineCoords[i], refLatRad);
    const d2 = (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    if (d2 < best) {
      best = d2;
      bestIdx = i;
    }
  }
  return bestIdx;
};

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Find and rank rides matching a passenger's request.
 *
 * @param {Object} params
 * @param {[number,number]} params.pickupCoords   - [lng, lat] of passenger pickup
 * @param {[number,number]} params.dropoffCoords  - [lng, lat] of passenger destination
 * @param {string}          params.date           - 'YYYY-MM-DD' (IST)
 * @param {string}          [params.time]         - 'HH:MM' (IST) — optional, defaults to full day
 * @param {number}          [params.seats=1]      - seats needed
 * @param {string}          [params.vehicleType]  - filter by vehicle type
 * @param {number}          [params.maxFare]      - max farePerSeat
 * @param {string}          [params.sortBy]       - 'match'|'distance'|'price'|'rating'
 * @param {number}          [params.page=1]
 * @param {number}          [params.limit=20]
 *
 * @returns {{ total, page, pages, rides: MatchedRide[] }}
 */
const findMatchingRides = async ({
  pickupCoords,
  dropoffCoords,
  date,
  time,
  seats       = 1,
  vehicleType,
  maxFare,
  sortBy      = 'match',
  page        = 1,
  limit       = 20,
}) => {
  // ── 1. Build time window ───────────────────────────────────────────────────
  let timeStart, timeEnd;
  if (time) {
    const base  = new Date(`${date}T${time}:00+05:30`);
    timeStart   = new Date(base.getTime() - TIME_WINDOW_MINS * 60_000);
    timeEnd     = new Date(base.getTime() + TIME_WINDOW_MINS * 60_000);
  } else {
    timeStart   = new Date(`${date}T00:00:00+05:30`);
    timeEnd     = new Date(`${date}T23:59:59+05:30`);
  }

  // ── 2. Base filter (time/seats/status) ────────────────────────────────────
  const baseFilter = {
    status:         'BOOKING_OPEN',
    availableSeats: { $gte: seats },
    'schedule.departureAt': { $gte: timeStart, $lte: timeEnd },
  };

  if (vehicleType) {
    const vt = String(vehicleType).toUpperCase();
    if (vt === 'CAR' || vt === 'BIKE') baseFilter.vehicleType = vt;
    else baseFilter['vehicle.type'] = vt;
  }
  if (maxFare)     baseFilter.farePerSeat     = { $lte: maxFare };

  const pickupNearQuery = {
    ...baseFilter,
    'pickup.coordinates': {
      $near: {
        $geometry:    { type: 'Point', coordinates: pickupCoords },
        $maxDistance: PICKUP_RADIUS_KM * 1000,
      },
    },
  };

  const routeNearQuery = {
    ...baseFilter,
    routeLine: {
      $near: {
        $geometry:    { type: 'Point', coordinates: pickupCoords },
        $maxDistance: ROUTE_CORRIDOR_KM * 1000,
      },
    },
  };

  // Fetch a generous pool (both endpoint-pickup matches and route-overlap matches)
  const poolByPickup = await Ride.find(pickupNearQuery)
    .limit(100)
    .populate('driverId', 'name rating totalRatings cancellationBlockedUntil kycStatus deletedAt')
    .lean();

  let poolByRoute = [];
  try {
    poolByRoute = await Ride.find(routeNearQuery)
      .limit(100)
      .populate('driverId', 'name rating totalRatings cancellationBlockedUntil kycStatus deletedAt')
      .lean();
  } catch (e) {
    // If the 2dsphere index isn't present/ready, keep matching functional.
    poolByRoute = [];
  }

  const poolMap = new Map();
  [...poolByPickup, ...poolByRoute].forEach((r) => poolMap.set(String(r._id), r));
  const pool = Array.from(poolMap.values());

  // ── 3. Filter by dropoff proximity / route overlap + driver eligibility ──
  const now = new Date();

  const candidates = pool
    .filter((ride) => {
      const driver = ride.driverId;
      // Skip deleted / unapproved drivers
      if (!driver || driver.deletedAt || driver.kycStatus !== 'APPROVED') return false;
      // Skip blocked drivers
      if (driver.cancellationBlockedUntil && driver.cancellationBlockedUntil > now) return false;

      // Endpoint distances
      const [rPLng, rPLat] = ride.pickup.coordinates.coordinates;
      const [rDLng, rDLat] = ride.dropoff.coordinates.coordinates;
      const pickupEndpointDist = haversine(pickupCoords, [rPLng, rPLat]);
      const dropoffEndpointDist = haversine(dropoffCoords, [rDLng, rDLat]);

      // Route overlap distances (fallback to straight line when routeLine missing)
      const lineCoords = getRideRouteCoords(ride);
      const pickupRouteDist = minDistancePointToLineKm(pickupCoords, lineCoords);
      const dropoffRouteDist = minDistancePointToLineKm(dropoffCoords, lineCoords);

      const pickupDist = Math.min(pickupEndpointDist, pickupRouteDist);
      const dropoffDist = Math.min(dropoffEndpointDist, dropoffRouteDist);

      // Route-direction sanity: pickup must occur before dropoff along the route
      const pIdx = closestVertexIndex(pickupCoords, lineCoords);
      const dIdx = closestVertexIndex(dropoffCoords, lineCoords);
      const orderOk = pIdx >= 0 && dIdx >= 0 ? pIdx <= dIdx : true;

      const endpointMatch = pickupEndpointDist <= PICKUP_RADIUS_KM && dropoffEndpointDist <= DROPOFF_RADIUS_KM;
      const routeMatch = pickupRouteDist <= ROUTE_CORRIDOR_KM && dropoffRouteDist <= ROUTE_CORRIDOR_KM && orderOk;

      ride._pickupDistKm = pickupDist;
      ride._dropoffDistKm = dropoffDist;

      return endpointMatch || routeMatch;
    });

  // ── 4. Score every candidate ───────────────────────────────────────────────
  const scored = candidates.map((ride) => {
    const driverRating  = ride.driverId?.rating ?? 5.0;

    const pickupDistKm = ride._pickupDistKm ?? 0;
    const dropoffDistKm = ride._dropoffDistKm ?? 0;
    const matchScore = scoreMatch(ride, pickupDistKm, dropoffDistKm, driverRating);

    return {
      ...ride,
      _pickupDistKm: parseFloat(pickupDistKm.toFixed(2)),
      _dropoffDistKm: parseFloat(ride._dropoffDistKm.toFixed(2)),
      _matchScore:   parseFloat(matchScore.toFixed(4)),
    };
  });

  // ── 5. Sort ────────────────────────────────────────────────────────────────
  const sorters = {
    match:    (a, b) => b._matchScore    - a._matchScore,
    distance: (a, b) => a._pickupDistKm  - b._pickupDistKm,
    price:    (a, b) => (a.pricePerSeat ?? a.farePerSeat) - (b.pricePerSeat ?? b.farePerSeat),
    rating:   (a, b) => (b.driverId?.rating ?? 0) - (a.driverId?.rating ?? 0),
  };
  scored.sort(sorters[sortBy] ?? sorters.match);

  // ── 6. Paginate ────────────────────────────────────────────────────────────
  const total     = scored.length;
  const skip      = (page - 1) * limit;
  const paginated = scored.slice(skip, skip + limit);

  // Strip internal fields before returning
  const rides = paginated.map(({ _dropoffDistKm, _matchScore, _pickupDistKm, ...ride }) => ({
    ...ride,
    meta: {
      pickupDistKm:  _pickupDistKm,
      dropoffDistKm: _dropoffDistKm,
      matchScore:    _matchScore,
    },
  }));

  return { total, page, pages: Math.ceil(total / limit), rides };
};

module.exports = { findMatchingRides };
