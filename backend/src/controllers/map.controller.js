const axios = require('axios');
const { haversine } = require('../utils/haversine');
const { calculateFare, calculateFareByVehicle } = require('../utils/fare');
const { getIO } = require('../config/socket');
const RideLocation = require('../models/RideLocation');
const {
  geocode: geoapifyGeocode,
  reverseGeocode: geoapifyReverseGeocode,
  getRoute: geoapifyGetRoute,
  searchPlaces: geoapifySearchPlaces,
  GeoapifyError,
} = require('../services/geoapifyService');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ORS_API_KEY = process.env.ORS_API_KEY; // OpenRouteService (free)
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

// ─── Maintenance cost per vehicle type (₹/km) ────────────────────────────────
const MAINTENANCE_RANGES = {
  HATCHBACK: [2.5, 3.5],
  SEDAN:     [3.0, 4.0],
  SUV:       [4.0, 6.0],
  AUTO:      [2.0, 3.0],
  BIKE:      [1.0, 2.0],
  VAN:       [4.0, 6.0],
};

// Default seating capacity (total seats incl. driver) per vehicle type
const DEFAULT_SEATING = {
  BIKE: 2, AUTO: 3, HATCHBACK: 5, SEDAN: 5, SUV: 7, VAN: 8,
};

// Default mileage (km/L) per vehicle type
const DEFAULT_MILEAGE = {
  BIKE: 45, AUTO: 25, HATCHBACK: 18, SEDAN: 15, SUV: 12, VAN: 10,
};

/**
 * Get maintenance cost per km for a vehicle type, adjusted by mileage.
 */
const getMaintenanceCost = (vehicleType, mileage) => {
  const range = MAINTENANCE_RANGES[vehicleType] || [3.0, 4.0];
  let base = (range[0] + range[1]) / 2;
  if (mileage < 15) base += 1.0;
  else if (mileage > 22) base -= 0.5;
  return parseFloat(base.toFixed(2));
};

/**
 * Smart cost-sharing fare calculator (spec-compliant).
 *
 * Formula:
 *   totalCost = (distance × fuelPrice / mileage) + (distance × maintenanceCost)
 *   perSeatCost = totalCost / totalSeats          (totalSeats = seatingCapacity)
 *   finalPassengerPrice = perSeatCost + 10        (₹10 platform fee)
 *   driverSeats = (totalSeats - 1) - availableSeats
 *   driverPays = driverSeats × perSeatCost
 */
const computeSmartFare = ({ distanceKm, fuelPrice, mileage, seatingCapacity, availableSeats }) => {
  const maintenance = getMaintenanceCost(null, mileage); // generic fallback
  const fuelCost    = (distanceKm * fuelPrice) / mileage;
  const maintCost   = distanceKm * maintenance;
  const totalCost   = parseFloat((fuelCost + maintCost).toFixed(2));

  const totalSeats  = seatingCapacity;
  const perSeatCost = parseFloat((totalCost / totalSeats).toFixed(2));
  const finalPassengerPrice = parseFloat((perSeatCost + 10).toFixed(2));

  const driverSeats = (totalSeats - 1) - availableSeats;
  const driverPays  = parseFloat((Math.max(0, driverSeats) * perSeatCost).toFixed(2));

  return {
    totalCost,
    perSeatCost,
    finalPassengerPrice,
    driverPays,
    maintenanceCost: maintenance,
    fuelPriceUsed: fuelPrice,
    mileageUsed: mileage,
    seatingCapacity,
    availableSeats,
  };
};

/**
 * Get road distance & duration using OpenRouteService (free tier).
 * Docs: https://openrouteservice.org/dev/#/api-docs/v2/directions
 */
