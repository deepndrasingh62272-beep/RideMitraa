'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoginForm } from '@/components/auth/LoginForm';
import { OTPForm } from '@/components/auth/OTPForm';
import { Car, Shield, Timer, MapPin, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'otp' | 'success'>('login');
  const [phone, setPhone] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleLoginSuccess = (enteredPhone: string, otp?: string) => {
    setPhone(enteredPhone);
    if (otp) {
      setDevOtp(otp);
    }
    setStep('otp');
  };

  const handleOTPSuccess = () => {
    setStep('success');
  };

  const features = [
    { icon: <Car className="w-5 h-5" />, text: 'Save fuel with car & bike pooling' },
    { icon: <Timer className="w-5 h-5" />, text: 'Travel smarter, split costs' },
    { icon: <Shield className="w-5 h-5" />, text: 'Verified users for safety' },
    { icon: <MapPin className="w-5 h-5" />, text: 'Real-time ride tracking' },
  ];

  return (
    <main className="w-screen h-screen flex overflow-hidden bg-white">
      {/* LEFT SIDE: IMAGE */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Image as Background - Full Fit */}
        <div className="absolute inset-0">
          <Image
            src="/loginpage.jpeg"
            alt="Ride-sharing illustration"
            fill
            sizes="50vw"
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* RIGHT SIDE: AUTH FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 bg-white overflow-hidden relative">
        {/* Decorative background elements - subtle */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-100/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-100/20 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          {/* Form Card */}
          <div className="rounded-[28px] shadow-lg p-7 sm:p-9 border border-gray-100 bg-white">
            <AnimatePresence mode="wait">
              {step === 'login' && (
                <LoginForm key="login" onSuccess={handleLoginSuccess} />
              )}
              
              {step === 'otp' && (
                <OTPForm
                  key="otp"
                  phone={phone}
                  devOtp={devOtp}
                  onBack={() => setStep('login')}
                  onSuccess={handleOTPSuccess}
                />
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome Back!</h2>
                  <p className="text-gray-500 mb-6 text-sm">You have successfully logged in. Redirecting to your dashboard...</p>
                  <div className="flex justify-center">
                    <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </main>
  );
}
