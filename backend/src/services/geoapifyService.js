const axios = require('axios');
const NodeCache = require('node-cache');

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_BASE_URL = 'https://api.geoapify.com';
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

console.log('[Geoapify] API Key loaded:', GEOAPIFY_API_KEY ? 'YES (length: ' + GEOAPIFY_API_KEY.length + ')' : 'NO - UNDEFINED');

// ── Local city database (instant fallback — no network needed) ────────────────
const LOCAL_CITIES = {
  lucknow:    { lat: 26.8467, lng: 80.9462, city: 'Lucknow',    state: 'Uttar Pradesh', country: 'India' },
  sitapur:    { lat: 27.5706, lng: 80.6831, city: 'Sitapur',    state: 'Uttar Pradesh', country: 'India' },
  delhi:      { lat: 28.6139, lng: 77.2090, city: 'Delhi',      state: 'Delhi',         country: 'India' },
  mumbai:     { lat: 19.0760, lng: 72.8777, city: 'Mumbai',     state: 'Maharashtra',   country: 'India' },
  bangalore:  { lat: 12.9716, lng: 77.5946, city: 'Bangalore',  state: 'Karnataka',     country: 'India' },
  bengaluru:  { lat: 12.9716, lng: 77.5946, city: 'Bangalore',  state: 'Karnataka',     country: 'India' },
  chennai:    { lat: 13.0827, lng: 80.2707, city: 'Chennai',    state: 'Tamil Nadu',    country: 'India' },
  hyderabad:  { lat: 17.3850, lng: 78.4867, city: 'Hyderabad',  state: 'Telangana',     country: 'India' },
  kolkata:    { lat: 22.5726, lng: 88.3639, city: 'Kolkata',    state: 'West Bengal',   country: 'India' },
  pune:       { lat: 18.5204, lng: 73.8567, city: 'Pune',       state: 'Maharashtra',   country: 'India' },
  ahmedabad:  { lat: 23.0225, lng: 72.5714, city: 'Ahmedabad',  state: 'Gujarat',       country: 'India' },
  jaipur:     { lat: 26.9124, lng: 75.7873, city: 'Jaipur',     state: 'Rajasthan',     country: 'India' },
  kanpur:     { lat: 26.4499, lng: 80.3319, city: 'Kanpur',     state: 'Uttar Pradesh', country: 'India' },
  agra:       { lat: 27.1767, lng: 78.0081, city: 'Agra',       state: 'Uttar Pradesh', country: 'India' },
  varanasi:   { lat: 25.3176, lng: 82.9739, city: 'Varanasi',   state: 'Uttar Pradesh', country: 'India' },
  noida:      { lat: 28.5355, lng: 77.3910, city: 'Noida',      state: 'Uttar Pradesh', country: 'India' },
  gurgaon:    { lat: 28.4595, lng: 77.0266, city: 'Gurgaon',    state: 'Haryana',       country: 'India' },
  gurugram:   { lat: 28.4595, lng: 77.0266, city: 'Gurgaon',    state: 'Haryana',       country: 'India' },
  meerut:     { lat: 28.9845, lng: 77.7064, city: 'Meerut',     state: 'Uttar Pradesh', country: 'India' },
  allahabad:  { lat: 25.4358, lng: 81.8463, city: 'Prayagraj',  state: 'Uttar Pradesh', country: 'India' },
  prayagraj:  { lat: 25.4358, lng: 81.8463, city: 'Prayagraj',  state: 'Uttar Pradesh', country: 'India' },
  mathura:    { lat: 27.4924, lng: 77.6737, city: 'Mathura',    state: 'Uttar Pradesh', country: 'India' },
  gorakhpur:  { lat: 26.7606, lng: 83.3732, city: 'Gorakhpur',  state: 'Uttar Pradesh', country: 'India' },
  bareilly:   { lat: 28.3670, lng: 79.4304, city: 'Bareilly',   state: 'Uttar Pradesh', country: 'India' },
  aligarh:    { lat: 27.8974, lng: 78.0880, city: 'Aligarh',    state: 'Uttar Pradesh', country: 'India' },
  moradabad:  { lat: 28.8386, lng: 78.7733, city: 'Moradabad',  state: 'Uttar Pradesh', country: 'India' },
  // typo variants
  luckonw:    { lat: 26.8467, lng: 80.9462, city: 'Lucknow',    state: 'Uttar Pradesh', country: 'India' },
  deli:       { lat: 28.6139, lng: 77.2090, city: 'Delhi',      state: 'Delhi',         country: 'India' },
  bombay:     { lat: 19.0760, lng: 72.8777, city: 'Mumbai',     state: 'Maharashtra',   country: 'India' },
};