const getRoadDistanceORS = async (originLat, originLng, destLat, destLng) => {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
  const { data } = await axios.post(
    url,
    {
      coordinates: [
        [parseFloat(originLng), parseFloat(originLat)],
        [parseFloat(destLng), parseFloat(destLat)],
      ],
    },
    {
      headers: {
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const summary = data?.routes?.[0]?.summary;
  if (!summary) throw new Error('OpenRouteService: no route found');

  return {
    distanceKm: parseFloat((summary.distance / 1000).toFixed(2)),
    durationMinutes: Math.ceil(summary.duration / 60),
    source: 'openrouteservice',
  };
};

/**
 * Get road distance & duration between two points.
 * Priority: OpenRouteService → Google Maps → Haversine fallback
 */
const getRoadDistance = async (originLat, originLng, destLat, destLng) => {
  // 1. Try OpenRouteService (free)
  if (ORS_API_KEY) {
    try {
      return await getRoadDistanceORS(originLat, originLng, destLat, destLng);
    } catch (e) {
      console.warn('[MAP] ORS failed, trying Google:', e.message);
    }
  }

  // 2. Try Google Maps
  if (GOOGLE_API_KEY) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
    const { data } = await axios.get(url, {
      params: {
        origins: `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        key: GOOGLE_API_KEY,
        units: 'metric',
      },
    });

    const element = data?.rows?.[0]?.elements?.[0];
    if (element && element.status === 'OK') {
      return {
        distanceKm: parseFloat((element.distance.value / 1000).toFixed(2)),
        durationMinutes: Math.ceil(element.duration.value / 60),
        distanceText: element.distance.text,
        durationText: element.duration.text,
        source: 'google',
      };
    }
  }

  // 3. Haversine fallback (no API key needed)
  const distKm = haversine([originLng, originLat], [destLng, destLat]);
  return {
    distanceKm: parseFloat(distKm.toFixed(2)),
    durationMinutes: Math.ceil((distKm / 30) * 60),
    source: 'haversine',
  };
};

/**
 * POST /api/map/fare-estimate
 * Body: { originLat, originLng, destLat, destLng, vehicleType?, fuelPrice?, mileage?, seatingCapacity?, availableSeats? }
 *
 * Returns distance, duration, and smart cost-sharing fare breakdown.
 * Uses spec formula: totalCost / totalSeats + ₹10 platform fee.
 */
exports.fareEstimate = async (req, res) => {
  try {
    const {
      originLat, originLng,
      destLat, destLng,
      vehicleType,
      fuelPrice,
      mileage,
      seatingCapacity,
      availableSeats,
    } = req.body;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ success: false, message: 'Origin and destination coordinates required' });
    }

    const routeInfo = await getRoadDistance(
      parseFloat(originLat), parseFloat(originLng),
      parseFloat(destLat), parseFloat(destLng)
    );

    const { distanceKm } = routeInfo;

    // If specific vehicle type requested — return single estimate
    if (vehicleType) {
      const vt = vehicleType.toUpperCase();
      const cap  = parseInt(seatingCapacity) || DEFAULT_SEATING[vt] || 5;
      const avail = parseInt(availableSeats) || (cap - 1);
      const mil  = parseFloat(mileage) || DEFAULT_MILEAGE[vt] || 15;
      const fuel = parseFloat(fuelPrice) || 96;
      const maintenance = getMaintenanceCost(vt, mil);

      const fuelCost  = (distanceKm * fuel) / mil;
      const maintCost = distanceKm * maintenance;
      const totalCost = parseFloat((fuelCost + maintCost).toFixed(2));
      const perSeatCost = parseFloat((totalCost / cap).toFixed(2));
      const finalPassengerPrice = parseFloat((perSeatCost + 10).toFixed(2));
      const driverSeats = Math.max(0, (cap - 1) - avail);
      const driverPays  = parseFloat((driverSeats * perSeatCost).toFixed(2));

      return res.json({
        success: true,
        route: routeInfo,
        estimate: {
          vehicleType: vt,
          farePerSeat: finalPassengerPrice,   // what passenger pays per seat
          perSeatCost,
          finalPassengerPrice,
          totalCost,
          driverPays,
          maintenanceCost: maintenance,
          fuelPriceUsed: fuel,
          mileageUsed: mil,
          seatingCapacity: cap,
          availableSeats: avail,
          distanceKm,
          fuelPrice: fuel,
        },
      });
    }

    // Return estimates for all vehicle types
    const vehicleTypes = ['BIKE', 'AUTO', 'HATCHBACK', 'SEDAN', 'SUV'];
    const estimates = vehicleTypes.map((vt) => {
      const cap  = DEFAULT_SEATING[vt] || 5;
      const avail = cap - 1;
      const mil  = parseFloat(mileage) || DEFAULT_MILEAGE[vt] || 15;
      const fuel = parseFloat(fuelPrice) || 96;
      const maintenance = getMaintenanceCost(vt, mil);

      const fuelCost  = (distanceKm * fuel) / mil;
      const maintCost = distanceKm * maintenance;
      const totalCost = parseFloat((fuelCost + maintCost).toFixed(2));
      const perSeatCost = parseFloat((totalCost / cap).toFixed(2));
      const finalPassengerPrice = parseFloat((perSeatCost + 10).toFixed(2));
      const driverSeats = 0; // driver uses 1 seat, all others offered
      const driverPays  = parseFloat((driverSeats * perSeatCost).toFixed(2));

      return {
        vehicleType: vt,
        farePerSeat: finalPassengerPrice,
        perSeatCost,
        finalPassengerPrice,
        totalCost,
        driverPays,
        maintenanceCost: maintenance,
        fuelPriceUsed: fuel,
        mileageUsed: mil,
        seatingCapacity: cap,
        availableSeats: avail,
      };
    });

    return res.json({
      success: true,
      route: routeInfo,
      estimates,
      distanceKm,
      fuelPrice: parseFloat(fuelPrice) || 96,
    });
  } catch (err) {
    console.error('[MAP] fareEstimate error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/map/live-location
 * Driver broadcasts live location (no ride required — for pre-ride tracking)
 * Body: { lat, lng, heading?, speed? }
 * Auth: Driver only
 */
exports.updateLiveLocation = async (req, res) => {
  try {
    const { lat, lng, heading, speed } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng required' });
    }

    const payload = {
      userId: req.user._id,
      role: req.user.role,
      coordinates: [parseFloat(lng), parseFloat(lat)],
      heading: heading || null,
      speed: speed || null,
      updatedAt: new Date(),
    };

    // Broadcast to user's personal room (passengers can listen to driver:userId room)
    try {
      getIO().to(`driver:${req.user._id}`).emit('driver_location', payload);
      // Also broadcast globally for nearby passenger discovery
      getIO().emit('driver_location_update', payload);
    } catch {
      // Socket not critical
    }

    res.json({ success: true, message: 'Location broadcasted', data: payload });
  } catch (err) {
    console.error('[MAP] updateLiveLocation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/map/driver-location/:driverId
 * Get last known location of a driver (from RideLocation or socket)
 */
exports.getDriverLocation = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Find most recent ride location for this driver
    const location = await RideLocation.findOne({ driverId })
      .sort({ updatedAt: -1 })
      .lean();

    if (!location) {
      return res.status(404).json({ success: false, message: 'No location data for this driver' });
    }

    res.json({
      success: true,
      driverId,
      current: location.current,
      updatedAt: location.current?.updatedAt,
    });
  } catch (err) {
    console.error('[MAP] getDriverLocation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/map/geocode?address=...
 * Convert address to lat/lng using Google Geocoding API
 */
exports.geocode = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ success: false, message: 'address query param required' });

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ success: false, message: 'Google Maps API key not configured' });
    }

    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: GOOGLE_API_KEY },
    });

    if (!data.results?.length) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const { lat, lng } = data.results[0].geometry.location;
    res.json({
      success: true,
      address: data.results[0].formatted_address,
      lat,
      lng,
    });
  } catch (err) {
    console.error('[MAP] geocode error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/map/reverse-geocode?lat=...&lng=...
 * Convert lat/lng to human-readable address
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ success: false, message: 'Google Maps API key not configured' });
    }

    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${lat},${lng}`, key: GOOGLE_API_KEY },
    });

    if (!data.results?.length) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({
      success: true,
      address: data.results[0].formatted_address,
      components: data.results[0].address_components,
    });
  } catch (err) {
    console.error('[MAP] reverseGeocode error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/map/search?q=...
 * Search for locations by query text
 */
exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    // If no Google API key, return basic response
    if (!GOOGLE_API_KEY) {
      return res.json({
        success: true,
        results: [
          {
            name: q,
            lat: 28.6139, // Default to Delhi
            lng: 77.2090,
            source: 'default'
          }
        ]
      });
    }

    // Use Google Places API for search
    try {
      const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: q,
          key: GOOGLE_API_KEY,
          region: 'IN', // Bias results to India
        },
      });

      if (!data.results?.length) {
        return res.json({
          success: true,
          results: []
        });
      }

      const results = (data.results || []).slice(0, 5).map(place => ({
        name: place.name,
        address: place.formatted_address,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      }));

      res.json({ success: true, results });
    } catch (apiErr) {
      console.warn('[MAP] Google Places API error, returning default:', apiErr.message);
      res.json({
        success: true,
        results: [
          {
            name: q,
            lat: 28.6139, // Default fallback
            lng: 77.2090,
            source: 'fallback'
          }
        ]
      });
    }
  } catch (err) {
    console.error('[MAP] search error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const { getSuggestions } = require('../utils/geocoding');
const { getFuelPrice } = require('../utils/fuelPrice');

// GET /api/map/geocode?q=<query>
exports.geocodeSearch = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ error: 'q is required' });
    const suggestions = await getSuggestions(q.trim());
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
};

