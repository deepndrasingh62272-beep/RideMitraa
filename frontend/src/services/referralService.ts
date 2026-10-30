import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapId, mapArray } from './responseMapper';

export interface ReferralData {
  id: string;
  userId: string;
  referralCode: string;
  referredBy?: string;
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  referralLink: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  earnedAmount: number;
  createdAt: string;
  completedAt?: string;
}

/**
 * Get referral data for current user
 */
export const getReferralData = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/users/me/referrals')
    );

    const data = mapId(response.data.data || response.data);
    return {
      success: true,
      data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get list of user's referrals
 */
export const getMyReferrals = async (page = 1, limit = 20) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/referrals/my-referrals', {
        params: { page, limit },
      })
    );

    const referrals = mapArray(
      response.data.data || response.data.referrals || []
    );
    return {
      success: true,
      data: referrals,
      pagination: response.data.pagination,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get referral code
 */
export const getReferralCode = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/referrals/code')
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
 * Generate new referral code
 */
export const generateReferralCode = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/referrals/generate-code')
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
 * Apply referral code during signup
 */
export const applyReferralCode = async (referralCode: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/referrals/apply', { referralCode })
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
 * Get referral statistics
 */
export const getReferralStats = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/referrals/stats')
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
 * Get referral earnings
 */
export const getReferralEarnings = async (page = 1, limit = 20) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/referrals/earnings', {
        params: { page, limit },
      })
    );

    const earnings = mapArray(
      response.data.data || response.data.earnings || []
    );
    return {
      success: true,
      data: earnings,
      pagination: response.data.pagination,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Withdraw referral earnings
 */
export const withdrawReferralEarnings = async (amount: number) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/referrals/withdraw', { amount })
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
 * Get referral terms and conditions
 */
export const getReferralTerms = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/referrals/terms')
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
 * Share referral link
 */
export const shareReferralLink = async (platform: string) => {
  try {
    const referralData = await getReferralData();
    const referralLink = referralData.data.referralLink;

    if (navigator.share) {
      await navigator.share({
        title: 'Join RideMitraa',
        text: 'Get discounts on your rides!',
        url: referralLink,
      });
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(referralLink);
    }

    return {
      success: true,
      data: { message: 'Referral link shared successfully' },
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Track referral click
 */
export const trackReferralClick = async (referralCode: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/referrals/track-click', { referralCode })
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

export default {
  getReferralData,
  getMyReferrals,
  getReferralCode,
  generateReferralCode,
  applyReferralCode,
  getReferralStats,
  getReferralEarnings,
  withdrawReferralEarnings,
  getReferralTerms,
  shareReferralLink,
  trackReferralClick,
};
