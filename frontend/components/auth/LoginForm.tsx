'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowRight, Car } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authAPI } from '@/src/api/auth';

interface LoginFormProps {
  onSuccess: (phone: string, otp?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.sendOTP(phone);
      toast.success('OTP sent successfully!');
      
      // Extract devOtp from backend response if available (dev mode)
      const devOtp = response.data?.data?.devOtp || response.data?.devOtp;
      if (devOtp) {
        console.log('[DEV] OTP received from backend:', devOtp);
      }
      
      onSuccess(phone, devOtp);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full text-center">
      {/* Logo Section */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.2rem] bg-gradient-to-br from-rm-blue to-rm-green shadow-lg mb-3">
          <Car size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">
            <span className="text-rm-blue">ride</span>
            <span className="text-rm-green">mitra</span>
          </h1>
          <p className="text-slate-500 font-bold mt-0.5 uppercase tracking-widest text-xs">
            Your Ride Partner
          </p>
        </div>
      </motion.div>

      {/* Welcome Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-5"
      >
        <h2 className="text-xl font-black text-gray-900">Welcome Back</h2>
        <p className="text-sm text-gray-500 font-medium">Sign in to your account</p>
      </motion.div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-slate-800"
      >
        <form onSubmit={handleLogin} className="space-y-3" suppressHydrationWarning>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">
              Phone Number
            </label>
            <div className="relative group">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rm-blue transition-colors" size={20} />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter 10-digit number"
                className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-rm-blue/20 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none font-medium text-sm"
                suppressHydrationWarning
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-rm-blue to-blue-700 text-white rounded-2xl font-black uppercase italic tracking-wider shadow-xl hover:shadow-rm-blue/40 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
            suppressHydrationWarning
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Send OTP
                <ArrowRight size={20} />
              </>
            )}
          </button>

          {/* Why RideMitra Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 pt-3 border-t border-gray-200"
          >
            <h3 className="text-sm font-black text-gray-900 mb-2 text-center">
              Why RideMitra?
            </h3>
            
            <div className="space-y-1.5">
              {[
                { icon: '🚗', text: 'Save fuel with car & bike pooling' },
                { icon: '💰', text: 'Travel smarter, split costs' },
                { icon: '🛡️', text: 'Verified users for safety' },
                { icon: '📍', text: 'Real-time ride tracking' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all"
                >
                  <div className="text-base">{item.icon}</div>
                  <p className="text-xs font-medium text-gray-700">
                    {item.text}
                  </p>
                </motion.div>
              ))}
            </div>

            <p className="text-xs text-gray-500 text-center mt-2 font-medium">
              By continuing, you agree to <span className="text-rm-blue font-bold cursor-pointer hover:underline">Terms & Privacy</span>
            </p>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};
