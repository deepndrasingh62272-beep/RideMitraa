'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { safetyAPI } from '@/src/api/safety';

export const SOSButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCounting && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            triggerSOS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCounting, countdown]);

  const triggerSOS = async () => {
    setIsCounting(false);
    setIsTriggered(true);
    setIsOpen(false);

    try {
      await safetyAPI.triggerSOS('');
      toast.error('Emergency alert triggered!', {
        description: 'The authorities and your emergency contacts have been notified.',
        duration: 10000,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send SOS alert');
    }

    setTimeout(() => setIsTriggered(false), 5000);
  };

  const startCountdown = () => {
    setCountdown(5);
    setIsCounting(true);
  };

  const cancelSOS = () => {
    setIsCounting(false);
    setIsOpen(false);
    toast.info('SOS alert cancelled');
  };

  return (
    <>
      {isHydrated && (
        <div className="fixed bottom-8 right-8 z-40">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setIsOpen(true);
              setIsCounting(false);
              setCountdown(5);
            }}
            className="relative w-16 h-16 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center overflow-hidden group"
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-red-400 rounded-full"
            />
            <AlertTriangle size={28} className="relative z-10" />
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelSOS}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 text-center border border-red-100 dark:border-red-900/30"
            >
              {isCounting ? (
                <>
                  <div className="relative mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-24 h-24 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center"
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

                  <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                    Sending emergency alert in {countdown} seconds...
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Your live location will be shared with trusted contacts
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={triggerSOS}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      <ShieldAlert size={20} />
                      Send Now
                    </button>
                    <button
                      onClick={cancelSOS}
                      className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-12 h-12 text-red-600" />
                  </div>

                  <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4 italic uppercase tracking-tighter">
                    Emergency SOS
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">
                    Clicking "Start Alert" will start a 5-second countdown. If not cancelled, it will notify local authorities and your emergency contacts with your current location.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={startCountdown}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-xl shadow-red-500/40 flex items-center justify-center gap-2"
                    >
                      <ShieldAlert size={20} />
                      Start Alert
                    </button>
                    <button
                      onClick={cancelSOS}
                      className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={cancelSOS}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isTriggered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none border-[12px] border-red-600"
          style={{ animation: 'pulse 1s infinite' }}
        />
      )}
    </>
  );
};
