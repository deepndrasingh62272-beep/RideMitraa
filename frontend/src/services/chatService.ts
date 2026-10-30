import apiClient, { retryRequest } from './apiClient';
import { handleError, ApiError } from './errorHandler';
import { mapMessage, mapConversation, mapArray } from './responseMapper';
import { API_ENDPOINTS } from '../apiConstants';

export interface Message {
  id: string;
  conversationId: string;
  sender: any;
  content: string;
  type: 'text' | 'image' | 'location';
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  _id: string;
  id: string;
  rideId: {
    _id: string;
    schedule?: any;
    vehicle?: any;
    pickup?: any;
    dropoff?: any;
  };
  bookingId?: string;
  driverId?: {
    _id: string;
    name: string;
    phone?: string;
  };
  passengerId?: {
    _id: string;
    name: string;
    phone?: string;
  };
  lastMessage?: {
    text: string;
    senderId: string;
    sentAt: string;
  };
  unreadCount?: Record<string, number>;
  myUnread?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  type?: 'text' | 'image' | 'location';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: {
    total: number;
    page: number;
    pages: number;
  };
}

/**
 * Get all conversations for user
 */
export const getConversations = async (filters?: any): Promise<ApiResponse<Conversation[]>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/chat/conversations', { params: filters })
    );

    const conversations = mapArray(
      response.data || [],
      mapConversation
    );
    return {
      success: true,
      data: conversations,
    };
  } catch (error: any) {
    // Handle fetch errors, network errors, and empty objects
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get conversation by ID
 */
export const getConversation = async (conversationId: string): Promise<ApiResponse<Conversation>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/chat/conversations/${conversationId}`)
    );

    const conversation = mapConversation(response.data.data || response.data);
    return {
      success: true,
      data: conversation,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get messages for a conversation
 */
export const getMessages = async (
  conversationId: string,
  page = 1,
  limit = 50
): Promise<ApiResponse<Message[]>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/chat/${conversationId}/messages`, {
        params: { page, limit },
      })
    );

    const messages = mapArray(
      response.data.messages || [],
      mapMessage
    );
    return {
      success: true,
      data: messages,
      pagination: {
        total: response.data.total || 0,
        page: response.data.page || page,
        pages: response.data.pages || 1
      },
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Get messages for a ride
 */
export const getRideMessages = async (rideId: string, page = 1, limit = 50): Promise<ApiResponse<Message[]>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/chat/${rideId}/messages`, {
        params: { page, limit },
      })
    );

    const messages = mapArray(
      response.data.messages || [],
      mapMessage
    );
    return {
      success: true,
      data: messages,
      pagination: {
        total: response.data.total || 0,
        page: response.data.page || page,
        pages: response.data.pages || 1
      },
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Send message
 */
export const sendMessage = async (messageData: SendMessageRequest): Promise<ApiResponse<Message>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(`/chat/${messageData.conversationId}/send`, {
        text: messageData.content,
        type: messageData.type || 'text',
      })
    );

    const message = mapMessage(response.data.data || response.data);
    return {
      success: true,
      data: message,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Send message to ride chat
 */
export const sendRideMessage = async (
  rideId: string,
  content: string,
  type = 'text'
): Promise<ApiResponse<Message>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(`/chat/${rideId}/send`, {
        text: content,
        type,
      })
    );

    const message = mapMessage(response.data.data || response.data);
    return {
      success: true,
      data: message,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId: string): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch(`/chat/messages/${messageId}/read`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Mark conversation as read
 */
export const markConversationAsRead = async (conversationId: string): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch(`/chat/conversations/${conversationId}/read`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Delete message
 */
export const deleteMessage = async (messageId: string): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(`/chat/messages/${messageId}`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Delete conversation
 */
export const deleteConversation = async (conversationId: string): Promise<ApiResponse> => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(`/chat/conversations/${conversationId}`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

/**
 * Search messages
 */
export const searchMessages = async (
  conversationId: string,
  query: string
): Promise<ApiResponse<Message[]>> => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/chat/${conversationId}/search`, {
        params: { q: query },
      })
    );

    const messages = mapArray(
      response.data.messages || [],
      mapMessage
    );
    return {
      success: true,
      data: messages,
    };
  } catch (error: any) {
    const apiError = handleError(error, undefined, true);
    return {
      success: false,
      error: apiError,
    };
  }
};

export default {
  getConversations,
  getConversation,
  getMessages,
  getRideMessages,
  sendMessage,
  sendRideMessage,
  markMessageAsRead,
  markConversationAsRead,
  deleteMessage,
  deleteConversation,
  searchMessages,
};
