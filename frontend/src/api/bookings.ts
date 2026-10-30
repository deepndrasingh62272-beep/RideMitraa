import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const bookingsAPI = {
  // Get my rides (as driver)
  getMyRides: () => api.get(API_ENDPOINTS.BOOKING.GET_MY_RIDES),
  
  // Get my trips (as passenger)
  getMyTrips: () => api.get(API_ENDPOINTS.BOOKING.GET_MY_TRIPS),
  
  // Get booking requests
  getRequests: () => api.get(API_ENDPOINTS.BOOKING.GET_REQUESTS),
  
  // Get booking by ID
  getBookingById: (id: string) => api.get(API_ENDPOINTS.BOOKING.GET_BOOKING_BY_ID.replace(':id', id)),
  
  // Create booking
  createBooking: (data: {
    rideId: string;
    passengersCount: number;
    seatsBooked: number;
    paymentMethod: string;
    pickup: { name: string; coordinates: [number, number] };
    dropoff: { name: string; coordinates: [number, number] };
  }) => api.post(API_ENDPOINTS.BOOKING.CREATE_BOOKING, data),
  
  // Accept booking
  acceptBooking: (id: string) => api.post(API_ENDPOINTS.BOOKING.ACCEPT_BOOKING.replace(':id', id)),
  
  // Reject booking
  rejectBooking: (id: string) => api.post(API_ENDPOINTS.BOOKING.REJECT_BOOKING.replace(':id', id)),
  
  // Cancel booking
  cancelBooking: (id: string) => api.post(API_ENDPOINTS.BOOKING.CANCEL_BOOKING.replace(':id', id)),
  
  // Start trip
  startTrip: (id: string) => api.post(API_ENDPOINTS.BOOKING.START_TRIP.replace(':id', id)),
  
  // End trip
  endTrip: (id: string) => api.post(API_ENDPOINTS.BOOKING.END_TRIP.replace(':id', id)),
  
  // Cancel published ride (for drivers)
  cancelRide: (id: string) => api.post(API_ENDPOINTS.BOOKING.CANCEL_BOOKING.replace(':id', id)),
  
  // Verify OTP (for passengers to board)
  verifyOTP: (bookingId: string, otpCode: string) => api.post(API_ENDPOINTS.BOOKING.VERIFY_OTP, { bookingId, otpCode }),
  
  // Start ride (for drivers)
  startRide: (rideId: string) => api.post('/bookings/start-ride', { rideId }),
  
  // End ride (for drivers)
  endRide: (rideId: string) => api.post('/bookings/end-ride', { rideId }),
};

export default bookingsAPI;
