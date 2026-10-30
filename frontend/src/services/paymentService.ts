import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapTransaction, mapArray, mapId } from './responseMapper';
import { logError, logInfo, logDebug } from './errorLogger';
import mockGateway from './mockPaymentGateway';

export interface TopupRequest {
  amount: number;
  paymentMethod: 'UPI' | 'CARD' | 'NETBANKING';
}

export interface PaymentRequest {
  bookingId: string;
  amount: number;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET';
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'TOPUP' | 'PAYMENT' | 'REFUND' | 'WITHDRAWAL';
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymentMethod?: string;
  bookingId?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  totalTopup: number;
  totalSpent: number;
}

/**
 * Get wallet balance
 */
export const getWalletBalance = async () => {
  try {
    logDebug('PaymentService', 'getWalletBalance', 'Fetching wallet balance');
    const response = await retryRequest(() =>
      apiClient.get('/wallet/balance')
    );

    const wallet = mapId(response.data.data || response.data);
    logInfo('PaymentService', 'getWalletBalance', 'Wallet balance fetched', { balance: wallet.balance });
    return {
      success: true,
      data: wallet,
    };
  } catch (error) {
    logError('PaymentService', 'getWalletBalance', 'Failed to fetch wallet balance', error);
    handleError(error);
    throw error;
  }
};

/**
 * Get wallet details
 */
export const getWallet = async () => {
  try {
    logDebug('PaymentService', 'getWallet', 'Fetching wallet details');
    const response = await retryRequest(() =>
      apiClient.get('/wallet')
    );

    const wallet = mapId(response.data.data || response.data);
    logInfo('PaymentService', 'getWallet', 'Wallet details fetched');
    return {
      success: true,
      data: wallet,
    };
  } catch (error) {
    logError('PaymentService', 'getWallet', 'Failed to fetch wallet', error);
    handleError(error);
    throw error;
  }
};

/**
 * Get transaction history
 */
export const getTransactions = async (filters?: any) => {
  try {
    logDebug('PaymentService', 'getTransactions', 'Fetching transactions', { filters });
    const response = await retryRequest(() =>
      apiClient.get('/wallet/transactions', { params: filters })
    );

    const transactions = mapArray(
      response.data.data || response.data.transactions || [],
      mapTransaction
    );
    logInfo('PaymentService', 'getTransactions', `Fetched ${transactions.length} transactions`);
    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    logError('PaymentService', 'getTransactions', 'Failed to fetch transactions', error);
    handleError(error);
    throw error;
  }
};

/**
 * Topup wallet
 */
export const topupWallet = async (topupData: TopupRequest) => {
  try {
    logInfo('PaymentService', 'topupWallet', 'Initiating wallet topup', { amount: topupData.amount, method: topupData.paymentMethod });
    
    // Use mock gateway for development
    const mockOrder = mockGateway.createOrder({
      amount: topupData.amount,
      currency: 'INR',
      bookingId: 'topup',
      method: topupData.paymentMethod,
    });

    const response = await retryRequest(() =>
      apiClient.post('/wallet/topup', topupData)
    );

    logInfo('PaymentService', 'topupWallet', 'Wallet topup successful', { amount: topupData.amount });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'topupWallet', 'Wallet topup failed', error, { amount: topupData.amount });
    handleError(error);
    throw error;
  }
};

/**
 * Initiate payment for booking
 */
export const initiatePayment = async (paymentData: PaymentRequest) => {
  try {
    logInfo('PaymentService', 'initiatePayment', 'Initiating payment', {
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
      method: paymentData.paymentMethod,
    });

    // Use mock gateway for development
    const mockOrder = mockGateway.createOrder({
      amount: paymentData.amount,
      currency: 'INR',
      bookingId: paymentData.bookingId,
      method: paymentData.paymentMethod,
    });

    const response = await retryRequest(() =>
      apiClient.post('/payments/initiate', paymentData)
    );

    logInfo('PaymentService', 'initiatePayment', 'Payment initiated successfully', {
      bookingId: paymentData.bookingId,
    });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'initiatePayment', 'Payment initiation failed', error, {
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
    });
    handleError(error);
    throw error;
  }
};

/**
 * Confirm payment
 */
export const confirmPayment = async (
  bookingId: string,
  paymentId?: string,
  transactionId?: string
) => {
  try {
    logInfo('PaymentService', 'confirmPayment', 'Confirming payment', {
      bookingId,
      paymentId,
    });

    // Simulate payment capture with mock gateway
    if (paymentId) {
      const mockResult = mockGateway.capturePayment(paymentId);
      logDebug('PaymentService', 'confirmPayment', 'Mock payment captured', mockResult);
    }

    const response = await retryRequest(() =>
      apiClient.post(`/payments/confirm`, {
        bookingId,
        paymentId,
        transactionId,
      })
    );

    logInfo('PaymentService', 'confirmPayment', 'Payment confirmed successfully', { bookingId });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'confirmPayment', 'Payment confirmation failed', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Process refund
 */
export const processRefund = async (bookingId: string, reason?: string) => {
  try {
    logInfo('PaymentService', 'processRefund', 'Processing refund', {
      bookingId,
      reason,
    });

    const response = await retryRequest(() =>
      apiClient.post(`/payments/refund`, {
        bookingId,
        reason,
      })
    );

    logInfo('PaymentService', 'processRefund', 'Refund processed successfully', { bookingId });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'processRefund', 'Refund processing failed', error, { bookingId });
    handleError(error);
    throw error;
  }
};

/**
 * Withdraw from wallet
 */
export const withdrawWallet = async (amount: number, bankDetails?: any) => {
  try {
    logInfo('PaymentService', 'withdrawWallet', 'Initiating wallet withdrawal', { amount });

    const response = await retryRequest(() =>
      apiClient.post('/wallet/withdraw', {
        amount,
        bankDetails,
      })
    );

    logInfo('PaymentService', 'withdrawWallet', 'Withdrawal initiated successfully', { amount });
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'withdrawWallet', 'Withdrawal failed', error, { amount });
    handleError(error);
    throw error;
  }
};

/**
 * Get payment methods
 */
export const getPaymentMethods = async () => {
  try {
    logDebug('PaymentService', 'getPaymentMethods', 'Fetching payment methods');
    const response = await retryRequest(() =>
      apiClient.get('/payments/methods')
    );

    logInfo('PaymentService', 'getPaymentMethods', 'Payment methods fetched');
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'getPaymentMethods', 'Failed to fetch payment methods', error);
    handleError(error);
    throw error;
  }
};

/**
 * Add payment method
 */
export const addPaymentMethod = async (methodData: any) => {
  try {
    logInfo('PaymentService', 'addPaymentMethod', 'Adding payment method', { type: methodData.type });

    const response = await retryRequest(() =>
      apiClient.post('/payments/methods', methodData)
    );

    logInfo('PaymentService', 'addPaymentMethod', 'Payment method added successfully');
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    logError('PaymentService', 'addPaymentMethod', 'Failed to add payment method', error);
    handleError(error);
    throw error;
  }
};

export default {
  getWalletBalance,
  getWallet,
  getTransactions,
  topupWallet,
  initiatePayment,
  confirmPayment,
  processRefund,
  withdrawWallet,
  getPaymentMethods,
  addPaymentMethod,
};
