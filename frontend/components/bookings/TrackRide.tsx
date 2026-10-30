"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation, Phone, MessageSquare, Clock,
  Car, AlertTriangle,
  ChevronLeft, Share2, MoreVertical, WifiOff
} from "lucide-react";
import { useSocket } from "@/src/contexts/SocketContext";

// Leaflet is browser-only — loaded dynamically to avoid SSR crash
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(
  () => import('./LeafletMap'),
  { ssr: false, loading: () => null }
);

interface LocationInfo {
  name: string;
  coordinates?: [number, number];
  isApproximate?: boolean;
  locationPrivacy?: string;
}

interface RideInfo {
  id: string;
  driver: {
    name: string;
    avatar: string;
    phone: string;
    rating: number;
    vehicle: {
      model: string;
      number: string;
      color: string;
    };
  };
  pickup: string | LocationInfo;
  drop: string | LocationInfo;
  time: string;
  date: string;
  price: number;
  otp?: string;
}

interface TrackRideProps {
  ride: RideInfo;
  status: "accepted" | "on_the_way" | "arrived" | "in_progress" | "completed";
  isVisible: boolean;
  onClose: () => void;
  onSOS?: () => void;
  showSOS?: boolean;
  /** Pass true when the current user is the driver of this ride */
  isDriver?: boolean;
}

const statusConfig = {
  accepted: { label: "Driver Accepted", color: "bg-blue-50 text-blue-600 border-blue-100", step: 1 },
  on_the_way: { label: "Driver En Route", color: "bg-indigo-50 text-indigo-600 border-indigo-100", step: 2 },
  arrived: { label: "Driver Arrived", color: "bg-purple-50 text-purple-600 border-purple-100", step: 3 },
  in_progress: { label: "Ride In Progress", color: "bg-emerald-50 text-emerald-600 border-emerald-100", step: 4 },
  completed: { label: "Ride Completed", color: "bg-emerald-50 text-emerald-600 border-emerald-100", step: 5 },
};

// Statuses considered "ongoing" for the live badge logic
const ONGOING_STATUSES = ["on_the_way", "arrived", "in_progress"];

