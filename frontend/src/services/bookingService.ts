import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapBooking, mapArray, mapId } from './responseMapper';
import { logError, logInfo, logDebug } from './errorLogger';

export interface CreateBookingRequest {
  rideId: string;
  passengersCount?: number;
  seatsBooked?: number;
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'; // Optional — defaults to CASH
  pickup: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
  };
  dropoff: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  driverId?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ONGOING' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';
  paymentStatus: 'UNPAID' | 'ESCROWED' | 'PAID' | 'REFUNDED';
  pickup: any;
  dropoff: any;
  totalAmount: number;
  pricePerSeat: number;
  platformFee: number;
  paymentMethod: string;
  bookingTime: string;
  rideTime: string;
}

/**
 * Search available rides
 */
export const searchRides = async (filters?: any) => {
  try {
    logDebug('BookingService', 'searchRides', 'Searching for rides', { filters });
    const response = await retryRequest(() =>
      apiClient.get('/rides', { params: filters })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    logInfo('BookingService', 'searchRides', `Found ${rides.length} rides`);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    logError('BookingService', 'searchRides', 'Failed to search rides', error);
    handleError(error);
    throw error;
  }
};

/**
 * Get ride details
 */
export const getRideDetails = async (rideId: string) => {
  try {
    logDebug('BookingService', 'getRideDetails', 'Fetching ride details', { rideId });
    const response = await retryRequest(() =>
      apiClient.get(`/rides/${rideId}`)
    );

    const ride = mapId(response.data.data || response.data);
    logInfo('BookingService', 'getRideDetails', 'Ride details fetched', { rideId });
    return {
      success: true,
      data: ride,
    };
  } catch (error) {
    logError('BookingService', 'getRideDetails', 'Failed to fetch ride details', error, { rideId });
    handleError(error);
    throw error;
  }
};

/**
 * Create booking request
 * Payment method defaults to CASH (no payment gateway required)
 */
export const createBooking = async (bookingData: CreateBookingRequest) => {
  try {
    // Default to CASH payment (no gateway needed)
    const payload = {
      ...bookingData,
      paymentMethod: bookingData.paymentMethod || 'CASH',
    };

    logInfo('BookingService', 'createBooking', 'Creating booking', {
      rideId: payload.rideId,
      seats: payload.seatsBooked || payload.passengersCount,
      paymentMethod: payload.paymentMethod,
    });

    const response = await retryRequest(() =>
      apiClient.post('/bookings', payload)
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'createBooking', 'Booking created successfully', {
      bookingId: booking.id,
      status: booking.status,
      totalAmount: booking.totalAmount,
    });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'createBooking', 'Failed to create booking', error, {
      rideId: bookingData.rideId,
      seats: bookingData.seatsBooked || bookingData.passengersCount,
    });
    handleError(error);
    throw error;
  }
};

/**
 * Get booking details
 */
