import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const adminAPI = {
  // Admin v1 endpoints
  login: (email: string, password: string) => 
    api.post(API_ENDPOINTS.ADMIN.LOGIN, { email, password }),
  
  getMe: () => api.get(API_ENDPOINTS.ADMIN.GET_ME),
  
  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ENDPOINTS.ADMIN.LIST_USERS, { params }),
  
  getUser: (userId: string) => 
    api.get(API_ENDPOINTS.ADMIN.GET_USER.replace(':userId', userId)),
  
  blockUser: (userId: string) => 
    api.patch(API_ENDPOINTS.ADMIN.BLOCK_USER.replace(':userId', userId)),
  
  unblockUser: (userId: string) => 
    api.patch(API_ENDPOINTS.ADMIN.UNBLOCK_USER.replace(':userId', userId)),
  
  listPendingKyc: () => api.get(API_ENDPOINTS.ADMIN.LIST_PENDING_KYC),
  
  approveKyc: (driverId: string) => 
    api.post(API_ENDPOINTS.ADMIN.APPROVE_KYC.replace(':driverId', driverId)),
  
  rejectKyc: (driverId: string) => 
    api.post(API_ENDPOINTS.ADMIN.REJECT_KYC.replace(':driverId', driverId)),
  
  listRides: (params?: { page?: number; status?: string }) =>
    api.get(API_ENDPOINTS.ADMIN.LIST_RIDES, { params }),
  
  getRideLive: (rideId: string) => 
    api.get(API_ENDPOINTS.ADMIN.GET_RIDE_LIVE.replace(':rideId', rideId)),
  
  getRideTrackingHistory: (rideId: string) => 
    api.get(API_ENDPOINTS.ADMIN.GET_RIDE_TRACKING_HISTORY.replace(':rideId', rideId)),
  
  listSafetyAlerts: () => api.get(API_ENDPOINTS.ADMIN.LIST_SAFETY_ALERTS),
  
  resolveSafetyAlert: (alertId: string) => 
    api.patch(API_ENDPOINTS.ADMIN.RESOLVE_SAFETY_ALERT.replace(':alertId', alertId)),
  
  listTransactions: () => api.get(API_ENDPOINTS.ADMIN.LIST_TRANSACTIONS),
  
  processRefund: (data: any) => api.post(API_ENDPOINTS.ADMIN.PROCESS_REFUND, data),
  
  getConfig: () => api.get(API_ENDPOINTS.ADMIN.GET_CONFIG),
  
  updateConfig: (data: any) => api.patch(API_ENDPOINTS.ADMIN.UPDATE_CONFIG, data),
  
  getAnalyticsOverview: () => api.get(API_ENDPOINTS.ADMIN.GET_ANALYTICS_OVERVIEW),
  
  getAdminLogs: () => api.get(API_ENDPOINTS.ADMIN.GET_ADMIN_LOGS),
  
  // Legacy admin endpoints
  listUsersLegacy: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_USERS, { params }),
  
  getUserLegacy: (id: string) => 
    api.get(API_ENDPOINTS.ADMIN_LEGACY.GET_USER.replace(':id', id)),
  
  banUserLegacy: (id: string) => 
    api.patch(API_ENDPOINTS.ADMIN_LEGACY.BAN_USER.replace(':id', id)),
  
  listRidesLegacy: (params?: { page?: number; status?: string }) =>
    api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_RIDES, { params }),
  
  listBookingsLegacy: (params?: { page?: number; status?: string }) =>
    api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_BOOKINGS, { params }),
  
  listPaymentsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_PAYMENTS),
  
  listRefundsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_REFUNDS),
  
  listPendingKycLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_PENDING_KYC),
  
  approveKycLegacy: (driverId: string) => 
    api.post(API_ENDPOINTS.ADMIN_LEGACY.APPROVE_KYC.replace(':driverId', driverId)),
  
  rejectKycLegacy: (driverId: string) => 
    api.post(API_ENDPOINTS.ADMIN_LEGACY.REJECT_KYC.replace(':driverId', driverId)),
  
  listAlertsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_ALERTS),
  
  resolveAlertLegacy: (id: string) => 
    api.patch(API_ENDPOINTS.ADMIN_LEGACY.RESOLVE_ALERT.replace(':id', id)),
  
  getAnalyticsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.GET_ANALYTICS),
  
  getFraudAnalyticsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.GET_FRAUD_ANALYTICS),
  
  listWithdrawalsLegacy: () => api.get(API_ENDPOINTS.ADMIN_LEGACY.LIST_WITHDRAWALS),
  
  approveWithdrawalLegacy: (id: string) => 
    api.post(API_ENDPOINTS.ADMIN_LEGACY.APPROVE_WITHDRAWAL.replace(':id', id)),
  
  rejectWithdrawalLegacy: (id: string) => 
    api.post(API_ENDPOINTS.ADMIN_LEGACY.REJECT_WITHDRAWAL.replace(':id', id)),
};

export default adminAPI;