/**
 * Instant local lookup — checks if query contains any known city name.
 * Returns formatted geocode result or null.
 */
const _localCityLookup = (address) => {
  const q = address.toLowerCase().trim();
  // exact key match first
  if (LOCAL_CITIES[q]) {
    const c = LOCAL_CITIES[q];
    return { lat: c.lat, lng: c.lng, formattedAddress: c.city + ', ' + c.state, city: c.city, state: c.state, country: c.country, confidence: 'local', placeType: 'city' };
  }
  // substring match
  const key = Object.keys(LOCAL_CITIES).find(k => q.includes(k));
  if (key) {
    const c = LOCAL_CITIES[key];
    return { lat: c.lat, lng: c.lng, formattedAddress: c.city + ', ' + c.state, city: c.city, state: c.state, country: c.country, confidence: 'local', placeType: 'city' };
  }
  return null;
};

class GeoapifyError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'GeoapifyError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const geocode = async (address) => {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    throw new GeoapifyError('Address is required', 400);
  }
  if (!GEOAPIFY_API_KEY) {
    throw new GeoapifyError('Geoapify API key not configured', 503);
  }
  const cacheKey = 'geocode:' + address.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Geoapify] Cache hit for geocode:', address);
    return cached;
  }

  // ── Local city fallback (instant, no network) ──────────────────────────
  const localResult = _localCityLookup(address);
  // If local match found AND it's a known typo/variant, return immediately
  if (localResult && localResult.confidence === 'local') {
    const q = address.toLowerCase().trim();
    // Return instantly for exact key matches or known typo variants
    if (LOCAL_CITIES[q]) {
      console.log('[Geoapify] Local instant match for:', address);
      cache.set(cacheKey, localResult);
      return localResult;
    }
  }

  try {
    console.log('[Geoapify] Geocoding:', address, '| API Key:', GEOAPIFY_API_KEY.substring(0, 5) + '...');
    const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/geocode/search', {
      params: {
        text: address.trim(),
        apiKey: GEOAPIFY_API_KEY,
        limit: 1,
        format: 'json',
      },
      timeout: 10000,  // increased from 5000ms
    });
    const result = response.data?.results?.[0];
    if (!result) {
      // Try fuzzy matching for typos
      console.log('[Geoapify] No exact match for:', address, '- attempting fuzzy match');
      const fuzzyResult = await attemptFuzzyGeocode(address);
      if (fuzzyResult) {
        cache.set(cacheKey, fuzzyResult);
        return fuzzyResult;
      }
      // Fall back to local city map
      if (localResult) {
        cache.set(cacheKey, localResult);
        return localResult;
      }
      throw new GeoapifyError('Address not found', 404, { address });
    }
    const formatted = {
      lat: result.lat,
      lng: result.lon,
      formattedAddress: result.formatted,
      confidence: result.rank?.confidence || 'medium',
      placeType: result.type || 'unknown',
      country: result.country,
      state: result.state,
      city: result.city,
    };
    cache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    if (err instanceof GeoapifyError) throw err;
    console.error('[Geoapify] Geocode error:', err.message);
    // On timeout or network error — return local city data if available
    if (localResult) {
      console.log('[Geoapify] Using local fallback for:', address);
      cache.set(cacheKey, localResult);
      return localResult;
    }
    throw new GeoapifyError('Geocoding service unavailable', err.response?.status || 500, { address });
  }
};

// Fuzzy matching for typos - common Indian city typos
const attemptFuzzyGeocode = async (address) => {
  const typoMap = {
    'luckonw': 'Lucknow',
    'lucknow': 'Lucknow',
    'deli': 'Delhi',
    'delhi': 'Delhi',
    'mumbai': 'Mumbai',
    'bombay': 'Mumbai',
    'bangalore': 'Bangalore',
    'bengaluru': 'Bangalore',
    'pune': 'Pune',
    'hyderabad': 'Hyderabad',
    'noida': 'Noida',
    'gurgaon': 'Gurgaon',
    'gurugram': 'Gurgaon',
  };
  
  const lowerAddress = address.toLowerCase().trim();
  const correctedCity = typoMap[lowerAddress];
  
  if (correctedCity) {
    console.log('[Geoapify] Fuzzy match found:', address, '→', correctedCity);
    try {
      const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/geocode/search', {
        params: {
          text: correctedCity,
          apiKey: GEOAPIFY_API_KEY,
          limit: 1,
          format: 'json',
        },
        timeout: 10000,
      });
      const result = response.data?.results?.[0];
      if (result) {
        return {
          lat: result.lat,
          lng: result.lon,
          formattedAddress: result.formatted,
          confidence: 'low',  // Mark as low confidence due to typo correction
          placeType: result.type || 'unknown',
          country: result.country,
          state: result.state,
          city: result.city,
          correctedFrom: address,
        };
      }
    } catch (err) {
      console.error('[Geoapify] Fuzzy geocode error:', err.message);
    }
  }
  
  return null;
};

