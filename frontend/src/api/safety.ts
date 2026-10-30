import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const safetyAPI = {
  // ===== SOS ENDPOINTS =====
  
  /**
   * POST /api/safety/sos
   * Trigger SOS alert for current ride
   */
  triggerSOS: (rideId: string) =>
    api.post(API_ENDPOINTS.SAFETY.TRIGGER_SOS, { rideId }),
  
  /**
   * POST /api/safety/location
   * Update live location during SOS (called every 5 seconds)
   */
  updateLiveLocation: (rideId: string, location: { lat: number; lng: number; accuracy?: number }) =>
    api.post(API_ENDPOINTS.SAFETY.UPDATE_LOCATION, { rideId, location }),
  
  /**
   * POST /api/safety/sos/cancel
   * Cancel active SOS alert
   */
  cancelSOS: (rideId: string) =>
    api.post(API_ENDPOINTS.SAFETY.CANCEL_SOS, { rideId }),
  
  // ===== EMERGENCY SERVICES =====
  
  /**
   * POST /api/safety/emergency-services
   * Alert police or ambulance
   */
  alertEmergencyServices: (rideId: string, serviceType: 'police' | 'ambulance', location: { lat: number; lng: number }) =>
    api.post(API_ENDPOINTS.SAFETY.ALERT_EMERGENCY_SERVICES, { rideId, serviceType, location }),
  
  /**
   * POST /api/safety/notify-contacts
   * Notify emergency contacts
   */
  notifyEmergencyContacts: (rideId: string) =>
    api.post(API_ENDPOINTS.SAFETY.NOTIFY_CONTACTS, { rideId }),
  
  // ===== SAFETY RECORDS =====
  
  /**
   * GET /api/safety/record/:rideId
   * Get safety record for a specific ride
   */
  getSafetyRecord: (rideId: string) =>
    api.get(API_ENDPOINTS.SAFETY.GET_SAFETY_RECORD.replace(':rideId', rideId)),
  
  /**
   * POST /api/safety/resolve
   * Resolve SOS incident
   */
  resolveSOS: (rideId: string, resolutionNotes?: string) =>
    api.post(API_ENDPOINTS.SAFETY.RESOLVE_SOS, { rideId, resolutionNotes }),
  
  /**
   * GET /api/safety/history
   * Get user's safety history (all SOS incidents)
   */
  getSafetyHistory: (limit?: number) =>
    api.get(API_ENDPOINTS.SAFETY.GET_SAFETY_HISTORY, { params: { limit } }),
  
  /**
   * GET /api/safety/active-sos
   * Get all active SOS incidents (Admin only)
   */
  getActiveSOS: () =>
    api.get(API_ENDPOINTS.SAFETY.GET_ACTIVE_SOS),
};

export default safetyAPI;
