/**
 * Service Layer - Central export point for all API services
 * 
 * This file exports all service modules for easy importing throughout the app.
 * Each service handles a specific domain of the API.
 */

// Foundation — API Client & Error Handling
export { default as apiClient, retryRequest, noRetry, onAuthEvent, API_CONFIG } from './apiClient';
export {
  parseError,
  handleError,
  throwError,
  isRetryableError,
  isNetworkError,
  isAuthError,
  isApiError,
  isAxiosError,
  addErrorListener,
  type ApiError,
  type ErrorSeverity,
  type ErrorEvent,
} from './errorHandler';
export * from './responseMapper';

// Domain Services — Export only default exports to avoid conflicts
export { default as bookingService } from './bookingService';
export { default as rideService } from './rideService';
export { default as paymentService } from './paymentService';
export { default as trackingService } from './trackingService';
export { default as chatService } from './chatService';
export { default as kycService } from './kycService';
export { default as userService } from './userService';
export { default as emergencyService } from './emergencyService';
export { default as notificationService } from './notificationService';
export { default as mapService } from './mapService';
export { default as referralService } from './referralService';
