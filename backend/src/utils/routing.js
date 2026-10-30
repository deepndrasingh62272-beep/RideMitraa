const axios = require('axios');
const { haversine } = require('./haversine');

const round2 = (n) => Math.round(n * 100) / 100;

// Google/ORS polyline (encoded polyline algorithm)
// Returns coordinates as [[lng, lat], ...]
const decodePolyline = (str, precision = 5) => {
  if (!str || typeof str !== 'string') return [];

  const coordinates = [];
  const factor = Math.pow(10, precision);
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
};

const safeDecodePolyline = (str) => {
  for (const precision of [5, 6]) {
    const coords = decodePolyline(str, precision);
    if (!coords.length) continue;
    const ok = coords.every(([lng, lat]) =>
      Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    );
    if (ok) return coords;
  }
  return [];
};

const encodePolyline = (coords, precision = 5) => {
  if (!Array.isArray(coords) || coords.length === 0) return '';
  const factor = Math.pow(10, precision);

  let lastLat = 0;
  let lastLng = 0;
  let result = '';

  const encodeValue = (v) => {
    let value = v < 0 ? ~(v << 1) : (v << 1);
    while (value >= 0x20) {
      result += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    result += String.fromCharCode(value + 63);
  };

  for (const [lng, lat] of coords) {
    const latE5 = Math.round(lat * factor);
    const lngE5 = Math.round(lng * factor);

    const dLat = latE5 - lastLat;
    const dLng = lngE5 - lastLng;

    lastLat = latE5;
    lastLng = lngE5;

    encodeValue(dLat);
    encodeValue(dLng);
  }

  return result;
};

const downsampleLine = (coords, maxPoints = 200) => {
  if (!Array.isArray(coords) || coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < coords.length; i += step) sampled.push(coords[i]);
  const last = coords[coords.length - 1];
  if (sampled.length === 0 || sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
};

/**
 * Get road distance and estimated duration between two coordinate points.
 * Uses OpenRouteService API if ORS_API_KEY is set, otherwise falls back to Haversine × 1.3.
 * @param {{ lat: number, lng: number }} pickup
 * @param {{ lat: number, lng: number }} dropoff
 * @returns {Promise<{ distanceKm: number, durationMin: number, polyline: string|null, routeCoords: Array<[number,number]>|null, source: string }>}
 */
async function getRoadDistance(pickup, dropoff) {
  if (process.env.ORS_API_KEY) {
    try {
      const { data } = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car',
        { coordinates: [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]] },
        { headers: { Authorization: process.env.ORS_API_KEY } }
      );
      const summary = data?.routes?.[0]?.summary;
      const geometry = data?.routes?.[0]?.geometry;
      if (!summary) throw new Error('No route found');

      const polyline = typeof geometry === 'string' ? geometry : null;
      const decoded = polyline ? downsampleLine(safeDecodePolyline(polyline)) : [];

      return {
        distanceKm: parseFloat((summary.distance / 1000).toFixed(2)),
        durationMin: Math.round(summary.duration / 60),
        polyline,
        routeCoords: decoded.length >= 2 ? decoded : null,
        source: 'openrouteservice',
      };
    } catch (err) {
      console.warn('[routing] ORS failed, using Haversine fallback:', err.message);
    }
  }

  // Fallback: Haversine × 1.3 road factor
  const straight = haversine([pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]);
  const distanceKm = round2(straight * 1.3);
  const durationMin = Math.round(distanceKm / 40 * 60);
  const routeCoords = [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]];
  return {
    distanceKm,
    durationMin,
    polyline: encodePolyline(routeCoords),
    routeCoords,
    source: 'haversine',
  };
}

module.exports = { getRoadDistance };
