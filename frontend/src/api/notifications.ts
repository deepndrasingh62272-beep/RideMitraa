import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const notificationsAPI = {
  // Send notification (admin only)
  sendNotification: (data: any) => api.post(API_ENDPOINTS.NOTIFICATION.SEND_NOTIFICATION, data),
  
  // Get my notifications
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get(API_ENDPOINTS.NOTIFICATION.GET_MY_NOTIFICATIONS, { params }),
  
  // Get notifications for a user (admin only)
  getUserNotifications: (userId: string) => 
    api.get(API_ENDPOINTS.NOTIFICATION.GET_USER_NOTIFICATIONS.replace(':userId', userId)),
  
  // Mark notification as read
  markAsRead: (id: string) => 
    api.patch(API_ENDPOINTS.NOTIFICATION.MARK_READ.replace(':id', id)),
  
  // Mark all notifications as read
  markAllAsRead: () => api.patch(API_ENDPOINTS.NOTIFICATION.MARK_ALL_READ),
};

export default notificationsAPI;
