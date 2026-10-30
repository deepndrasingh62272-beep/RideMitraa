import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapRide, mapArray, mapId } from './responseMapper';

export interface PublishRideRequest {
  pickup: {
    name: string;
    address?: string;
    coordinates: [number, number]; // [lng, lat]
  };
  dropoff: {
    name: string;
    address?: string;
    coordinates: [number, number]; // [lng, lat]
  };
  vehicle: {
    type: 'CAR' | 'SEDAN' | 'SUV' | 'HATCHBACK' | 'BIKE' | 'AUTO' | 'VAN';
    name: string;
    registrationNumber: string;
    seatingCapacity: number;
    fuelType?: string;
    mileageKmPerLitre?: number;
  };
  schedule: {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
  };
  farePerSeat?: number;
  pricePerSeat?: number;
  genderPreference?: 'ANY' | 'MALE_ONLY' | 'FEMALE_ONLY' | 'OTHER_ONLY';
  pickupRadius?: number;
}

export interface Ride {
  id: string;
  driverId: string;
  pickup: any;
  dropoff: any;
  vehicle: any;
  schedule: any;
  farePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  status: 'CREATED' | 'BOOKING_OPEN' | 'FULL' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  distanceKm: number;
  etaMinutes?: number;
}

/**
 * Publish a new ride
 */
export const publishRide = async (rideData: PublishRideRequest) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/rides', rideData)
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get all rides (search)
 */
export const getAllRides = async (filters?: any) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/rides', { params: filters })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get ride by ID
 */
export const getRideById = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/rides/${rideId}`)
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get user's published rides
 */
export const getPublishedRides = async (filters?: any) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/rides/published', { params: filters })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Estimate fare for a route
 */
export const estimateFare = async (
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType?: string,
  fuelType?: string,
  mileage?: number
) => {
  try {
    const params: any = {
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      vehicleType,
    };
    
    if (fuelType) params.fuelType = fuelType;
    if (mileage) params.mileage = mileage;
    
    const response = await retryRequest(() =>
      apiClient.get('/rides/fare-estimate', { params })
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
 * Get fare breakdown
 */
export const getFareBreakdown = async (
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType?: string
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/rides/fare-breakdown', {
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        vehicleType,
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

/**
 * Update ride details
 */
export const updateRide = async (rideId: string, updates: Partial<PublishRideRequest>) => {
  try {
    const response = await retryRequest(() =>
      apiClient.put(`/rides/${rideId}`, updates)
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Start ride (driver)
 */
export const startRide = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(`/rides/${rideId}/start`)
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * End ride (driver)
 */
export const endRide = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(`/rides/${rideId}/end`)
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Cancel ride
 */
export const cancelRide = async (rideId: string, reason?: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(`/rides/${rideId}/cancel`, { reason })
    );

    const ride = mapRide(response.data.data || response.data);
    return {
      success: true,
      data: ride,
    };
  } catch (error: any) {
    // Extract backend error message before handleError swallows it
    const backendMsg =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      null;
    if (backendMsg) {
      // Re-attach so callers can read it
      error.message = backendMsg;
    }
    handleError(error);
    throw error;
  }
};

/**
 * Get matching rides
 */
export const getMatchingRides = async (filters?: any) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/rides/match', { params: filters })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get my published rides (for drivers)
 * Pass { showCancelled: true } to include cancelled rides in the result
 */
export const getMyRides = async (params?: { showCancelled?: boolean }) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/rides/my-rides', { params })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

export default {
  publishRide,
  getAllRides,
  getRideById,
  getPublishedRides,
  estimateFare,
  getFareBreakdown,
  updateRide,
  startRide,
  endRide,
  cancelRide,
  getMatchingRides,
  getMyRides,
};
