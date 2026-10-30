import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapUser, mapId } from './responseMapper';

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  phone: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
  profilePhoto?: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  faceVerified: boolean;
  rating?: number;
  totalRatings?: number;
  trustScore?: number;
  walletBalance?: number;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  gender?: string;
  emergencyContacts?: Array<{
    name: string;
    phone: string;
  }>;
}

export interface UserPreferences {
  id: string;
  userId: string;
  language?: string;
  notifications?: boolean;
  darkMode?: boolean;
  shareLocation?: boolean;
  autoAcceptRides?: boolean;
}

/**
 * Get current user profile
 */
export const getProfile = async () => {
  try {
    // noRetry: /users/me is called on page load — retrying on failure causes 429 spam
    const response = await apiClient.get('/users/me', { __skipRetry: true } as any);

    const user = mapUser(response.data.user || response.data);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (updates: UpdateProfileRequest) => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch('/users/me', updates)
    );

    const user = mapUser(response.data.user || response.data);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (file: File) => {
  try {
    // Validate file before upload
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file: File is required');
    }
    
    console.log('[uploadProfilePhoto] File:', file.name, file.type, file.size);
    
    const formData = new FormData();
    formData.append('photo', file);
    
    // Debug: Check FormData contents
    for (const [key, value] of formData.entries()) {
      console.log(`[uploadProfilePhoto] FormData: ${key} =`, value instanceof File ? `File(${value.name})` : value);
    }

    // DO NOT set Content-Type manually — Axios must set it with the multipart boundary
    // Manually setting it breaks the boundary and multer gets req.file = undefined → 500
    const response = await apiClient.post('/users/me/photo', formData, {
      __skipRetry: true, // never retry uploads — partial uploads cause data corruption
      timeout: 120_000,  // 2 minutes — file uploads need more time than the default 30s
      headers: {
        'Content-Type': undefined, // Let Axios set multipart boundary automatically
      },
    } as any);
    
    console.log('[uploadProfilePhoto] Success:', response.data);

    const user = mapUser(response.data.user || response.data);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/users/${userId}`)
    );

    const user = mapUser(response.data.data || response.data);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get user ratings/reviews
 */
export const getUserRatings = async (userId: string, page: number = 1, limit: number = 20) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/ratings/user/${userId}?page=${page}&limit=${limit}`)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get user preferences
 */
export const getPreferences = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/users/me/preferences')
    );

    const preferences = mapId(response.data.data || response.data);
    return {
      success: true,
      data: preferences,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update user preferences
 */
export const updatePreferences = async (preferences: Partial<UserPreferences>) => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch('/users/me/preferences', preferences)
    );

    const updated = mapId(response.data.data || response.data);
    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get user analytics
 */
export const getAnalytics = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/users/me/analytics')
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
 * Get user statistics
 */
export const getStatistics = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/users/me/statistics')
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
 * Get trust score
 */
export const getTrustScore = async (userId?: string) => {
  try {
    const url = userId ? `/users/${userId}/trust-score` : '/users/me/trust-score';
    const response = await retryRequest(() =>
      apiClient.get(url)
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
 * Get referral data
 */
export const getReferralData = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/users/me/referrals')
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
 * Delete account
 */
export const deleteAccount = async (password?: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/users/me/delete', { password })
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
 * Verify email
 */
export const verifyEmail = async (token: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/users/verify-email', { token })
    );

    const user = mapUser(response.data.data || response.data);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

export default {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getUserById,
  getUserRatings,
  getPreferences,
  updatePreferences,
  getAnalytics,
  getStatistics,
  getTrustScore,
  getReferralData,
  deleteAccount,
  verifyEmail,
};
