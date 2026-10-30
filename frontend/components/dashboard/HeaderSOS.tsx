"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface HeaderSOSProps {
  isActive?: boolean;
}

export default function HeaderSOS({ isActive = false }: HeaderSOSProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCounting && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleTrigger();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCounting, countdown]);

  useEffect(() => {
    if (isActive) {
      setShowBadge(true);
      const timeout = setTimeout(() => setShowBadge(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [isActive]);

  const handleSOSClick = () => {
    setIsOpen(true);
    setIsCounting(true);
    setCountdown(5);
  };

  const handleCancel = () => {
    setIsCounting(false);
    setIsOpen(false);
    setCountdown(5);
    toast.info("SOS alert cancelled");
  };

  const handleTrigger = () => {
    setIsCounting(false);
    setIsOpen(false);
    toast.error("Emergency alert triggered!", {
      description: "Your location is being shared with emergency contacts and authorities.",
      duration: 10000,
    });
  };

  if (!isHydrated) return null;

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: isActive ? 1 : 0 }}
        onClick={handleSOSClick}
        className="relative p-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
        suppressHydrationWarning
      >
        <AlertTriangle size={22} />
        {showBadge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full"
          />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center"
            >
              {isCounting ? (
                <>
                  <div className="relative mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center"
                    >
                      <motion.p
                        key={countdown}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-black text-red-600"
                      >
                        {countdown}
                      </motion.p>
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 border-4 border-red-200 rounded-full"
                    />
                  </div>

                  <h2 className="text-xl font-black text-gray-900 mb-2">
                    Sending emergency alert in {countdown} seconds...
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    Your live location will be shared with trusted contacts
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleTrigger}
                      className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      <ShieldAlert size={20} />
                      Send Now
                    </button>
                    <button
                      onClick={handleCancel}
                      className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={40} className="text-red-600" />
                  </div>

                  <h2 className="text-2xl font-black text-gray-900 mb-4">
                    Emergency SOS
                  </h2>
                  <p className="text-gray-500 mb-6 leading-relaxed">
                    Trigger emergency alert to notify authorities and your emergency contacts with your current location.
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleTrigger}
                      className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      <ShieldAlert size={20} />
                      Trigger Alert
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}