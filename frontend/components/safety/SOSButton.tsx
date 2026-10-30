"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Phone, MapPin, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "@/src/contexts/SocketContext";
import { triggerSOS, cancelSOS, updateSOSLocation } from "@/src/services/emergencyService";

interface SOSButtonProps {
  isActive: boolean;
  rideId: string;
  onSOSTriggered?: () => void;
}

export default function SOSButton({ isActive, rideId, onSOSTriggered }: SOSButtonProps) {
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [sosTriggered, setSOSTriggered] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const { socket } = useSocket();

  const getCurrentLocation = async (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error)
      );
    });
  };

  const handleTriggerSOS = useCallback(async () => {
    setIsCountingDown(false);
    setSOSTriggered(true);

    try {
      const location = await getCurrentLocation();
      
      // Send SOS alert to backend using authenticated service
      await triggerSOS(location, rideId);

      // Emit SOS event via Socket.IO
      if (socket) {
        socket.emit('sos_triggered', {
          rideId,
          timestamp: new Date().toISOString(),
          location,
        });
      }

      // Start live location sharing
      startLiveLocationSharing();

      // Show emergency alert
      toast.error('🚨 SOS ACTIVATED', {
        description: 'Emergency services have been notified. Stay calm.',
        duration: Infinity,
      });

      onSOSTriggered?.();
    } catch (error) {
      console.error('SOS trigger error:', error);
      toast.error('Failed to send SOS. Please try again.');
      setSOSTriggered(false);
    }
  }, [rideId, socket, onSOSTriggered]);

  // Countdown timer
  useEffect(() => {
    if (!isCountingDown) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTriggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountingDown, handleTriggerSOS]);

  const startLiveLocationSharing = () => {
    // Start sharing location every 5 seconds
    const locationInterval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();

        // Send to backend using authenticated service
        await updateSOSLocation(rideId, location);

        // Emit via Socket.IO
        if (socket) {
          socket.emit('emergency_location_update', {
            rideId,
            location,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Location sharing error:', error);
      }
    }, 5000);

    // Store interval ID for cleanup
    (window as any).sosLocationInterval = locationInterval;
  };

  const stopSOS = async () => {
    setSOSTriggered(false);
    setCountdown(5);

    // Stop location sharing
    if ((window as any).sosLocationInterval) {
      clearInterval((window as any).sosLocationInterval);
    }

    // Notify backend using authenticated service
    try {
      await cancelSOS(rideId);
      toast.success('SOS cancelled');
    } catch (error) {
      console.error('Cancel SOS error:', error);
      toast.error('Failed to cancel SOS');
    }
  };

  const cancelCountdown = () => {
    setIsCountingDown(false);
    setCountdown(5);
  };

  if (!isActive) return null;

  return (
    <AnimatePresence>
      {/* SOS Button */}
      {!sosTriggered && !isCountingDown && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => setIsCountingDown(true)}
          className="fixed bottom-8 right-8 z-40 w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-2xl shadow-red-500/50 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center justify-center"
          >
            <AlertTriangle size={32} />
          </motion.div>
        </motion.button>
      )}

      {/* Countdown Modal */}
      {isCountingDown && !sosTriggered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl"
          >
            <div className="text-center space-y-6">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto"
              >
                <AlertTriangle size={40} className="text-red-600" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">SOS Alert</h2>
                <p className="text-gray-500 font-medium">
                  Emergency services will be notified in
                </p>
              </div>

              {/* Countdown Display */}
              <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-6xl font-black text-red-600"
              >
                {countdown}
              </motion.div>

              <div className="space-y-3">
                <button
                  onClick={cancelCountdown}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <p className="text-xs text-gray-400 font-medium">
                  Release to cancel before SOS is sent
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Emergency Alert (After SOS Triggered) */}
      {sosTriggered && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl"
          >
            <div className="text-center space-y-6">
              {/* Pulsing Alert Icon */}
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center mx-auto border-4 border-red-500"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <AlertTriangle size={48} className="text-red-600" />
                </motion.div>
              </motion.div>

              <div>
                <h2 className="text-2xl font-black text-red-600 mb-2">🚨 SOS ACTIVATED</h2>
                <p className="text-gray-600 font-medium">
                  Emergency services have been notified. Your location is being shared in real-time.
                </p>
              </div>

              {/* Status Indicators */}
              <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-bold text-gray-700">Live location sharing active</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-bold text-gray-700">Emergency contacts notified</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-bold text-gray-700">Police dispatch alerted</span>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Emergency Contacts</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                    <Phone size={18} />
                    <span className="hidden sm:inline">Call Police</span>
                  </button>
                  <button className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors">
                    <Phone size={18} />
                    <span className="hidden sm:inline">Call Ambulance</span>
                  </button>
                </div>
              </div>

              {/* Cancel SOS */}
              <button
                onClick={stopSOS}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                Cancel SOS
              </button>

              <p className="text-xs text-gray-400 font-medium">
                Your location will continue to be shared until you cancel
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
