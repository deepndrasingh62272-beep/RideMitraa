/**
 * API Constants for RideMitra Frontend
 * 
 * This file contains all API endpoint constants that match the backend routes exactly.
 * All endpoints are validated against the backend routes in ride-sharing-backend.
 */

// Base URLs
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth Endpoints
  AUTH: {
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    GET_ME: '/auth/me',
    REFRESH_TOKEN: '/auth/refresh',
    GUEST_LOGIN: '/auth/guest-login',
    VERIFY_EMAIL: '/auth/verify-email',
    DEV_LATEST_OTP: '/auth/dev/latest-otp' // Development only
  },

  // User Endpoints
  USER: {
    GET_ME: '/users/me',
    UPDATE_ME: '/users/me',
    UPLOAD_PHOTO: '/users/me/photo',
    GET_REFERRALS: '/users/me/referrals',
    GET_TRUST_SCORE: '/users/:id/trust-score',
    GET_PREFERENCES: '/users/preferences',
    UPDATE_PREFERENCES: '/users/preferences',
    GET_ANALYTICS: '/users/analytics',
    GET_REFERRAL: '/users/referral'
  },

  // Ride Endpoints
  RIDE: {
    FARE_ESTIMATE: '/rides/fare-estimate',
    FARE_BREAKDOWN: '/rides/fare-breakdown',
    MATCH_RIDES: '/rides/match',
    CREATE_RIDE: '/rides',
    SEARCH_RIDES: '/rides',
    SEARCH_RIDES_ALT: '/rides/search',
    GET_PUBLISHED_RIDES: '/rides/published',
    GET_MY_RIDES: '/rides/my-rides',
    GET_SCHEDULED_RIDES: '/rides/scheduled',
    GET_CARPOOL_RIDES: '/rides/carpool',
    GET_RIDE_BY_ID: '/rides/:id',
    UPDATE_RIDE: '/rides/:id',
    START_RIDE: '/rides/:id/start',
    END_RIDE: '/rides/:id/end',
    CANCEL_RIDE: '/rides/:id/cancel',
    REQUEST_RIDE: '/rides/:id/request',
    ACCEPT_RIDE_REQUEST: '/rides/:id/accept-request',
    REJECT_RIDE_REQUEST: '/rides/:id/reject-request'
  },

  // Booking Endpoints
  BOOKING: {
    GET_MY_RIDES: '/bookings/my-rides',
    GET_MY_TRIPS: '/bookings/my-trips',
    GET_REQUESTS: '/bookings/requests',
    CREATE_BOOKING: '/bookings',
    ACCEPT_BOOKING: '/bookings/:id/accept',
    REJECT_BOOKING: '/bookings/:id/reject',
    CANCEL_BOOKING: '/bookings/:id/cancel',
    GET_BOOKING_BY_ID: '/bookings/:id',
    START_TRIP: '/bookings/:id/start',
    END_TRIP: '/bookings/:id/end',
    VERIFY_OTP: '/bookings/verify-otp'
  },

  // Map Endpoints (Geoapify)
  MAP: {
    GEOCODE: '/map/geocode',
    REVERSE_GEOCODE: '/map/reverse',
    REVERSE: '/map/reverse',
    AUTOCOMPLETE: '/map/autocomplete',
    ROUTE: '/map/route',
    FARE_ESTIMATE: '/map/fare-estimate',
    LIVE_LOCATION: '/map/live-location',
    DRIVER_LOCATION: '/map/driver-location/:driverId'
  },

  // Fare Endpoints
  FARE: {
    CALCULATE: '/fare/calculate',
    COMPARE: '/fare/compare',
    ESTIMATE: '/fare/estimate',
    VEHICLE_CONFIG: '/fare/vehicle-config'
  },

  // Payment Endpoints
  PAYMENT: {
    INIT: '/payments/init',
    INITIATE: '/payments/initiate',
    CONFIRM: '/payments/confirm',
    WEBHOOK: '/payments/webhook',
    REFUND: '/payments/refund',
    GET_WALLET: '/payments/wallet/:userId',
    GET_PAYMENT_METHODS: '/payments/methods',
    GET_TRANSACTIONS: '/payments/transactions'
  },

  // Wallet Endpoints
  WALLET: {
    GET_BALANCE: '/wallet/balance',
    GET_TRANSACTIONS: '/wallet/transactions',
    TOPUP: '/wallet/topup'
  },

  // Chat Endpoints
  CHAT: {
    SEND_MESSAGE: '/chat/message',
    GET_MESSAGES: '/chat/:rideId/messages',
    GET_CONVERSATIONS: '/chat/conversations'
  },

  // Safety Endpoints
  SAFETY: {
    TRIGGER_SOS: '/safety/sos',
    UPDATE_LOCATION: '/safety/location',
    CANCEL_SOS: '/safety/sos/cancel',
    ALERT_EMERGENCY_SERVICES: '/safety/emergency-services',
    NOTIFY_CONTACTS: '/safety/notify-contacts',
    GET_SAFETY_RECORD: '/safety/record/:rideId',
    RESOLVE_SOS: '/safety/resolve',
    GET_SAFETY_HISTORY: '/safety/history',
    GET_ACTIVE_SOS: '/safety/active-sos'
  },

  // Emergency Contacts Endpoints
  EMERGENCY: {
    GET_CONTACTS: '/emergency/contacts',
    ADD_CONTACT: '/emergency/contacts',
    DELETE_CONTACT: '/emergency/contacts/:id',
    TRIGGER_SOS: '/emergency/sos'
  },

  // Rating Endpoints
  RATING: {
    CREATE_RATING: '/ratings',
    GET_USER_RATING: '/ratings/user/:id',
    GET_RATING_BY_ID: '/ratings/:id',
    UPDATE_RATING: '/ratings/:id',
    DELETE_RATING: '/ratings/:id'
  },

  // Notification Endpoints
  NOTIFICATION: {
    SEND_NOTIFICATION: '/notifications',
    GET_MY_NOTIFICATIONS: '/notifications',
    GET_USER_NOTIFICATIONS: '/notifications/:userId',
    MARK_READ: '/notifications/:id/read',
    MARK_ALL_READ: '/notifications/read-all'
  },

  // KYC Endpoints
  KYC: {
    SUBMIT_DOCUMENTS: '/kyc/documents',
    PHOTO_VERIFY: '/kyc/photo-verify',
    GET_VERIFICATION_STATUS: '/kyc/verification-status',
    GET_KYC_STATUS: '/driver/kyc/status',
    REVIEW_KYC: '/driver/kyc/review'
  },

  // Driver Endpoints
  DRIVER: {
    REGISTER: '/driver/register',
    GET_PROFILE: '/driver/profile',
    GET_WALLET: '/driver/wallet',
    REQUEST_WITHDRAWAL: '/driver/withdraw'
  },

  // Vehicle Endpoints
  VEHICLE: {
    GET_INFO: '/vehicle/info'
  },

  // Tracking Endpoints
  TRACKING: {
    UPDATE_LOCATION: '/tracking/location',
    GET_LOCATION: '/tracking/:rideId/location',
    GET_HISTORY: '/tracking/:rideId/history'
  },

  // Driver Tracking Endpoints
  DRIVER_TRACKING: {
    UPDATE_LOCATION: '/tracking/driver-location',
    GET_NEARBY_DRIVERS: '/tracking/nearby-drivers',
    GET_DRIVER_LOCATION: '/tracking/driver/:driverId',
    GET_RIDE_LOCATION: '/tracking/ride/:rideId',
    GET_ACTIVE_DRIVERS: '/tracking/active-drivers',
    GET_DRIVER_HISTORY: '/tracking/driver/:driverId/history'
  },

  // Seat Lock Endpoints
  SEAT_LOCK: {
    LOCK_SEATS: '/seat-locks/lock',
    UNLOCK_SEATS: '/seat-locks/unlock',
    GET_LOCKS: '/seat-locks',
    GET_RIDE_LOCKS: '/seat-locks/ride/:rideId',
    GET_USER_LOCKS: '/seat-locks/user/:userId',
    GET_LOCK_BY_ID: '/seat-locks/:id',
    RELEASE_LOCKS: '/seat-locks/release'
  },

  // Security Endpoints
  SECURITY: {
    FACE_VERIFY: '/security/face-verify',
    GET_FACE_VERIFY_STATUS: '/security/face-verify/status',
    DELETE_ACCOUNT: '/security/account',
    EXPORT_MY_DATA: '/security/my-data',
    LIST_FRAUD_FLAGS: '/security/fraud-flags',
    RESOLVE_FRAUD_FLAG: '/security/fraud-flags/:id/resolve'
  },

  // Analytics Endpoints
  ANALYTICS: {
    GET_MY_ANALYTICS: '/analytics/me'
  },

  // Admin Endpoints (v1)
  ADMIN: {
    LOGIN: '/v1/admin/auth/login',
    GET_ME: '/v1/admin/auth/me',
    LIST_USERS: '/v1/admin/users',
    GET_USER: '/v1/admin/users/:userId',
    BLOCK_USER: '/v1/admin/users/:userId/block',
    UNBLOCK_USER: '/v1/admin/users/:userId/unblock',
    LIST_PENDING_KYC: '/v1/admin/kyc/pending',
    APPROVE_KYC: '/v1/admin/kyc/:driverId/approve',
    REJECT_KYC: '/v1/admin/kyc/:driverId/reject',
    LIST_RIDES: '/v1/admin/rides',
    GET_RIDE_LIVE: '/v1/admin/rides/:rideId/live',
    GET_RIDE_TRACKING_HISTORY: '/v1/admin/rides/:rideId/tracking-history',
    LIST_SAFETY_ALERTS: '/v1/admin/sos/alerts',
    RESOLVE_SAFETY_ALERT: '/v1/admin/sos/alerts/:alertId/resolve',
    LIST_TRANSACTIONS: '/v1/admin/payments/transactions',
    PROCESS_REFUND: '/v1/admin/payments/refunds',
    GET_CONFIG: '/v1/admin/config',
    UPDATE_CONFIG: '/v1/admin/config',
    GET_ANALYTICS_OVERVIEW: '/v1/admin/analytics/overview',
    GET_ADMIN_LOGS: '/v1/admin/logs'
  },

  // Admin Endpoints (legacy)
  ADMIN_LEGACY: {
    LIST_USERS: '/admin/users',
    GET_USER: '/admin/users/:id',
    BAN_USER: '/admin/users/:id/ban',
    LIST_RIDES: '/admin/rides',
    LIST_BOOKINGS: '/admin/bookings',
    LIST_PAYMENTS: '/admin/payments',
    LIST_REFUNDS: '/admin/payments/refunds',
    LIST_PENDING_KYC: '/admin/kyc/pending',
    APPROVE_KYC: '/admin/kyc/:driverId/approve',
    REJECT_KYC: '/admin/kyc/:driverId/reject',
    LIST_ALERTS: '/admin/alerts',
    RESOLVE_ALERT: '/admin/alerts/:id/resolve',
    GET_ANALYTICS: '/admin/analytics',
    GET_FRAUD_ANALYTICS: '/admin/analytics/fraud',
    LIST_WITHDRAWALS: '/admin/withdrawals',
    APPROVE_WITHDRAWAL: '/admin/withdrawals/:id/approve',
    REJECT_WITHDRAWAL: '/admin/withdrawals/:id/reject'
  },

  // Health Check
  HEALTH: '/health',
  
  // Test Endpoint
  TEST: '/test'
};

