const axios = require('axios');
const NodeCache = require('node-cache');

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_BASE_URL = 'https://api.geoapify.com';

// Cache for autocomplete (1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

class MapService {
  // Geocoding: Address to Coordinates
  static async geocodeLocation(text) {
    if (!text) throw new Error('Text is required');
    if (!GEOAPIFY_KEY) throw new Error('GEOAPIFY_KEY not configured');

    try {
      const response = await axios.get(`${GEOAPIFY_BASE_URL}/v1/geocode/search`, {
        params: {
          text: text.trim(),
          apiKey: GEOAPIFY_KEY,
          limit: 1,
          format: 'json',
        },
        timeout: 5000,
      });

      const result = response.data?.results?.[0];
      if (!result) throw new Error('Location not found');

      return {
        lat: result.lat,
        lng: result.lon,
        formattedAddress: result.formatted,
        city: result.city,
        state: result.state,
        country: result.country,
      };
    } catch (error) {
      console.error('[Map Service] Geocode error:', error.message);
      throw new Error('Geocoding failed: ' + error.message);
    }
  }

  // Reverse Geocoding: Coordinates to Address
  static async reverseGeocode(lat, lon) {
    if (!lat || !lon) throw new Error('Latitude and longitude required');
    if (!GEOAPIFY_KEY) throw new Error('GEOAPIFY_KEY not configured');

    try {
      const response = await axios.get(`${GEOAPIFY_BASE_URL}/v1/geocode/reverse`, {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          apiKey: GEOAPIFY_KEY,
          format: 'json',
        },
        timeout: 5000,
      });

      const result = response.data?.features?.[0]?.properties;
      if (!result) throw new Error('Address not found');

      return {
        address: result.address_line1 || result.formatted,
        city: result.city,
        state: result.state,
        country: result.country,
        postalCode: result.postcode,
      };
    } catch (error) {
      console.error('[Map Service] Reverse geocode error:', error.message);
      throw new Error('Reverse geocoding failed: ' + error.message);
    }
  }

  // Autocomplete: Location suggestions
  static async autocompleteLocation(text) {
    if (!text) throw new Error('Text is required');
    if (!GEOAPIFY_KEY) throw new Error('GEOAPIFY_KEY not configured');

    // Check cache
    const cacheKey = 'autocomplete:' + text.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Map Service] Cache hit for autocomplete:', text);
      return cached;
    }

    try {
      const response = await axios.get(`${GEOAPIFY_BASE_URL}/v1/geocode/autocomplete`, {
        params: {
          text: text.trim(),
          apiKey: GEOAPIFY_KEY,
          limit: 10,
          format: 'json',
        },
        timeout: 5000,
      });

      const results = (response.data?.results || []).map(item => ({
        name: item.name,
        address: item.formatted,
        lat: item.lat,
        lng: item.lon,
        type: item.type,
        city: item.city,
        country: item.country,
      }));

      // Cache results
      cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('[Map Service] Autocomplete error:', error.message);
      throw new Error('Autocomplete failed: ' + error.message);
    }
  }

  // Routing: Get distance, duration, polyline
  static async getRoute(pickupLat, pickupLng, dropLat, dropLng) {
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      throw new Error('All coordinates required');
    }
    if (!GEOAPIFY_KEY) throw new Error('GEOAPIFY_KEY not configured');

    try {
      const response = await axios.get(`${GEOAPIFY_BASE_URL}/v1/routing`, {
        params: {
          waypoints: `${parseFloat(pickupLat)},${parseFloat(pickupLng)}|${parseFloat(dropLat)},${parseFloat(dropLng)}`,
          mode: 'drive',
          apiKey: GEOAPIFY_KEY,
          format: 'json',
        },
        timeout: 8000,
      });

      const route = response.data?.routes?.[0];
      if (!route) throw new Error('Route not found');

      return {
        distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
        durationMinutes: Math.ceil(route.time / 60),
        polyline: route.geometry || '',
        steps: (route.legs?.[0]?.steps || []).map(step => ({
          instruction: step.instruction?.text || '',
          distance: parseFloat((step.distance / 1000).toFixed(2)),
          duration: Math.ceil(step.time / 60),
        })),
      };
    } catch (error) {
      console.error('[Map Service] Route error:', error.message);
      throw new Error('Route calculation failed: ' + error.message);
    }
  }
}

module.exports = MapService;
