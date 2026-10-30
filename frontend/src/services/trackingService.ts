import apiClient, { retryRequest } from './apiClient';
import { handleError, ApiError } from './errorHandler';
import { API_ENDPOINTS } from '../apiConstants';

export interface RouteData {
  distanceKm: number;
  durationMin: number;
  eta: string;
  polyline: string;
  steps: Array<{
    instruction: string;
    distance: number; // km
    duration: number; // minutes
  }>;
  source: string;
  confidence: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  confidence?: string;
}

export interface DriverLocationData {
  driverId: string;
  current: {
    coordinates: [number, number]; // [lng, lat]
    heading?: number;
    speedKmh?: number;
    updatedAt: string;
  };
  updatedAt: string;
}

export interface TrackingStats {
  totalUpdates: number;
  lastUpdateTime: string;
  averageInterval: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Get route between two points using Geoapify
 */
export const getRoute = async (
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number
): Promise<ApiResponse<RouteData>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.MAP.ROUTE, {
        params: {
          pickupLat,
          pickupLng,
          dropLat,
          dropLng
        }
      })
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Geocode address to coordinates using Geoapify
 */
export const geocodeAddress = async (address: string): Promise<ApiResponse<LocationData>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.MAP.GEOCODE, {
        params: { address }
      })
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Reverse geocode coordinates to address using Geoapify
 */
export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<ApiResponse<LocationData>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.MAP.REVERSE_GEOCODE, {
        params: { lat, lng }
      })
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Search for places using Geoapify
 */
export const searchPlaces = async (
  query: string,
  limit: number = 5
): Promise<ApiResponse<LocationData[]>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.MAP.AUTOCOMPLETE, {
        params: { q: query, limit }
      })
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get driver's last known location
 */
export const getDriverLocation = async (driverId: string): Promise<ApiResponse<DriverLocationData>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.MAP.DRIVER_LOCATION.replace(':driverId', driverId))
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Update driver's live location (for driver app)
 */
export const updateLiveLocation = async (payload: {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.MAP.LIVE_LOCATION, payload)
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get fare estimate for a route
 */
export const getFareEstimate = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  vehicleType?: string
): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.MAP.FARE_ESTIMATE, {
        originLat,
        originLng,
        destLat,
        destLng,
        vehicleType
      })
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Calculate ETA based on current location and route
 */
export const calculateETA = async (
  currentLat: number,
  currentLng: number,
  destinationLat: number,
  destinationLng: number,
  speedKmh?: number
): Promise<ApiResponse<{ etaMinutes: number; distanceKm: number }>> => {
  try {
    // First get the route
    const routeResponse = await getRoute(currentLat, currentLng, destinationLat, destinationLng);
    
    if (!routeResponse.success || !routeResponse.data) {
      throw new Error('Failed to calculate route');
    }

    const { distanceKm } = routeResponse.data;
    
    // Calculate ETA
    let etaMinutes = routeResponse.data.durationMin;
    
    // Adjust ETA based on current speed if available
    if (speedKmh && speedKmh > 0) {
      const estimatedTimeHours = distanceKm / speedKmh;
      etaMinutes = Math.max(1, Math.round(estimatedTimeHours * 60));
    }

    return {
      success: true,
      data: {
        etaMinutes,
        distanceKm
      },
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get tracking statistics for a ride
 */
export const getTrackingStats = async (rideId: string): Promise<ApiResponse<TrackingStats>> => {
  try {
    // This would typically come from a dedicated endpoint
    // For now, return mock data
    return {
      success: true,
      data: {
        totalUpdates: 0,
        lastUpdateTime: new Date().toISOString(),
        averageInterval: 0,
        connectionStatus: 'disconnected'
      },
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

export default {
  getRoute,
  geocodeAddress,
  reverseGeocode,
  searchPlaces,
  getDriverLocation,
  updateLiveLocation,
  getFareEstimate,
  calculateETA,
  getTrackingStats
};