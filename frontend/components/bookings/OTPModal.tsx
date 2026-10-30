"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { verifyBookingOTP } from "@/src/services/bookingService";

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  onVerified: () => void;
}

export default function OTPModal({ isOpen, onClose, bookingId, onVerified }: OTPModalProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    // Clear error when user starts typing again
    if (errorMsg) setErrorMsg(null);

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = async () => {
    // Ensure all 6 fields are filled (not just total length)
    const allFilled = otp.every(digit => digit !== "");
    if (!allFilled) {
      toast.error("Please enter complete 6-digit OTP");
      return;
    }

    const otpCode = otp.join("");
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const response = await verifyBookingOTP(bookingId, otpCode);
      if (response.success) {
        setVerified(true);
        toast.success("OTP verified successfully!");
        setTimeout(() => {
          onVerified();
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      // Display inline error and clear all fields
      setErrorMsg("Invalid OTP. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      // Focus first input after clearing
      setTimeout(() => {
        const firstInput = document.getElementById("otp-0");
        firstInput?.focus();
      }, 50);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setOtp(["", "", "", "", "", ""]);
    setVerified(false);
    setErrorMsg(null);
    onClose();
  };

  // Verify button is disabled when any individual field is empty
  const isVerifyDisabled = isVerifying || otp.some(digit => digit === "");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                    {verified ? (
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <Shield className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {verified ? "Verified!" : "Verify OTP"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {verified 
                        ? "You can now board the ride" 
                        : "Enter the 6-digit code from your driver"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {!verified ? (
                <>
                  {/* OTP Inputs */}
                  <div className="flex justify-center gap-2 mb-4">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className={`w-14 h-16 text-2xl font-bold text-center rounded-2xl border-2 transition-all outline-none ${
                          errorMsg
                            ? "bg-red-50 border-red-300 focus:border-red-500"
                            : "bg-gray-100 border-transparent focus:border-blue-500 focus:bg-white"
                        }`}
                        disabled={isVerifying}
                      />
                    ))}
                  </div>

                  {/* Inline error message */}
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 rounded-xl border border-red-100"
                    >
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm font-semibold text-red-600">{errorMsg}</p>
                    </motion.div>
                  )}

                  {/* Verify Button */}
                  <button
                    onClick={handleVerify}
                    disabled={isVerifyDisabled}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : (
                      "Verify OTP"
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <p className="text-emerald-600 font-bold text-lg">Verification Successful!</p>
                  <p className="text-gray-500 text-sm mt-2">You may now board the ride</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