// Socket.IO Events
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Chat Events
  CHAT: {
    JOIN: 'join_chat',
    LEAVE: 'leave_chat',
    MESSAGE_NEW: 'message:new',
    MESSAGE_SENT: 'message:sent',
    MESSAGE_ERROR: 'message:error'
  },
  
  // Booking Events
  BOOKING: {
    UPDATE: 'booking:update',
    ACCEPTED: 'booking:accepted',
    REJECTED: 'booking:rejected',
    CANCELLED: 'booking:cancelled',
    STARTED: 'booking:started',
    ENDED: 'booking:ended'
  },
  
  // Tracking Events
  TRACKING: {
    LOCATION_UPDATE: 'location:update',
    DRIVER_LOCATION: 'driver_location',
    RIDE_LOCATION: 'ride_location'
  },
  
  // Safety Events
  SAFETY: {
    SOS_TRIGGERED: 'sos:triggered',
    SOS_RESOLVED: 'sos:resolved',
    SOS_CANCELLED: 'sos:cancelled'
  },
  
  // Notification Events
  NOTIFICATION: {
    NEW: 'notification:new',
    READ: 'notification:read'
  }
};

// Helper function to build full URL
export const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  
  // Replace path parameters
  Object.keys(params).forEach(key => {
    if (url.includes(`:${key}`)) {
      url = url.replace(`:${key}`, params[key]);
      delete params[key];
    }
  });
  
  return url;
};

// Validation: Check if all endpoints are defined in backend
// Note: This is a static validation - actual validation should be done against running backend
export const validateEndpoints = () => {
  const warnings = [];
  
  // Check for common issues
  Object.entries(API_ENDPOINTS).forEach(([category, endpoints]) => {
    if (typeof endpoints === 'object') {
      Object.entries(endpoints).forEach(([key, endpoint]) => {
        if (endpoint.includes('undefined') || endpoint.includes('TODO')) {
          warnings.push(`${category}.${key}: ${endpoint} - Contains placeholder`);
        }
        
        // Check for missing API prefix
        if (!endpoint.startsWith('/') && endpoint !== '') {
          warnings.push(`${category}.${key}: ${endpoint} - Missing leading slash`);
        }
      });
    }
  });
  
  return warnings;
};

// Export all constants
export default {
  API_BASE_URL,
  SOCKET_URL,
  API_ENDPOINTS,
  SOCKET_EVENTS,
  buildUrl,
  validateEndpoints
};