const reverseGeocode = async (lat, lng) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null || typeof lat !== 'number' || typeof lng !== 'number') {
    throw new GeoapifyError('Valid latitude and longitude required', 400);
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new GeoapifyError('Coordinates out of valid range', 400);
  }
  if (!GEOAPIFY_API_KEY) {
    throw new GeoapifyError('Geoapify API key not configured', 503);
  }
  const cacheKey = 'reverse:' + lat + ':' + lng;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Geoapify] Cache hit for reverse geocode:', lat, lng);
    return cached;
  }
  try {
    console.log('[Geoapify] Reverse geocoding:', lat, lng, '| API Key:', GEOAPIFY_API_KEY.substring(0, 5) + '...');
    const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/geocode/reverse', {
      params: {
        lat: lat.toFixed(6),
        lon: lng.toFixed(6),
        apiKey: GEOAPIFY_API_KEY,
        format: 'json',
      },
      timeout: 5000,
    });
    const result = response.data?.results?.[0];
    console.log('[Geoapify] Reverse geocode response:', JSON.stringify(response.data).substring(0, 200));
    if (!result) {
      throw new GeoapifyError('Location not found', 404, { lat, lng });
    }
    const formatted = {
      address: result.address_line1 || result.name || result.formatted,
      city: result.city,
      state: result.state,
      country: result.country,
      postalCode: result.postcode,
      placeType: result.place_type || 'unknown',
      latitude: lat,
      longitude: lng,
    };
    cache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    if (err instanceof GeoapifyError) throw err;
    console.error('[Geoapify] Reverse geocode error:', err.message);
    throw new GeoapifyError('Reverse geocoding service unavailable', err.response?.status || 500, { lat, lng });
  }
};

const getRoute = async (pickupLat, pickupLng, dropLat, dropLng) => {
  if (pickupLat === undefined || pickupLat === null || pickupLng === undefined || pickupLng === null || 
      dropLat === undefined || dropLat === null || dropLng === undefined || dropLng === null) {
    throw new GeoapifyError('All coordinates required', 400);
  }
  const coords = [pickupLat, pickupLng, dropLat, dropLng];
  if (!coords.every(c => typeof c === 'number')) {
    throw new GeoapifyError('All coordinates must be numbers', 400);
  }
  if (Math.abs(pickupLat) > 90 || Math.abs(pickupLng) > 180 || Math.abs(dropLat) > 90 || Math.abs(dropLng) > 180) {
    throw new GeoapifyError('Coordinates out of valid range', 400);
  }
  if (!GEOAPIFY_API_KEY) {
    throw new GeoapifyError('Geoapify API key not configured', 503);
  }
  const cacheKey = 'route:' + pickupLat + ':' + pickupLng + ':' + dropLat + ':' + dropLng;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Geoapify] Cache hit for route');
    return cached;
  }
  try {
    console.log('[Geoapify] Route calculation:', pickupLat, pickupLng, '→', dropLat, dropLng, '| API Key:', GEOAPIFY_API_KEY.substring(0, 5) + '...');
    const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/routing', {
      params: {
        waypoints: pickupLat + ',' + pickupLng + '|' + dropLat + ',' + dropLng,
        apiKey: GEOAPIFY_API_KEY,
        mode: 'drive',
        format: 'json',
      },
      timeout: 8000,
    });
    const route = response.data?.results?.[0];
    console.log('[Geoapify] Route response:', JSON.stringify(response.data).substring(0, 200));
    if (!route) {
      throw new GeoapifyError('No route found', 404);
    }
    const distanceKm = parseFloat((route.distance / 1000).toFixed(2));
    const durationMin = Math.ceil(route.time / 60);
    const eta = new Date(Date.now() + durationMin * 60 * 1000);
    const polyline = route.geometry || '';
    const steps = (route.legs?.[0]?.steps || []).map(step => ({
      instruction: step.instruction?.text || '',
      distance: parseFloat((step.distance / 1000).toFixed(2)),
      duration: Math.ceil(step.time / 60),
    }));
    const formatted = {
      distanceKm,
      durationMin,
      eta: eta.toISOString(),
      polyline,
      steps,
      source: 'geoapify',
      confidence: 'high',
    };
    cache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    if (err instanceof GeoapifyError) throw err;
    console.error('[Geoapify] Route error:', err.message);
    throw new GeoapifyError('Route calculation service unavailable', err.response?.status || 500, { pickupLat, pickupLng, dropLat, dropLng });
  }
};