// GET /api/map/fuel-price?city=<city>
exports.fuelPriceHandler = (req, res) => {
  const { city } = req.query;
  if (!city || !city.trim()) return res.status(400).json({ error: 'city is required' });
  const pricePerLitre = getFuelPrice(city.trim());
  res.json({ city: city.trim(), pricePerLitre });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ GEOAPIFY INTEGRATION ENDPOINTS ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/map/geoapify/geocode?address=...
 * Convert address to coordinates using Geoapify
 * 
 * Query Params:
 *   - address (required): Address string to geocode
 * 
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       lat: number,
 *       lng: number,
 *       formattedAddress: string,
 *       confidence: string,
 *       city: string,
 *       state: string,
 *       country: string
 *     }
 *   }
 */
exports.geoapifyGeocode = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Address query parameter is required',
        code: 'MISSING_ADDRESS',
      });
    }

    const result = await geoapifyGeocode(address);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof GeoapifyError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: 'GEOCODING_FAILED',
        details: err.details,
      });
    }

    console.error('[MAP] geoapifyGeocode error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Geocoding service error',
      code: 'SERVICE_ERROR',
    });
  }
};

/**
 * GET /api/map/geoapify/reverse-geocode?lat=...&lng=...
 * Convert coordinates to address using Geoapify
 * 
 * Query Params:
 *   - lat (required): Latitude
 *   - lng (required): Longitude
 * 
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       address: string,
 *       city: string,
 *       state: string,
 *       country: string,
 *       postalCode: string,
 *       latitude: number,
 *       longitude: number
 *     }
 *   }
 */
