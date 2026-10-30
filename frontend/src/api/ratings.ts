import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const ratingsAPI = {
  // Create rating
  submitRating: (data: {
    bookingId: string;
    rating: number;
    comment?: string;
    type: 'passenger_to_driver' | 'driver_to_passenger';
  }) => api.post(API_ENDPOINTS.RATING.CREATE_RATING, data),
  
  // Get user rating
  getUserRating: (userId: string) => 
    api.get(API_ENDPOINTS.RATING.GET_USER_RATING.replace(':id', userId)),
  
  // Get rating by ID
  getRatingById: (id: string) => 
    api.get(API_ENDPOINTS.RATING.GET_RATING_BY_ID.replace(':id', id)),
  
  // Update rating
  updateRating: (id: string, data: any) => 
    api.put(API_ENDPOINTS.RATING.UPDATE_RATING.replace(':id', id), data),
  
  // Delete rating
  deleteRating: (id: string) => 
    api.delete(API_ENDPOINTS.RATING.DELETE_RATING.replace(':id', id)),
};

export default ratingsAPI;
