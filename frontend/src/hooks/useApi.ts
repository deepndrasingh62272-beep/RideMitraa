'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { handleError, isRetryableError, type ApiError } from '@/src/services/errorHandler';
import { showToast } from '@/components/ui/Toast';
import { ratingsAPI } from '@/src/api/ratings';
import { bookingsAPI } from '@/src/api/bookings';
import { ridesAPI } from '@/src/api/rides';
import { paymentsAPI } from '@/src/api/payments';
import { chatAPI } from '@/src/api/chat';
import { profileAPI } from '@/src/api/profile';
import { safetyAPI } from '@/src/api/safety';

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseApiOptions<T = unknown> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
  context?: string;          // Error context for user-friendly messages
  showErrorToast?: boolean;  // Default true — set false to handle manually
  showSuccessToast?: string; // If provided, shows a success toast with this message
  retryCount?: number;       // Manual retry — overrides auto-retry
  retryDelay?: number;       // Base delay for manual retry (ms)
}

interface UseApiReturn {
  isLoading: boolean;
  error: ApiError | null;
  retryCount: number;
  request: <T>(
    requestFn: () => Promise<{ data: T }>,
    options?: UseApiOptions<T>
  ) => Promise<T | null>;
  clearError: () => void;
}

// ─── Core useApi Hook ───────────────────────────────────────────────────────

export function useApi(): UseApiReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const request = useCallback(async <T,>(
    requestFn: () => Promise<{ data: T }>,
    options?: UseApiOptions<T>
  ): Promise<T | null> => {
    const {
      onSuccess,
      onError,
      context,
      showErrorToast = true,
      showSuccessToast,
      retryCount: maxRetries = 0,
      retryDelay = 1000,
    } = options || {};

    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    let attempt = 0;
    let lastError: ApiError | null = null;

    while (attempt <= maxRetries) {
      try {
        const response = await requestFn();

        // Success!
        setIsLoading(false);
        setRetryCount(0);

        if (showSuccessToast) {
          showToast.success(showSuccessToast);
        }

        onSuccess?.(response.data);
        return response.data;
      } catch (err: unknown) {
        lastError = handleError(err, context, !showErrorToast);
        attempt++;
        setRetryCount(attempt);

        // Should we retry?
        if (attempt <= maxRetries && lastError.isRetryable) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // No more retries — set error state
        break;
      }
    }

    // Error path
    setIsLoading(false);
    setError(lastError);
    onError?.(lastError!);
    return null;
  }, []);

  return { isLoading, error, retryCount, request, clearError };
}

// ─── Domain-Specific Hooks ──────────────────────────────────────────────────

export function useRating() {
  const { isLoading, error, request } = useApi();

  const submitRating = useCallback((data: {
    bookingId: string;
    rating: number;
    comment?: string;
    type: 'passenger_to_driver' | 'driver_to_passenger';
  }) => {
    return request(() => ratingsAPI.submitRating(data), {
      context: 'rating',
      showSuccessToast: 'Rating submitted!',
    });
  }, [request]);

  return { submitRating, isLoading, error };
}

export function useRideActions() {
  const { isLoading, error, request } = useApi();

  const createRide = useCallback((data: {
    pickup: string;
    drop: string;
    date: string;
    time: string;
    vehicleModel?: string;
    vehicleNumber?: string;
    seatsOffered: number;
    price?: number;
  }) => {
    return request(() => ridesAPI.createRide(data), {
      context: 'ride',
      showSuccessToast: 'Ride created successfully!',
      retryCount: 1,
    });
  }, [request]);

  const cancelRide = useCallback((rideId: string) => {
    return request(() => ridesAPI.deleteRide(rideId), {
      context: 'ride',
      showSuccessToast: 'Ride cancelled',
    });
  }, [request]);

  return { createRide, cancelRide, isLoading, error };
}

export function useBookingActions() {
  const { isLoading, error, request } = useApi();

  const createBooking = useCallback((data: {
    rideId: string;
    passengersCount: number;
    seatsBooked: number;
    paymentMethod: string;
    pickup: { name: string; coordinates: [number, number] };
    dropoff: { name: string; coordinates: [number, number] };
  }) => {
    return request(() => bookingsAPI.createBooking(data), {
      context: 'booking',
      showSuccessToast: 'Booking request sent!',
      retryCount: 1,
    });
  }, [request]);

  const acceptBooking = useCallback((bookingId: string) => {
    return request(() => bookingsAPI.acceptBooking(bookingId), {
      context: 'booking',
      showSuccessToast: 'Booking accepted!',
    });
  }, [request]);

  const rejectBooking = useCallback((bookingId: string) => {
    return request(() => bookingsAPI.rejectBooking(bookingId), {
      context: 'booking',
      showSuccessToast: 'Booking rejected',
    });
  }, [request]);

  const cancelBooking = useCallback((bookingId: string) => {
    return request(() => bookingsAPI.cancelBooking(bookingId), {
      context: 'booking',
      showSuccessToast: 'Booking cancelled',
    });
  }, [request]);

  return { createBooking, acceptBooking, rejectBooking, cancelBooking, isLoading, error };
}

export function usePaymentActions() {
  const { isLoading, error, request } = useApi();

  const addMoney = useCallback((amount: number, method: string) => {
    return request(() => paymentsAPI.addMoney(amount, method), {
      context: 'payment',
      showSuccessToast: 'Money added successfully!',
      retryCount: 2,
    });
  }, [request]);

  const withdraw = useCallback((amount: number, bankDetails: {
    accountNumber: string;
    ifsc: string;
  }) => {
    return request(() => paymentsAPI.walletWithdraw({ amount, bankDetails }), {
      context: 'payment',
      showSuccessToast: 'Withdrawal initiated!',
    });
  }, [request]);

  return { addMoney, withdraw, isLoading, error };
}

export function useChatActions() {
  const { isLoading, error, request } = useApi();

  const sendMessage = useCallback((conversationId: string, content: string) => {
    return request(() => chatAPI.sendMessage({ conversationId, content }), {
      context: 'chat',
      showErrorToast: true,
    });
  }, [request]);

  return { sendMessage, isLoading, error };
}

export function useProfileActions() {
  const { isLoading, error, request } = useApi();

  const updateProfile = useCallback((data: {
    name?: string;
    email?: string;
    avatar?: string;
  }) => {
    return request(() => profileAPI.updateProfile(data), {
      showSuccessToast: 'Profile updated!',
    });
  }, [request]);

  const submitKYC = useCallback((data: {
    aadhaarFront: string;
    aadhaarBack: string;
    selfie: string;
  }) => {
    return request(() => profileAPI.submitKYC(data), {
      showSuccessToast: 'KYC submitted! Verification in progress.',
    });
  }, [request]);

  const uploadAvatar = useCallback((file: File) => {
    return request(() => profileAPI.uploadAvatar(file), {
      showSuccessToast: 'Avatar updated!',
    });
  }, [request]);

  return { updateProfile, submitKYC, uploadAvatar, isLoading, error };
}

export function useSOS() {
  const { isLoading, error, request } = useApi();

  const triggerSOS = useCallback((rideId: string) => {
    return request(() => safetyAPI.triggerSOS(rideId), {
      context: 'safety',
      onSuccess: () => {
        toast.error('🚨 SOS Alert Triggered! Emergency contacts notified.', {
          duration: 10000,
        });
      },
      showErrorToast: true,
      retryCount: 3,  // SOS is critical — retry more aggressively
    });
  }, [request]);

  return { triggerSOS, isLoading, error };
}
