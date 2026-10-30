"use client";

import React from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Plus, Banknote, TrendingUp, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";

interface WalletCardProps {
  balance: number;
  isCompact?: boolean;
}

export default function WalletCard({ balance, isCompact = false }: WalletCardProps) {
  const handleAddMoney = () => {
    toast.success("Add Money feature coming soon!");
  };

  const handleWithdraw = () => {
    toast.success("Withdraw feature coming soon!");
  };

  if (isCompact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <WalletIcon size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Wallet Balance</p>
                <p className="text-2xl font-black text-gray-900">₹{balance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddMoney}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Money
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWithdraw}
              className="flex-1 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <Banknote size={18} />
              Withdraw
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
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
            <p className="text-4xl font-black tracking-tight">₹{balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Earnings</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">+₹{(balance * 0.7).toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft size={16} className="text-amber-400" />
              <span className="text-white/60 text-xs font-medium uppercase tracking-wider">This Month</span>
            </div>
            <p className="text-xl font-bold text-amber-400">+₹{((balance * 0.3) / 3).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddMoney}
            className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Add Money
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleWithdraw}
            className="flex-1 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
          >
            <Banknote size={20} />
            Withdraw
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}