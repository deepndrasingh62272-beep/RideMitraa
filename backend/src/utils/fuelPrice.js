// Base fuel prices by city (Petrol - default)
const FUEL_PRICES = {
  'delhi': 94.72, 'mumbai': 103.44, 'bangalore': 101.94, 'bengaluru': 101.94,
  'chennai': 100.75, 'hyderabad': 107.41, 'kolkata': 103.94, 'pune': 104.64,
  'ahmedabad': 93.68, 'lucknow': 96.72, 'jaipur': 99.71, 'surat': 93.68,
  'kanpur': 96.72, 'nagpur': 104.64, 'indore': 107.41, 'bhopal': 107.41,
  'patna': 107.41, 'vadodara': 93.68, 'agra': 96.72, 'varanasi': 96.72,
  'noida': 94.72, 'gurgaon': 94.72, 'faridabad': 94.72, 'sitapur': 96.72,
};

// Fuel type multipliers (relative to petrol base price)
const FUEL_TYPE_MULTIPLIERS = {
  'Petrol': 1.0,      // Base price
  'Diesel': 0.85,     // ~15% cheaper than petrol
  'CNG': 0.60,        // ~40% cheaper than petrol
  'EV': 0.20,         // ~80% cheaper (electricity cost)
  'Hybrid': 0.90,     // ~10% cheaper
};

const DEFAULT_PRICE = 103;
const TTL = 60 * 60 * 1000;
const cache = new Map();

function getFuelPrice(city, fuelType = 'Petrol') {
  const cityKey = (city || '').toLowerCase().trim();
  const fuelKey = (fuelType || 'Petrol').toLowerCase();
  
  // Create cache key combining city and fuel type
  const cacheKey = `${cityKey}_${fuelKey}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.price;
  
  // Get base petrol price for city
  const basePrice = FUEL_PRICES[cityKey] ?? DEFAULT_PRICE;
  
  // Apply fuel type multiplier
  const multiplier = FUEL_TYPE_MULTIPLIERS[fuelType] ?? FUEL_TYPE_MULTIPLIERS['Petrol'];
  const finalPrice = Math.round(basePrice * multiplier * 100) / 100;
  
  cache.set(cacheKey, { price: finalPrice, expiresAt: Date.now() + TTL });
  return finalPrice;
}

module.exports = { getFuelPrice, FUEL_TYPE_MULTIPLIERS };
