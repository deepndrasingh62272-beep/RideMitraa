'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, RefreshCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { authAPI } from '@/src/api/auth';
import { toast } from 'sonner';

interface OTPFormProps {
  phone: string;
  devOtp?: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

export const OTPForm: React.FC<OTPFormProps> = ({ phone, devOtp, onBack, onSuccess }) => {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAutoFill, setPendingAutoFill] = useState<string | null>(devOtp || null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-fill OTP when component mounts and devOtp is available
  useEffect(() => {
    if (pendingAutoFill && inputRefs.current[0]) {
      const digits = String(pendingAutoFill).replace(/\D/g, '').slice(0, 6);
      if (digits.length === 6) {
        setOtp(digits.split(''));
        setPendingAutoFill(null);
        console.log('[DEV] OTP auto-filled from backend');
        // Focus last box after fill
        setTimeout(() => {
          if (inputRefs.current[5]) inputRefs.current[5].focus();
        }, 80);
      }
    }
  }, [pendingAutoFill]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (error) setError('');
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, index) => {
      newOtp[index] = char;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleResend = async () => {
    if (!canResend) return;
    setIsLoading(true);
    try {
      const response = await authAPI.sendOTP(phone);
      toast.success('OTP resent successfully!');
      
      // Extract devOtp from backend response if available (dev mode)
      const devOtp = response.data?.data?.devOtp || response.data?.devOtp;
      if (devOtp) {
        console.log('[DEV] OTP resent from backend:', devOtp);
        // Auto-fill the OTP
        const digits = String(devOtp).replace(/\D/g, '').slice(0, 6);
        if (digits.length === 6) {
          setOtp(digits.split(''));
          setTimeout(() => {
            if (inputRefs.current[5]) inputRefs.current[5].focus();
          }, 80);
        }
      }
      
      setCanResend(false);
      setTimer(30);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyOTP(phone, fullOtp);
      const { token } = response.data;
      
      if (token) {
        localStorage.setItem('token', token);
        toast.success('Logged in successfully!');
        onSuccess();
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-md"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors mb-8 group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Change Phone Number</span>
      </button>

      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify OTP</h1>
        <p className="text-gray-500">
          OTP sent to <span className="text-gray-900 font-semibold">+91 {phone.slice(0, 5)} {phone.slice(5)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" suppressHydrationWarning>
        <div className="flex justify-between gap-2 sm:gap-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { if (el) inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={cn(
                'w-full h-14 sm:h-16 text-2xl font-bold text-center rounded-xl border-2 transition-all duration-300 outline-none',
                'bg-white/50 backdrop-blur-sm',
                digit ? 'border-orange-500 bg-orange-50/30' : 'border-gray-200 focus:border-orange-300',
                error ? 'border-red-500' : ''
              )}
              suppressHydrationWarning
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-medium text-red-500"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="text-center">
          {timer > 0 ? (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <RefreshCcw className="w-4 h-4 animate-spin-slow" />
              Resend OTP in <span className="text-orange-600 font-bold">{timer}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors underline decoration-2 underline-offset-4"
              suppressHydrationWarning
            >
              Resend OTP
            </button>
          )}
        </div>

        <Button
          type="submit"
          className="w-full group"
          isLoading={isLoading}
        >
          Verify & Continue
          {!isLoading && <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />}
        </Button>
      </form>
    </motion.div>
  );
};
