import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const ridesAPI = {
  // Get fare estimate
  fareEstimate: (originLat: number, originLng: number, destLat: number, destLng: number, vehicleType?: string) =>
    api.get(API_ENDPOINTS.RIDE.FARE_ESTIMATE, { 
      params: { originLat, originLng, destLat, destLng, vehicleType } 
    }),
  
  // Get fare breakdown
  fareBreakdown: (data: any) => api.post(API_ENDPOINTS.RIDE.FARE_BREAKDOWN, data),
  
  // Match rides
  matchRides: (params?: { pickup?: string; drop?: string; date?: string; seats?: number }) =>
    api.get(API_ENDPOINTS.RIDE.MATCH_RIDES, { params }),
  
  // Get all rides (search)
  getAllRides: (params?: { pickup?: string; drop?: string; date?: string; seats?: number }) =>
    api.get(API_ENDPOINTS.RIDE.SEARCH_RIDES, { params }),
  
  // Alternative search endpoint
  searchRides: (params?: { pickup?: string; drop?: string; date?: string; seats?: number }) =>
    api.get(API_ENDPOINTS.RIDE.SEARCH_RIDES_ALT, { params }),
  
  // Get ride by ID
  getRideById: (id: string) => api.get(API_ENDPOINTS.RIDE.GET_RIDE_BY_ID.replace(':id', id)),
  
  // Create ride
  createRide: (data: {
    pickup: string;
    drop: string;
    date: string;
    time: string;
    vehicleModel?: string;
    vehicleNumber?: string;
    seatsOffered: number;
    price?: number;
  }) => api.post(API_ENDPOINTS.RIDE.CREATE_RIDE, data),
  
  // Update ride
  updateRide: (id: string, data: Partial<{
    pickup: string;
    drop: string;
    date: string;
    time: string;
    seatsOffered: number;
    status: string;
  }>) => api.patch(API_ENDPOINTS.RIDE.UPDATE_RIDE.replace(':id', id), data),
  
  // Delete ride
  deleteRide: (id: string) => api.delete(API_ENDPOINTS.RIDE.GET_RIDE_BY_ID.replace(':id', id)),
  
  // Get published rides
  getPublishedRides: () => api.get(API_ENDPOINTS.RIDE.GET_PUBLISHED_RIDES),
  
  // Get my rides
  getMyRides: () => api.get(API_ENDPOINTS.RIDE.GET_MY_RIDES),
  
  // Get scheduled rides
  getScheduledRides: () => api.get(API_ENDPOINTS.RIDE.GET_SCHEDULED_RIDES),
  
  // Get carpool rides
  getCarpoolRides: () => api.get(API_ENDPOINTS.RIDE.GET_CARPOOL_RIDES),
  
  // Start ride
  startRide: (id: string) => api.post(API_ENDPOINTS.RIDE.START_RIDE.replace(':id', id)),
  
  // End ride
  endRide: (id: string) => api.post(API_ENDPOINTS.RIDE.END_RIDE.replace(':id', id)),
  
  // Cancel ride
  cancelRide: (id: string) => api.post(API_ENDPOINTS.RIDE.CANCEL_RIDE.replace(':id', id)),
  
  // Request ride
  requestRide: (id: string, data: any) => api.post(API_ENDPOINTS.RIDE.REQUEST_RIDE.replace(':id', id), data),
  
  // Accept ride request
  acceptRideRequest: (id: string, requestId: string) => 
    api.post(API_ENDPOINTS.RIDE.ACCEPT_RIDE_REQUEST.replace(':id', id), { requestId }),
  
  // Reject ride request
  rejectRideRequest: (id: string, requestId: string) => 
    api.post(API_ENDPOINTS.RIDE.REJECT_RIDE_REQUEST.replace(':id', id), { requestId }),
};

export default ridesAPI;
