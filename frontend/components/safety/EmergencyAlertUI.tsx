"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Phone,
  MapPin,
  X,
  CheckCircle,
  Clock,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface EmergencyAlertUIProps {
  isVisible: boolean;
  sosStatus: "ACTIVE" | "CANCELLED" | "RESOLVED";
  locationSharingActive: boolean;
  emergencyContactsNotified: number;
  policeAlerted: boolean;
  ambulanceAlerted: boolean;
  onCancel?: () => void;
  onCallPolice?: () => void;
  onCallAmbulance?: () => void;
}

export default function EmergencyAlertUI({
  isVisible,
  sosStatus,
  locationSharingActive,
  emergencyContactsNotified,
  policeAlerted,
  ambulanceAlerted,
  onCancel,
  onCallPolice,
  onCallAmbulance,
}: EmergencyAlertUIProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isVisible || sosStatus !== "ACTIVE") return;

    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, sosStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
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
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl overflow-hidden"
          >
            {/* Header with Status */}
            <div className="text-center space-y-4 mb-8">
              {/* Pulsing Alert Icon */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
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

              {/* Time Elapsed */}
              {sosStatus === "ACTIVE" && (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500"
                >
                  <Clock className="w-4 h-4" />
                  SOS Active for {formatTime(timeElapsed)}
                </motion.div>
              )}
            </div>

            {/* Status Indicators */}
            <div className="space-y-3 bg-gray-50 rounded-2xl p-4 mb-6">
              {/* Location Sharing */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-green-500"
                />
                <span className="text-sm font-bold text-gray-700">
                  {locationSharingActive ? "✓ Live location sharing active" : "Location sharing paused"}
                </span>
              </motion.div>

              {/* Emergency Contacts */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-3 h-3 rounded-full bg-green-500"
                />
                <span className="text-sm font-bold text-gray-700">
                  {emergencyContactsNotified > 0
                    ? `✓ ${emergencyContactsNotified} emergency contact(s) notified`
                    : "No emergency contacts configured"}
                </span>
              </motion.div>

              {/* Police Alert */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3"
              >
                <motion.div
                  animate={{ scale: policeAlerted ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 1.5, repeat: policeAlerted ? Infinity : 0, delay: 0.3 }}
                  className={`w-3 h-3 rounded-full ${policeAlerted ? "bg-green-500" : "bg-gray-300"}`}
                />
                <span className={`text-sm font-bold ${policeAlerted ? "text-gray-700" : "text-gray-400"}`}>
                  {policeAlerted ? "✓ Police dispatch alerted" : "Police dispatch pending"}
                </span>
              </motion.div>

              {/* Ambulance Alert */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3"
              >
                <motion.div
                  animate={{ scale: ambulanceAlerted ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 1.5, repeat: ambulanceAlerted ? Infinity : 0, delay: 0.4 }}
                  className={`w-3 h-3 rounded-full ${ambulanceAlerted ? "bg-green-500" : "bg-gray-300"}`}
                />
                <span className={`text-sm font-bold ${ambulanceAlerted ? "text-gray-700" : "text-gray-400"}`}>
                  {ambulanceAlerted ? "✓ Ambulance dispatch alerted" : "Ambulance dispatch pending"}
                </span>
              </motion.div>
            </div>

            {/* Emergency Contacts */}
            <div className="space-y-3 mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Emergency Services</p>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCallPolice}
                  className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Phone size={18} />
                  <span className="hidden sm:inline">Police</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCallAmbulance}
                  className="py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
                >
                  <Phone size={18} />
                  <span className="hidden sm:inline">Ambulance</span>
                </motion.button>
              </div>
            </div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-6"
            >
              <p className="text-xs text-blue-700 leading-relaxed font-medium flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Your location will continue to be shared with emergency services until you cancel the SOS alert.
                </span>
              </p>
            </motion.div>

            {/* Cancel Button */}
            {sosStatus === "ACTIVE" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                Cancel SOS
              </motion.button>
            )}

            {/* Resolved Status */}
            {sosStatus === "RESOLVED" && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center space-y-3"
              >
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">SOS Resolved</h3>
                  <p className="text-sm text-gray-500">Emergency services have been notified of resolution.</p>
                </div>
              </motion.div>
            )}

            {/* Cancelled Status */}
            {sosStatus === "CANCELLED" && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center space-y-3"
              >
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">SOS Cancelled</h3>
                  <p className="text-sm text-gray-500">Location sharing has been stopped.</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
