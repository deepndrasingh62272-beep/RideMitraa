"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  X,
  Loader2,
  IndianRupee
} from "lucide-react";
import paymentService from "@/src/services/paymentService";
import { toast } from "sonner";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

const QUICK_ACTIONS = [
  { id: "add", label: "Add Money", icon: Plus, color: "blue", gradient: "from-blue-600 to-indigo-600" },
  { id: "withdraw", label: "Withdraw", icon: Banknote, color: "emerald", gradient: "from-emerald-600 to-teal-600" },
];

function isCredit(type: string) {
  return ['TOPUP', 'CREDIT', 'REFUND', 'EARNING', 'ESCROW_RELEASE'].includes(type?.toUpperCase());
}

export default function Wallet() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchWalletData();
  }, []);

  const fetchWalletData = useCallback(async () => {
    setIsLoading(true);
    try {
      const balanceResult = await paymentService.getWalletBalance();
      if (balanceResult.success) {
        setBalance(balanceResult.data?.balance || 0);
      }

      const transactionsResult = await paymentService.getTransactions({ limit: 6 });
      if (transactionsResult.success) {
        setTransactions(transactionsResult.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      toast.error('Failed to fetch wallet data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAddMoney = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount < 10) {
      toast.error('Minimum top-up amount is ₹10');
      return;
    }
    if (amount > 50000) {
      toast.error('Maximum top-up amount is ₹50,000');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await paymentService.topupWallet({
        amount,
        paymentMethod: 'UPI',
      });

      if (result.success) {
        // If Razorpay order is returned, open checkout
        const gateway = result.data?.gateway;
        if (gateway?.order && !gateway.mock) {
          openRazorpayCheckout(gateway.order, gateway.keyId, amount);
        } else {
          // Mock/wallet direct topup
          toast.success(`₹${amount} added to wallet successfully!`);
          setShowAddMoney(false);
          setAddAmount('');
          fetchWalletData();
        }
      } else {
        toast.error('Failed to initiate top-up');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to add money';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const openRazorpayCheckout = (order: any, keyId: string, amount: number) => {
    if (typeof window === 'undefined') return;

    const options = {
      key: keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'RideMitra',
      description: 'Wallet Top-up',
      order_id: order.id,
      handler: async (response: any) => {
        try {
          // Verify payment
          await paymentService.confirmPayment(
            '',
            response.razorpay_payment_id,
            response.razorpay_order_id
          );
          toast.success(`₹${amount} added to wallet!`);
          setShowAddMoney(false);
          setAddAmount('');
          fetchWalletData();
        } catch {
          toast.error('Payment verification failed. Contact support.');
        }
      },
      prefill: {
        name: 'User',
      },
      theme: {
        color: '#2563EB',
      },
      modal: {
        ondismiss: () => {
          toast.info('Payment cancelled');
          setIsProcessing(false);
        },
      },
    };

    try {
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch {
      toast.error('Razorpay SDK not loaded. Please refresh the page.');
    }
  };

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'add') {
      setShowAddMoney(true);
    } else if (actionId === 'withdraw') {
      toast.info('Withdrawal feature coming soon!');
    }
  };

  const totalCredit = transactions
    .filter(t => isCredit(t.type) && (t.status === 'SUCCESS' || t.status === 'completed'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalDebit = transactions
    .filter(t => !isCredit(t.type) && (t.status === 'SUCCESS' || t.status === 'completed'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getTransactionLabel = (txn: any) => {
    const type = txn.type?.toUpperCase();
    const labels: Record<string, string> = {
      TOPUP: 'Wallet Top-up',
      CHARGE: 'Ride Payment',
      ESCROW_HOLD: 'Payment Held',
      ESCROW_RELEASE: 'Payment Released',
      REFUND: 'Refund',
      EARNING: 'Ride Earning',
      PLATFORM_FEE: 'Platform Fee',
      CREDIT: 'Credit',
      DEBIT: 'Debit',
    };
    return txn.note || labels[type] || type || 'Transaction';
  };

  return (
    <div className="space-y-8">
      {/* Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Wallet</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100">
          <Sparkles size={16} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-600">Premium Member</span>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isMounted ? 1 : 0, y: isMounted ? 0 : 20 }}
        className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <WalletIcon size={24} className="text-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Total Balance</p>
                <p className="text-white/40 text-xs">Available to withdraw</p>
              </div>
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className="h-10 w-32 bg-white/10 rounded-xl animate-pulse" />
              ) : (
                <p className="text-4xl font-black tracking-tight">₹{balance.toLocaleString('en-IN')}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Earned</span>
              </div>
              <p className="text-xl font-bold text-emerald-400">+₹{totalCredit.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft size={16} className="text-red-400" />
                <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Spent</span>
              </div>
              <p className="text-xl font-bold text-red-400">-₹{totalDebit.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r ${action.gradient} text-white font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]`}
              >
                <action.icon size={18} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Add Money Modal */}
      <AnimatePresence>
        {showAddMoney && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAddMoney(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-gray-900">Add Money</h2>
                <button
                  onClick={() => setShowAddMoney(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Enter Amount</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2">
                      <IndianRupee size={24} className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full h-16 pl-14 pr-5 text-2xl font-bold bg-gray-50 border-2 border-gray-100 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                      min={10}
                      max={50000}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Quick Select</label>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAddAmount(String(amt))}
                        className={`py-3 rounded-xl text-sm font-bold transition-all ${
                          addAmount === String(amt)
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAddMoney}
                  disabled={isProcessing || !addAmount || parseFloat(addAmount) < 10}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      Add ₹{addAmount || '0'} to Wallet
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Recent Transactions</h2>
          <button className="text-sm font-bold text-blue-600 hover:underline">View All</button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100" />
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-32" />
                        <div className="h-3 bg-gray-100 rounded w-24" />
                      </div>
                    </div>
                    <div className="h-6 bg-gray-100 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div
                key={transaction.id || transaction._id}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isCredit(transaction.type) ? "bg-emerald-50" : "bg-red-50"
                    }`}>
                      {isCredit(transaction.type) ? (
                        <ArrowDownLeft size={24} className="text-emerald-600" />
                      ) : (
                        <ArrowUpRight size={24} className="text-red-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{getTransactionLabel(transaction)}</h3>
                      <p className="text-xs text-gray-500 font-medium">{transaction.paymentMethod || 'Payment'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={10} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400 font-medium">{formatDate(transaction.createdAt || transaction.date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-lg font-black ${
                        isCredit(transaction.type) ? "text-emerald-600" : "text-gray-900"
                      }`}>
                        {isCredit(transaction.type) ? "+" : "-"}₹{(transaction.amount || 0).toLocaleString('en-IN')}
                      </p>
                      <div className={`flex items-center gap-1 justify-end ${
                        transaction.status === "SUCCESS" || transaction.status === "completed" ? "text-emerald-500" : "text-amber-500"
                      }`}>
                        {transaction.status === "SUCCESS" || transaction.status === "completed" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        <span className="text-[10px] font-bold uppercase">
                          {transaction.status?.toLowerCase() || 'pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-gray-100">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold">No transactions yet</p>
              <p className="text-gray-400 text-sm mt-1">Add money to start using your wallet</p>
            </div>
          )}
        </div>
      </div>

      {/* Link Payment CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
            <CreditCard size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">Link Payment Methods</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Add your bank account or cards for faster transactions and withdrawals.
            </p>
            <button className="mt-4 px-5 py-2.5 bg-white rounded-xl text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm border border-blue-100">
              Add Payment Method
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