export const getBookingDetails = async (bookingId: string) => {
  try {
    logDebug('BookingService', 'getBookingDetails', 'Fetching booking details', { bookingId });
    const response = await retryRequest(() =>
      apiClient.get(`/bookings/${bookingId}`)
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'getBookingDetails', 'Booking details fetched', { bookingId, status: booking.status });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'getBookingDetails', 'Failed to fetch booking details', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Get user's trips (as passenger)
 */
export const getMyTrips = async (filters?: any) => {
  try {
    logDebug('BookingService', 'getMyTrips', 'Fetching my trips');
    const response = await retryRequest(() =>
      apiClient.get('/bookings/my-trips', { params: filters })
    );

    const raw = response.data.data || response.data.bookings || response.data.trips || [];
    const trips = mapArray(raw, mapBooking);
    logInfo('BookingService', 'getMyTrips', `Fetched ${trips.length} trips`);
    return {
      success: true,
      data: trips,
    };
  } catch (error) {
    logError('BookingService', 'getMyTrips', 'Failed to fetch trips', error);
    handleError(error);
    throw error;
  }
};

/**
 * Get user's rides (as driver)
 */
export const getMyRides = async (filters?: any) => {
  try {
    logDebug('BookingService', 'getMyRides', 'Fetching my rides');
    const response = await retryRequest(() =>
      apiClient.get('/bookings/my-rides', { params: filters })
    );

    const rides = mapArray(response.data.data || response.data.rides || []);
    logInfo('BookingService', 'getMyRides', `Fetched ${rides.length} rides`);
    return {
      success: true,
      data: rides,
    };
  } catch (error) {
    logError('BookingService', 'getMyRides', 'Failed to fetch rides', error);
    handleError(error);
    throw error;
  }
};

/**
 * Get booking requests (incoming/sent)
 * Backend returns: { incoming: [...], sent: [...], requests: [...] }
 */
export const getBookingRequests = async (filters?: any) => {
  try {
    logDebug('BookingService', 'getBookingRequests', 'Fetching booking requests');
    const response = await retryRequest(() =>
      apiClient.get('/bookings/requests', { params: filters })
    );

    const raw = response.data;
    // Backend returns { incoming, sent, requests } — preserve full structure
    const incoming = mapArray(raw?.incoming || raw?.requests || [], mapBooking);
    const sent     = mapArray(raw?.sent     || [],                  mapBooking);

    logInfo('BookingService', 'getBookingRequests',
      `Fetched ${incoming.length} incoming, ${sent.length} sent requests`);

    return {
      success: true,
      // data.incoming = driver sees these; data.sent = passenger sees these
      data: { incoming, sent } as any,
    };
  } catch (error) {
    logError('BookingService', 'getBookingRequests', 'Failed to fetch booking requests', error);
    handleError(error);
    throw error;
  }
};

/**
 * Accept booking request (driver)
 */
export const acceptBooking = async (bookingId: string) => {
  try {
    logInfo('BookingService', 'acceptBooking', 'Accepting booking', { bookingId });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/${bookingId}/accept`)
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'acceptBooking', 'Booking accepted', { bookingId, status: booking.status });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'acceptBooking', 'Failed to accept booking', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Reject booking request (driver)
 */
export const rejectBooking = async (bookingId: string, reason?: string) => {
  try {
    logInfo('BookingService', 'rejectBooking', 'Rejecting booking', { bookingId, reason });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/${bookingId}/reject`, { reason })
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'rejectBooking', 'Booking rejected', { bookingId });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'rejectBooking', 'Failed to reject booking', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Cancel booking
 */
export const cancelBooking = async (bookingId: string, reason?: string) => {
  try {
    logInfo('BookingService', 'cancelBooking', 'Cancelling booking', { bookingId, reason });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/${bookingId}/cancel`, { reason })
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'cancelBooking', 'Booking cancelled', { bookingId, status: booking.status });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'cancelBooking', 'Failed to cancel booking', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Rate ride/booking — calls POST /ratings with { bookingId, score, comment }
 */
export const rateBooking = async (
  bookingId: string,
  rating: number,
  review?: string
) => {
  try {
    logInfo('BookingService', 'rateBooking', 'Rating booking', { bookingId, rating });
    const response = await retryRequest(() =>
      apiClient.post(`/ratings`, {
        bookingId,
        rating,
        review: review || undefined,
      })
    );

    logInfo('BookingService', 'rateBooking', 'Booking rated successfully', { bookingId, rating });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    if (error.response?.status === 422) {
      console.error('Rating API 422 - Validation Error:', error.response.data);
      logError('BookingService', 'rateBooking', 'Validation error - check payload schema', error, { bookingId });
    }
    logError('BookingService', 'rateBooking', 'Failed to rate booking', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (
  bookingId: string,
  status: string
) => {
  try {
    logInfo('BookingService', 'updateBookingStatus', 'Updating booking status', { bookingId, status });
    const response = await retryRequest(() =>
      apiClient.patch(`/bookings/${bookingId}`, { status })
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'updateBookingStatus', 'Booking status updated', { bookingId, newStatus: booking.status });
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    logError('BookingService', 'updateBookingStatus', 'Failed to update booking status', error, { bookingId, status });
    handleError(error);
    throw error;
  }
};

/**
 * Start ride (driver) - generates OTP
 */
export const startRide = async (rideId: string) => {
  try {
    logInfo('BookingService', 'startRide', 'Starting ride', { rideId });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/start-ride`, { rideId })
    );

    logInfo('BookingService', 'startRide', 'Ride started successfully', { rideId, otpCode: response.data.otpCode });
    return {
      success: true,
      data: response.data.data || response.data,
      otpCode: response.data.otpCode,
    };
  } catch (error) {
    logError('BookingService', 'startRide', 'Failed to start ride', error, { rideId });
    handleError(error);
    throw error;
  }
};

