'use client';

import React from 'react';
import { Users, Info, Plus, Minus, Car } from 'lucide-react';
import { motion } from 'framer-motion';

interface Step4Props {
  data: any;
  updateData: (fields: any) => void;
}

export const Step4Seats: React.FC<Step4Props> = ({ data, updateData }) => {
  // Correct total seats based on vehicle type
  const totalSeats = data.vehicleType === 'bike' ? 2 : 5;
  const maxOffer = totalSeats - 1; // Reserve 1 seat for driver

  // Initialize seats if not set or if vehicle type changed
  React.useEffect(() => {
    if (!data.seats || data.seats > maxOffer) {
      updateData({ seats: Math.min(data.seats || 1, maxOffer) });
    }
  }, [data.vehicleType, maxOffer, data.seats, updateData]);

  const handleAdjust = (val: number) => {
    const newSeats = Math.max(1, Math.min(maxOffer, data.seats + val));
    updateData({ seats: newSeats });
  };

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Seat Selection</h2>
        <p className="text-gray-500 font-medium">Configure your ride capacity and offerings</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* SECTION 1: TOTAL SEATS (READ ONLY) */}
        <div className="bg-gray-50 border border-gray-100 rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                <Car size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Seats</p>
                <p className="text-sm font-bold text-gray-700">(Vehicle Capacity)</p>
              </div>
            </div>
            <div className="text-2xl font-black text-gray-400">
              {totalSeats} <span className="text-xs uppercase tracking-tighter">Seats</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-xl border border-gray-100">
            <Info size={14} className="text-blue-500" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Includes driver seat</p>
          </div>
        </div>

        {/* SECTION 2: SEATS YOU OFFER (USER INPUT) */}
        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-xl shadow-blue-500/5 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <Users size={20} />
                </div>
                <p className="text-sm font-black text-gray-900 uppercase tracking-wider">Seats You Offer</p>
              </div>
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAdjust(-1)}
                  disabled={data.seats <= 1}
                  className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 shadow-sm transition-all"
                >
                  <Minus size={18} />
                </motion.button>
                <div className="w-16 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-600 border border-blue-100">
                  {data.seats}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAdjust(1)}
                  disabled={data.seats >= maxOffer}
                  className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 shadow-sm transition-all"
                >
                  <Plus size={18} />
                </motion.button>
              </div>
            </div>

            {/* Slider */}
            <div className="relative h-10 flex items-center px-2">
              <div className="absolute inset-x-2 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                 <motion.div 
                   initial={false}
                   animate={{ width: `${(data.seats / maxOffer) * 100}%` }}
                   className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                 />
              </div>
              <input
                type="range"
                min="1"
                max={maxOffer}
                step="1"
                value={data.seats}
                onChange={(e) => updateData({ seats: parseInt(e.target.value) })}
                className="absolute inset-x-0 w-full h-2 opacity-0 cursor-pointer z-20"
              />
              <motion.div
                initial={false}
                animate={{ left: `calc(${(data.seats / maxOffer) * 100}% - 12px)` }}
                className="absolute w-6 h-6 bg-white border-4 border-blue-600 rounded-full shadow-lg pointer-events-none z-10"
              />
            </div>
          </div>

          {/* Validation/Info Box */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-3xl border border-blue-100/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                  <Info size={16} />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dynamic Summary</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-700">
                  🏠 Keeping <span className="text-blue-600 font-black">{totalSeats - data.seats}</span> seat for yourself
                </p>
                <p className="text-sm font-bold text-gray-700">
                  👥 Offering <span className="text-blue-600 font-black">{data.seats}</span> seat{data.seats > 1 ? 's' : ''} to passengers
                </p>
              </div>
            </div>

            {/* Cost Hint */}
            <div className="flex items-start gap-3 px-4">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 animate-pulse" />
              <p className="text-xs font-bold text-amber-600">
                {data.seats < maxOffer 
                  ? "Offer more seats to reduce your travel cost" 
                  : "You're offering max capacity to save maximum cost!"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
