"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, MapPin, Clock, Users, Car, Bike, ChevronRight } from "lucide-react";
import { Ride } from "@/types/ride";
import { getAvatarDataUri } from '@/src/utils/avatar';

interface RideCardProps {
  ride: Ride;
  onViewDetails: (ride: Ride) => void;
  onBookNow: (ride: Ride) => void;
}

export default function RideCard({ ride, onViewDetails, onBookNow }: RideCardProps) {
  const driverName = ride.driver?.name || 'Driver';
  const driverAvatar = ride.driver?.avatar || getAvatarDataUri(driverName);
  const driverRating = ride.driver?.rating || 4.5;
  const pickupText = typeof ride.pickup === 'string' ? ride.pickup : (ride.pickup as any)?.name || 'Unknown';
  const dropText = typeof ride.drop === 'string' ? ride.drop : (ride.drop as any)?.name || 'Unknown';
  const vehicleType = (ride.vehicleType || 'car').toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, boxShadow: "0 20px 40px rgba(0,0,0,0.08)" }}
      className="group relative bg-white border border-gray-100 rounded-[2rem] overflow-hidden transition-all duration-500 shadow-sm hover:shadow-xl"
    >
      {/* Background Highlight */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="p-6">
        {/* Driver Info Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={driverAvatar}
                alt={driverName}
                className="w-12 h-12 rounded-2xl object-cover border border-gray-100"
              />
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold">{driverName}</h3>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs font-bold">{driverRating}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-black text-gray-900">₹{ride.price || 0}</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">per seat</span>
          </div>
        </div>

        {/* Route Section */}
        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-0.5 h-8 bg-gray-100" />
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">Pickup</span>
                <p className="text-sm text-gray-700 font-semibold line-clamp-1">{pickupText}</p>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">Dropoff</span>
                <p className="text-sm text-gray-700 font-semibold line-clamp-1">{dropText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex items-center justify-between py-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold">{ride.date || 'Today'} • {ride.time || '--:--'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold">{ride.seats ?? 0} left</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              {vehicleType === "bike" ? (
                <Bike className="w-4 h-4 text-purple-500" />
              ) : (
                <Car className="w-4 h-4 text-purple-500" />
              )}
              <span className="text-xs font-bold capitalize">{vehicleType}</span>
            </div>
            {ride.vehicle?.model && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-xs font-bold text-gray-400">{ride.vehicle.model}</span>
              </div>
            )}
            {ride.distanceKm ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold">{ride.distanceKm.toFixed(1)} km</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => onViewDetails(ride)}
            className="px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold transition-colors border border-gray-100"
          >
            Details
          </button>
          <button
            onClick={() => onBookNow(ride)}
            disabled={(ride.seats ?? ride.availableSeats ?? 0) === 0}
            className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg ${
              (ride.seats ?? ride.availableSeats ?? 0) === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
            }`}
          >
            {(ride.seats ?? ride.availableSeats ?? 0) === 0 ? 'Full' : 'Request'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
