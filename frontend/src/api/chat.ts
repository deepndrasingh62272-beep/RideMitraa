import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const chatAPI = {
  // Send message
  sendMessage: (data: any) => api.post(API_ENDPOINTS.CHAT.SEND_MESSAGE, data),
  
  // Get messages for a ride
  getMessages: (rideId: string) => api.get(API_ENDPOINTS.CHAT.GET_MESSAGES.replace(':rideId', rideId)),
  
  // Get conversations
  getConversations: () => api.get(API_ENDPOINTS.CHAT.GET_CONVERSATIONS),
};

export default chatAPI;
