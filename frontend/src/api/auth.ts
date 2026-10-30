import api, { noRetry } from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const authAPI = {
  sendOTP: (phone: string) => api.post(API_ENDPOINTS.AUTH.SEND_OTP, { phone }),
  
  verifyOTP: (phone: string, otp: string) => api.post(API_ENDPOINTS.AUTH.VERIFY_OTP, { phone, otp }),
  
  login: (email: string, password: string) => api.post(API_ENDPOINTS.AUTH.LOGIN, { email, password }),
  
  register: (data: { name: string; email: string; phone: string; password: string }) => 
    api.post(API_ENDPOINTS.AUTH.REGISTER, data),
  
  logout: () => api.post(API_ENDPOINTS.AUTH.LOGOUT),
  
  // noRetry: auth/me is called on every page load — never retry it
  getCurrentUser: () => api.get(API_ENDPOINTS.AUTH.GET_ME, noRetry()),
  
  refreshToken: () => api.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN),
  
  guestLogin: () => api.post(API_ENDPOINTS.AUTH.GUEST_LOGIN),
  
  verifyEmail: (token: string) => api.get(API_ENDPOINTS.AUTH.VERIFY_EMAIL, { params: { token } }),
};

export default authAPI;
