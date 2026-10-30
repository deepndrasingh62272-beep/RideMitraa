'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { paymentsAPI } from '@/src/api/payments';
import { handleError } from '@/src/services/errorHandler';
import { showToast } from '@/components/ui/Toast';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  title: string;
  subtitle: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
}

interface WalletContextType {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  fetchWallet: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  addMoney: (amount: number, method: string) => Promise<void>;
  withdraw: (amount: number, bankDetails: { accountNumber: string; ifsc: string }) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await paymentsAPI.getWalletBalance();
      setBalance(response.data.balance);
    } catch (error) {
      handleError(error, 'payment', true); // Silent — background fetch
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await paymentsAPI.getTransactions();
      setTransactions(response.data.transactions);
    } catch (error) {
      handleError(error, 'payment', true); // Silent — background fetch
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMoney = async (amount: number, method: string) => {
    setIsLoading(true);
    try {
      await paymentsAPI.addMoney(amount, method);
      showToast.success('Money added successfully!');
      await fetchWallet();
      await fetchTransactions();
    } catch (error) {
      handleError(error, 'payment');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const withdraw = async (amount: number, bankDetails: { accountNumber: string; ifsc: string }) => {
    setIsLoading(true);
    try {
      await paymentsAPI.walletWithdraw({ amount, bankDetails });
      showToast.success('Withdrawal initiated!');
      await fetchWallet();
      await fetchTransactions();
    } catch (error) {
      handleError(error, 'payment');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WalletContext.Provider value={{
      balance,
      transactions,
      isLoading,
      fetchWallet,
      fetchTransactions,
      addMoney,
      withdraw,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