exports.geoapifyReverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude query parameters are required',
        code: 'MISSING_COORDINATES',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude must be valid numbers',
        code: 'INVALID_COORDINATES',
      });
    }

    const result = await geoapifyReverseGeocode(latitude, longitude);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof GeoapifyError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: 'REVERSE_GEOCODING_FAILED',
        details: err.details,
      });
    }

    console.error('[MAP] geoapifyReverseGeocode error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Reverse geocoding service error',
      code: 'SERVICE_ERROR',
    });
  }
};

/**
 * GET /api/map/geoapify/route?pickupLat=...&pickupLng=...&dropLat=...&dropLng=...
 * Calculate route between two points using Geoapify
 * 
 * Query Params:
 *   - pickupLat (required): Pickup latitude
 *   - pickupLng (required): Pickup longitude
 *   - dropLat (required): Dropoff latitude
 *   - dropLng (required): Dropoff longitude
 * 
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       distanceKm: number,
 *       durationMin: number,
 *       eta: ISO8601 string,
 *       polyline: string,
 *       steps: [
 *         {
 *           instruction: string,
 *           distance: number (km),
 *           duration: number (minutes)
 *         }
 *       ],
 *       source: 'geoapify',
 *       confidence: 'high'
 *     }
 *   }
 */
exports.geoapifyRoute = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng } = req.query;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({
        success: false,
        error: 'All coordinates required: pickupLat, pickupLng, dropLat, dropLng',
        code: 'MISSING_COORDINATES',
      });
    }

    const coords = {
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
    };

    // Validate all are numbers
    if (!Object.values(coords).every(c => Number.isFinite(c))) {
      return res.status(400).json({
        success: false,
        error: 'All coordinates must be valid numbers',
        code: 'INVALID_COORDINATES',
      });
    }

    const result = await geoapifyGetRoute(
      coords.pickupLat,
      coords.pickupLng,
      coords.dropLat,
      coords.dropLng
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err instanceof GeoapifyError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: 'ROUTE_CALCULATION_FAILED',
        details: err.details,
      });
    }

    console.error('[MAP] geoapifyRoute error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Route calculation service error',
      code: 'SERVICE_ERROR',
    });
  }
};

/**
 * GET /api/map/geoapify/search?q=...&limit=5
 * Search for places using Geoapify autocomplete
 * 
 * Query Params:
 *   - q (required): Search query
 *   - limit (optional): Max results (default 5, max 10)
 * 
 * Response:
 *   {
 *     success: true,
 *     data: [
 *       {
 *         name: string,
 *         address: string,
 *         lat: number,
 *         lng: number,
 *         type: string,
 *         city: string,
 *         country: string
 *       }
 *     ]
 *   }
 */
exports.geoapifySearch = async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
        code: 'MISSING_QUERY',
      });
    }

    let limitNum = 5;
    if (limit) {
      limitNum = parseInt(limit, 10);
      if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 10) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be an integer between 1 and 10',
          code: 'INVALID_LIMIT',
        });
      }
    }

    const results = await geoapifySearchPlaces(q.trim(), limitNum);

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (err) {
    if (err instanceof GeoapifyError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: 'SEARCH_FAILED',
        details: err.details,
      });
    }

    console.error('[MAP] geoapifySearch error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Search service error',
      code: 'SERVICE_ERROR',
    });
  }
};