export default function TrackRide({
  ride,
  status,
  isVisible,
  onClose,
  onSOS,
  showSOS = true,
  isDriver = false,
}: TrackRideProps) {
  const [liveETA, setLiveETA] = useState(8);

  // ── SSR guard: prevent hydration errors with react-leaflet ──────────────────
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // ── Socket & location state ──────────────────────────────────────────────────
  const { socket } = useSocket();
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Refs for intervals so we can clear them on unmount
  const liveCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationEmitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use status prop directly (no need to mirror into state)
  const currentStatus = status;

  useEffect(() => {
    if (currentStatus === "on_the_way" || currentStatus === "arrived") {
      const interval = setInterval(() => {
        setLiveETA((prev) => Math.max(1, prev - 1));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [currentStatus]);

  // ── Subscribe to LOCATION_UPDATE events ─────────────────────────────────────
  useEffect(() => {
    if (!socket || !isVisible) return;

    const handleLocationUpdate = (data: { rideId: string; lat: number; lng: number; timestamp: string }) => {
      // Only process updates for this ride
      if (data.rideId !== ride.id) return;
      setDriverLocation({ lat: data.lat, lng: data.lng });
      setLastUpdateAt(new Date());
    };

    socket.on("LOCATION_UPDATE", handleLocationUpdate);
    // Also listen for the relay event name used by the backend
    socket.on("location:update", handleLocationUpdate);

    return () => {
      socket.off("LOCATION_UPDATE", handleLocationUpdate);
      socket.off("location:update", handleLocationUpdate);
    };
  }, [socket, isVisible, ride.id]);

  // ── isLive: re-evaluate every second ────────────────────────────────────────
  useEffect(() => {
    liveCheckIntervalRef.current = setInterval(() => {
      if (!lastUpdateAt) {
        setIsLive(false);
        return;
      }
      const secondsSinceUpdate = (Date.now() - lastUpdateAt.getTime()) / 1000;
      setIsLive(secondsSinceUpdate <= 10);
    }, 1000);

    return () => {
      if (liveCheckIntervalRef.current) clearInterval(liveCheckIntervalRef.current);
    };
  }, [lastUpdateAt]);

  // ── Driver: emit LOCATION_UPDATE every 4 seconds ────────────────────────────
  useEffect(() => {
    if (!isDriver || !isVisible || !socket) return;

    const emitLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const payload = {
            rideId: ride.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString(),
          };
          socket.emit("LOCATION_UPDATE", payload);
        },
        (err) => {
          console.warn("[TrackRide] Geolocation error:", err.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    // Emit immediately, then every 4 seconds
    emitLocation();
    locationEmitIntervalRef.current = setInterval(emitLocation, 4000);

    return () => {
      if (locationEmitIntervalRef.current) clearInterval(locationEmitIntervalRef.current);
    };
  }, [isDriver, isVisible, socket, ride.id]);

  // Clear location emit interval when modal closes
  useEffect(() => {
    if (!isVisible && locationEmitIntervalRef.current) {
      clearInterval(locationEmitIntervalRef.current);
      locationEmitIntervalRef.current = null;
    }
  }, [isVisible]);

  const config = statusConfig[currentStatus] ?? statusConfig['in_progress'];
  const isRideOngoing = ONGOING_STATUSES.includes(currentStatus);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed inset-0 z-40 bg-white flex flex-col"
        >
          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent z-10 pointer-events-none" />
            
            <div className="absolute top-0 left-0 right-0 z-20 p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-2">
                  {/* Live / Reconnecting badge */}
                  {isRideOngoing && (
                    isLive ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 rounded-full shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                        <span className="text-white text-xs font-bold">Live</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-400 rounded-full shadow-lg">
                        <WifiOff size={12} className="text-white" />
                        <span className="text-white text-xs font-bold">Reconnecting…</span>
                      </div>
                    )
                  )}
                  <button className="w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
                    <Share2 size={20} />
                  </button>
                  <button className="w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 bg-gray-100">
              {isMounted && driverLocation ? (
                <LeafletMap
                  lat={driverLocation.lat}
                  lng={driverLocation.lng}
                  driverName={ride.driver.name}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Navigation size={32} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-semibold">Waiting for driver location...</p>
                    <p className="text-xs text-gray-400 mt-1">Map will appear when driver shares location</p>
                  </div>
                </div>
              )}
            </div>

            {currentStatus === "on_the_way" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20"
              >
                <div className="bg-white rounded-3xl shadow-2xl p-6 text-center min-w-[200px]">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Car size={32} className="text-blue-600" />
                  </div>
                  <p className="text-3xl font-black text-gray-900">{liveETA}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">mins away</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="bg-white rounded-t-[2.5rem] shadow-2xl border-t border-gray-100 p-6 space-y-6 relative z-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-12 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between">
              <div className={`px-4 py-2 rounded-full border text-xs font-black uppercase tracking-widest ${config.color}`}>
                {config.label}
              </div>
              {ride.otp && (
                <div className="px-4 py-2 bg-gray-900 rounded-xl">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">OTP</p>
                  <p className="text-lg font-black text-white tracking-widest">{ride.otp}</p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-4">
              <div className="relative">
                {ride.driver.avatar && ride.driver.avatar.trim() !== '' ? (
                  <img
                    src={ride.driver.avatar}
                    alt={ride.driver.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-100"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 border-2 border-blue-200 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">
                      {ride.driver.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                  <Car size={12} className="text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{ride.driver.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-amber-500 font-bold">★ {ride.driver.rating}</span>
                  <span>•</span>
                  <span>{ride.driver.vehicle.model}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {ride.driver.vehicle.color} • {ride.driver.vehicle.number}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
                  <MessageSquare size={20} />
                </button>
                <button className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors">
                  <Phone size={20} />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div className="w-0.5 h-8 bg-gray-200" />
                <div className="w-3 h-3 rounded-full bg-purple-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Pickup</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {typeof ride.pickup === 'string' ? ride.pickup : ride.pickup?.name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Drop</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {typeof ride.drop === 'string' ? ride.drop : ride.drop?.name || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl text-center">
                <Clock size={20} className="text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Pickup Time</p>
                <p className="text-sm font-bold text-gray-900">{ride.time}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl text-center">
                <Navigation size={20} className="text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Fare</p>
                <p className="text-sm font-bold text-gray-900">₹{ride.price}</p>
              </div>
            </div>

            {showSOS && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center mb-3">
                  Your live location will be shared with trusted contacts
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSOS}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-3"
                >
                  <AlertTriangle size={20} />
                  SOS - Emergency Help
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
