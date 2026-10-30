import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapId, mapArray } from './responseMapper';

export interface LocationSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeType?: string;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  polyline?: string;
  steps?: any[];
  eta?: string;
}

export interface FareEstimate {
  distance: number;
  duration: number;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  totalFare: number;
  currency: string;
}

/**
 * Geocode address to coordinates using Geoapify via backend
 * Backend: GET /api/map/geocode?address=...
 */
export const geocodeAddress = async (address: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/map/geocode', {
        params: { address },
      })
    );

    const result = mapId(response.data.data || response.data);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to address using Geoapify via backend
 * Backend: GET /api/map/reverse?lat=...&lng=...
 */
export const reverseGeocodeCoordinates = async (lat: number, lng: number) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/map/reverse', {
        params: { lat, lng },
      })
    );

    const result = mapId(response.data.data || response.data);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get autocomplete suggestions for address using Geoapify
 * Backend: GET /api/map/autocomplete?q=...&limit=5
 */
export const getAddressSuggestions = async (query: string, limit = 5) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/map/autocomplete', {
        params: { q: query, limit },
      })
    );

    const suggestions = mapArray(
      response.data.data || response.data.suggestions || []
    );
    return {
      success: true,
      data: suggestions,
    };
  } catch (error) {
    handleError(error, undefined, true);
    throw error;
  }
};

/**
 * Get route between two points using Geoapify
 * Backend: GET /api/map/route?pickupLat=...&pickupLng=...&dropLat=...&dropLng=...
 */
export const getRoute = async (
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/map/route', {
        params: {
          pickupLat,
          pickupLng,
          dropLat: dropoffLat,
          dropLng: dropoffLng,
        },
      })
    );

    const route = mapId(response.data.data || response.data);
    return {
      success: true,
      data: route,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Estimate fare for a route using backend fare calculation
 * Backend: POST /api/map/fare-estimate
 */
export const estimateFare = async (
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType?: string
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/map/fare-estimate', {
        originLat: pickupLat,
        originLng: pickupLng,
        destLat: dropoffLat,
        destLng: dropoffLng,
        vehicleType,
      })
    );

    const estimate = mapId(response.data.data || response.data);
    return {
      success: true,
      data: estimate,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Search places using Geoapify autocomplete (alias for getAddressSuggestions)
 * Backend: GET /api/map/autocomplete?q=...&limit=...
 */
export const searchPlaces = async (query: string, limit = 10) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/map/autocomplete', {
        params: { q: query, limit: Math.min(limit, 10) },
      })
    );

    const places = mapArray(response.data.data || response.data.suggestions || []);
    return {
      success: true,
      data: places,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get driver's last known location
 * Backend: GET /api/map/driver-location/:driverId
 */
export const getDriverLocation = async (driverId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/map/driver-location/${driverId}`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update live location (driver only)
 * Backend: POST /api/map/live-location
 */
export const updateLiveLocation = async (lat: number, lng: number, heading?: number, speed?: number) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/map/live-location', {
        lat,
        lng,
        heading,
        speed,
      })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

export default {
  geocodeAddress,
  reverseGeocodeCoordinates,
  getAddressSuggestions,
  getRoute,
  estimateFare,
  searchPlaces,
  getDriverLocation,
  updateLiveLocation,
};