const searchPlaces = async (query, limit = 5) => {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new GeoapifyError('Search query required', 400);
  }
  if (!GEOAPIFY_API_KEY) {
    throw new GeoapifyError('Geoapify API key not configured', 503);
  }
  const cacheKey = 'search:' + query.toLowerCase() + ':' + limit;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Geoapify] Cache hit for search:', query);
    return cached;
  }
  try {
    console.log('[Geoapify] Searching places:', query, '| API Key:', GEOAPIFY_API_KEY.substring(0, 5) + '...');
    const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/geocode/autocomplete', {
      params: {
        text: query.trim(),
        apiKey: GEOAPIFY_API_KEY,
        limit,
        format: 'json',
      },
      timeout: 10000,
    });
    console.log('[Geoapify] Search response count:', response.data?.results?.length || 0);
    let results = (response.data?.results || []).map(result => ({
      name: result.name,
      address: result.formatted,
      lat: result.lat,
      lng: result.lon,
      type: result.type,
      country: result.country,
      city: result.city,
    }));
    
    // If no results, try fuzzy matching then local fallback
    if (results.length === 0) {
      console.log('[Geoapify] No search results for:', query, '- attempting fuzzy match');
      const fuzzyResult = await attemptFuzzySearch(query, limit);
      if (fuzzyResult && fuzzyResult.length > 0) {
        results = fuzzyResult;
      } else {
        // local city fallback
        const local = _localCityLookup(query);
        if (local) results = [{ name: local.city, address: local.formattedAddress, lat: local.lat, lng: local.lng, type: 'city', country: local.country, city: local.city }];
      }
    }
    
    cache.set(cacheKey, results);
    return results;
  } catch (err) {
    if (err instanceof GeoapifyError) throw err;
    console.error('[Geoapify] Search error:', err.message);
    // On timeout — return local city results if available
    const local = _localCityLookup(query);
    if (local) {
      const fallback = [{ name: local.city, address: local.formattedAddress, lat: local.lat, lng: local.lng, type: 'city', country: local.country, city: local.city }];
      cache.set(cacheKey, fallback);
      return fallback;
    }
    throw new GeoapifyError('Search service unavailable', err.response?.status || 500, { query });
  }
};

// Fuzzy matching for search - common Indian city typos
const attemptFuzzySearch = async (query, limit) => {
  const typoMap = {
    'luckonw': 'Lucknow',
    'lucknow': 'Lucknow',
    'deli': 'Delhi',
    'delhi': 'Delhi',
    'mumbai': 'Mumbai',
    'bombay': 'Mumbai',
    'bangalore': 'Bangalore',
    'bengaluru': 'Bangalore',
    'pune': 'Pune',
    'hyderabad': 'Hyderabad',
    'noida': 'Noida',
    'gurgaon': 'Gurgaon',
    'gurugram': 'Gurgaon',
  };
  
  const lowerQuery = query.toLowerCase().trim();
  const correctedCity = typoMap[lowerQuery];
  
  if (correctedCity) {
    console.log('[Geoapify] Fuzzy search match found:', query, '→', correctedCity);
    try {
      const response = await axios.get(GEOAPIFY_BASE_URL + '/v1/geocode/autocomplete', {
        params: {
          text: correctedCity,
          apiKey: GEOAPIFY_API_KEY,
          limit,
          format: 'json',
        },
        timeout: 5000,
      });
      return (response.data?.results || []).map(result => ({
        name: result.name,
        address: result.formatted,
        lat: result.lat,
        lng: result.lon,
        type: result.type,
        country: result.country,
        city: result.city,
        correctedFrom: query,
      }));
    } catch (err) {
      console.error('[Geoapify] Fuzzy search error:', err.message);
    }
  }
  
  return [];
};

module.exports = {
  geocode,
  reverseGeocode,
  getRoute,
  searchPlaces,
  GeoapifyError,
  clearCache: () => cache.flushAll(),
};
