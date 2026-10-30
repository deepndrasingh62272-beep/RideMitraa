import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export const paymentsAPI = {
  // Initiate payment
  initiatePayment: (data: any) => api.post(API_ENDPOINTS.PAYMENT.INITIATE, data),
  
  // Confirm payment
  confirmPayment: (data: any) => api.post(API_ENDPOINTS.PAYMENT.CONFIRM, data),
  
  // Payment webhook (for Razorpay)
  webhook: (data: any) => api.post(API_ENDPOINTS.PAYMENT.WEBHOOK, data),
  
  // Create refund
  createRefund: (data: any) => api.post(API_ENDPOINTS.PAYMENT.REFUND, data),
  
  // Get wallet for user
  getWallet: (userId: string) => 
    api.get(API_ENDPOINTS.PAYMENT.GET_WALLET.replace(':userId', userId)),
  
  // Get payment methods
  getPaymentMethods: () => api.get(API_ENDPOINTS.PAYMENT.GET_PAYMENT_METHODS),
  
  // Get transactions
  getTransactions: (params?: { page?: number; limit?: number }) =>
    api.get(API_ENDPOINTS.PAYMENT.GET_TRANSACTIONS, { params }),
  
  // Wallet topup
  walletTopup: (data: any) => api.post(API_ENDPOINTS.WALLET.TOPUP, data),
  
  // Wallet withdraw
  walletWithdraw: (data: any) => api.post(API_ENDPOINTS.DRIVER.REQUEST_WITHDRAWAL, data),
  
  // Wallet endpoints (legacy)
  getWalletBalance: () => api.get(API_ENDPOINTS.WALLET.GET_BALANCE),
  
  addMoney: (amount: number, method: string) => 
    api.post(API_ENDPOINTS.WALLET.TOPUP, { amount, method }),
};

export default paymentsAPI;