/**
 * End ride (driver)
 */
export const endRide = async (rideId: string) => {
  try {
    logInfo('BookingService', 'endRide', 'Ending ride', { rideId });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/end-ride`, { rideId })
    );

    logInfo('BookingService', 'endRide', 'Ride ended successfully', { rideId });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('BookingService', 'endRide', 'Failed to end ride', error, { rideId });
    handleError(error);
    throw error;
  }
};

/**
 * Verify OTP (passenger)
 */
export const verifyOTP = async (bookingId: string, otpCode: string) => {
  try {
    logInfo('BookingService', 'verifyOTP', 'Verifying OTP', { bookingId });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/verify-otp`, { bookingId, otpCode })
    );

    logInfo('BookingService', 'verifyOTP', 'OTP verified successfully', { bookingId });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('BookingService', 'verifyOTP', 'Failed to verify OTP', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Confirm dummy payment — transitions ACCEPTED → PAYMENT_DONE
 */
export const confirmPayment = async (bookingId: string) => {
  try {
    logInfo('BookingService', 'confirmPayment', 'Confirming payment', { bookingId });
    const response = await retryRequest(() =>
      apiClient.patch(`/bookings/${bookingId}/payment-confirm`)
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'confirmPayment', 'Payment confirmed', { bookingId, status: booking.status });
    return { success: true, data: booking };
  } catch (error) {
    logError('BookingService', 'confirmPayment', 'Failed to confirm payment', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Verify OTP per booking — transitions PAYMENT_DONE → OTP_VERIFIED
 */
export const verifyBookingOTP = async (bookingId: string, otpCode: string) => {
  try {
    logInfo('BookingService', 'verifyBookingOTP', 'Verifying booking OTP', { bookingId });
    const response = await retryRequest(() =>
      apiClient.post(`/bookings/${bookingId}/verify-otp`, { otpCode })
    );

    const booking = mapBooking(response.data.data || response.data);
    logInfo('BookingService', 'verifyBookingOTP', 'OTP verified', { bookingId, status: booking.status });
    return { success: true, data: booking };
  } catch (error) {
    logError('BookingService', 'verifyBookingOTP', 'Failed to verify OTP', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Get ride OTP (driver only)
 */
export const getRideOTP = async (rideId: string) => {
  try {
    logInfo('BookingService', 'getRideOTP', 'Fetching ride OTP', { rideId });
    const response = await retryRequest(() =>
      apiClient.get(`/rides/${rideId}/otp`)
    );

    const otpCode = response.data.data?.otpCode || response.data.otpCode;
    logInfo('BookingService', 'getRideOTP', 'OTP fetched', { rideId });
    return { success: true, data: { otpCode } };
  } catch (error) {
    logError('BookingService', 'getRideOTP', 'Failed to fetch ride OTP', error, { rideId });
    handleError(error);
    throw error;
  }
};

export default {
  searchRides,
  getRideDetails,
  createBooking,
  getBookingDetails,
  getMyTrips,
  getMyRides,
  getBookingRequests,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  rateBooking,
  updateBookingStatus,
  startRide,
  endRide,
  verifyOTP,
  confirmPayment,
  verifyBookingOTP,
  getRideOTP,
};
