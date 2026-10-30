import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapNotification, mapArray, mapId } from './responseMapper';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

/**
 * Get user notifications
 */
export const getNotifications = async (page = 1, limit = 20) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/notifications', {
        params: { page, limit },
      })
    );

    const notifications = mapArray(
      response.data.data || response.data.notifications || [],
      mapNotification
    );
    return {
      success: true,
      data: notifications,
      pagination: response.data.pagination,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get unread notifications count
 */
export const getUnreadCount = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/notifications/unread-count')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error, undefined, true);
    throw error;
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (notificationId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/notifications/${notificationId}`)
    );

    const notification = mapNotification(response.data.data || response.data);
    return {
      success: true,
      data: notification,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch(`/notifications/${notificationId}/read`)
    );

    const notification = mapNotification(response.data.data || response.data);
    return {
      success: true,
      data: notification,
    };
  } catch (error) {
    handleError(error, undefined, true);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch('/notifications/read-all')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error, undefined, true);
    throw error;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(`/notifications/${notificationId}`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Delete all notifications
 */
export const deleteAllNotifications = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete('/notifications/all')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/notifications/preferences')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (preferences: any) => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch('/notifications/preferences', preferences)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPushNotifications = async (subscription: any) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/notifications/subscribe', subscription)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/notifications/unsubscribe')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Send test notification
 */
export const sendTestNotification = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/notifications/test')
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

export default {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestNotification,
};
