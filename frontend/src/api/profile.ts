import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const profileAPI = {
  // Get user profile
  getProfile: () => api.get(API_ENDPOINTS.USER.GET_ME),
  
  // Update profile
  updateProfile: (data: { name?: string; email?: string; avatar?: string; phone?: string }) =>
    api.patch(API_ENDPOINTS.USER.UPDATE_ME, data),
  
  // Upload profile photo
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post(API_ENDPOINTS.USER.UPLOAD_PHOTO, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Get referrals
  getReferrals: () => api.get(API_ENDPOINTS.USER.GET_REFERRALS),
  
  // Get trust score
  getTrustScore: (userId: string) => 
    api.get(API_ENDPOINTS.USER.GET_TRUST_SCORE.replace(':id', userId)),
  
  // Get preferences
  getPreferences: () => api.get(API_ENDPOINTS.USER.GET_PREFERENCES),
  
  // Update preferences
  updatePreferences: (data: any) => api.put(API_ENDPOINTS.USER.UPDATE_PREFERENCES, data),
  
  // Get analytics
  getAnalytics: () => api.get(API_ENDPOINTS.USER.GET_ANALYTICS),
  
  // Get referral info
  getReferral: () => api.get(API_ENDPOINTS.USER.GET_REFERRAL),
  
  // KYC endpoints
  getKYCStatus: () => api.get(API_ENDPOINTS.KYC.GET_KYC_STATUS),
  
  submitKYC: (data: { aadhaarFront: string; aadhaarBack: string; selfie: string }) =>
    api.post(API_ENDPOINTS.KYC.SUBMIT_DOCUMENTS, data),
  
  photoVerify: (data: any) => api.post(API_ENDPOINTS.KYC.PHOTO_VERIFY, data),
  
  getVerificationStatus: () => api.get(API_ENDPOINTS.KYC.GET_VERIFICATION_STATUS),
  
  // Emergency contacts
  getEmergencyContacts: () => api.get(API_ENDPOINTS.EMERGENCY.GET_CONTACTS),
  
  addEmergencyContact: (data: { name: string; phone: string }) =>
    api.post(API_ENDPOINTS.EMERGENCY.ADD_CONTACT, data),
  
  removeEmergencyContact: (id: string) => 
    api.delete(API_ENDPOINTS.EMERGENCY.DELETE_CONTACT.replace(':id', id)),
};

export default profileAPI;
