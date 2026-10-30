const axios = require('axios');

const CITIES = {
  lucknow:    { lat: 26.8467, lng: 80.9462, city: 'Lucknow',    state: 'UP',    country: 'India' },
  sitapur:    { lat: 27.5706, lng: 80.6831, city: 'Sitapur',    state: 'UP',    country: 'India' },
  delhi:      { lat: 28.6139, lng: 77.2090, city: 'Delhi',      state: 'Delhi', country: 'India' },
  mumbai:     { lat: 19.0760, lng: 72.8777, city: 'Mumbai',     state: 'MH',    country: 'India' },
  bangalore:  { lat: 12.9716, lng: 77.5946, city: 'Bangalore',  state: 'KA',    country: 'India' },
  chennai:    { lat: 13.0827, lng: 80.2707, city: 'Chennai',    state: 'TN',    country: 'India' },
  hyderabad:  { lat: 17.3850, lng: 78.4867, city: 'Hyderabad',  state: 'TS',    country: 'India' },
  kolkata:    { lat: 22.5726, lng: 88.3639, city: 'Kolkata',    state: 'WB',    country: 'India' },
  pune:       { lat: 18.5204, lng: 73.8567, city: 'Pune',       state: 'MH',    country: 'India' },
  ahmedabad:  { lat: 23.0225, lng: 72.5714, city: 'Ahmedabad',  state: 'GJ',    country: 'India' },
  jaipur:     { lat: 26.9124, lng: 75.7873, city: 'Jaipur',     state: 'RJ',    country: 'India' },
  surat:      { lat: 21.1702, lng: 72.8311, city: 'Surat',      state: 'GJ',    country: 'India' },
  kanpur:     { lat: 26.4499, lng: 80.3319, city: 'Kanpur',     state: 'UP',    country: 'India' },
  nagpur:     { lat: 21.1458, lng: 79.0882, city: 'Nagpur',     state: 'MH',    country: 'India' },
  indore:     { lat: 22.7196, lng: 75.8577, city: 'Indore',     state: 'MP',    country: 'India' },
  bhopal:     { lat: 23.2599, lng: 77.4126, city: 'Bhopal',     state: 'MP',    country: 'India' },
  patna:      { lat: 25.5941, lng: 85.1376, city: 'Patna',      state: 'BR',    country: 'India' },
  vadodara:   { lat: 22.3072, lng: 73.1812, city: 'Vadodara',   state: 'GJ',    country: 'India' },
  agra:       { lat: 27.1767, lng: 78.0081, city: 'Agra',       state: 'UP',    country: 'India' },
  varanasi:   { lat: 25.3176, lng: 82.9739, city: 'Varanasi',   state: 'UP',    country: 'India' },
  noida:      { lat: 28.5355, lng: 77.3910, city: 'Noida',      state: 'UP',    country: 'India' },
  gurgaon:    { lat: 28.4595, lng: 77.0266, city: 'Gurgaon',    state: 'HR',    country: 'India' },
  faridabad:  { lat: 28.4089, lng: 77.3178, city: 'Faridabad',  state: 'HR',    country: 'India' },
  meerut:     { lat: 28.9845, lng: 77.7064, city: 'Meerut',     state: 'UP',    country: 'India' },
  allahabad:  { lat: 25.4358, lng: 81.8463, city: 'Allahabad',  state: 'UP',    country: 'India' },
};

/**
 * Geocode a location query string.
 * Uses OpenCage API if OPENCAGE_API_KEY is set, otherwise falls back to CITIES map.
 * @param {string} query
 * @returns {Promise<{ name, lat, lng, city, state, country } | null>}
 */
async function geocodeLocation(query) {
  if (process.env.OPENCAGE_API_KEY) {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${process.env.OPENCAGE_API_KEY}&limit=1&countrycode=in`;
      const { data } = await axios.get(url);
      const result = data?.results?.[0];
      if (result) {
        return {
          name: query,
          lat: result.geometry.lat,
          lng: result.geometry.lng,
          city: result.components.city || result.components.town || result.components.state_district,
          state: result.components.state,
          country: 'India',
        };
      }
    } catch (err) {
      console.warn('[geocoding] OpenCage failed, using fallback:', err.message);
    }
  }

  // Fallback: case-insensitive substring match on CITIES keys
  const q = query.toLowerCase();
  const key = Object.keys(CITIES).find(k => q.includes(k));
  if (!key) return null;
  return { name: query, ...CITIES[key] };
}

/**
 * Get location suggestions for a query string.
 * Uses OpenCage API if OPENCAGE_API_KEY is set, otherwise falls back to CITIES map.
 * @param {string} query
 * @returns {Promise<Array<{ name, lat, lng, city, state, country }>>}
 */
async function getSuggestions(query) {
  if (process.env.OPENCAGE_API_KEY) {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${process.env.OPENCAGE_API_KEY}&limit=5&countrycode=in`;
      const { data } = await axios.get(url);
      return (data?.results || []).map(result => ({
        name: query,
        lat: result.geometry.lat,
        lng: result.geometry.lng,
        city: result.components.city || result.components.town || result.components.state_district,
        state: result.components.state,
        country: 'India',
      }));
    } catch (err) {
      console.warn('[geocoding] OpenCage suggestions failed, using fallback:', err.message);
    }
  }

  // Fallback: up to 5 CITIES entries whose keys contain the query
  const q = query.toLowerCase();
  return Object.entries(CITIES)
    .filter(([k]) => k.includes(q))
    .slice(0, 5)
    .map(([, v]) => ({ name: v.city, ...v }));
}

module.exports = { geocodeLocation, getSuggestions, CITIES };
