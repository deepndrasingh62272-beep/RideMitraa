'use client';

import React, { useState, useEffect } from 'react';
import { IndianRupee, MapPin, Calendar, Clock, Car, Bike, Info, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import rideService from '@/src/services/rideService';

interface Step5Props {
  data: any;
  updateData: (fields: any) => void;
}

export const Step5Pricing: React.FC<Step5Props> = ({ data, updateData }) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [farePerSeat, setFarePerSeat] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate fare when coordinates are available
  useEffect(() => {
    const calculateFare = async () => {
      if (!data.pickupCoords || !data.dropCoords) {
        setDistance(null);
        setFarePerSeat(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Pass fuel type and mileage to get more accurate fare calculation
        const fareEstimate = await rideService.estimateFare(
          data.pickupCoords[1], // lat
          data.pickupCoords[0], // lng
          data.dropCoords[1],   // lat
          data.dropCoords[0],   // lng
          data.vehicleType || 'car',
          data.fuelType || 'Petrol',
          data.mileage || undefined
        );

        console.log('Fare estimate in Step5:', fareEstimate);

        if (fareEstimate.success && fareEstimate.data) {
          const distanceKm = fareEstimate.data.distanceKm || 0;
          let farePerSeatFromAPI = fareEstimate.data.farePerSeat;

          // allEstimates is now a flat map: { CAR: 120, BIKE: 75, ... }
          if (!farePerSeatFromAPI || farePerSeatFromAPI === 0) {
            const vehicleKey = (data.vehicleType || 'SEDAN').toUpperCase();
            const est = fareEstimate.data.allEstimates?.[vehicleKey];
            // handle both flat number and legacy {fare:n} shape
            farePerSeatFromAPI = typeof est === 'number' ? est : est?.fare ?? 0;
          }

          setDistance(distanceKm);
          const roundedFare = Math.round(farePerSeatFromAPI || 0);
          setFarePerSeat(roundedFare);

          if (roundedFare > 0) {
            updateData({ farePerSeat: roundedFare, distance: distanceKm });
          } else {
            setError('Could not calculate fare - please check your locations');
          }
        } else {
          setError('Could not calculate fare');
        }
      } catch (err: any) {
        console.error('Error calculating fare:', err);
        setError('Could not calculate fare');
      } finally {
        setIsLoading(false);
      }
    };

    calculateFare();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.pickupCoords, data.dropCoords, data.vehicleType]);

  const totalCost = farePerSeat && data.seats ? farePerSeat * data.seats : 0;
  const displayDistance = distance || 0;
  const displayFarePerSeat = farePerSeat || 0;

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Ride Summary</h2>
        <p className="text-gray-500 font-medium">Review your ride details before publishing</p>
      </div>

      <div className="space-y-8">
        {/* Route Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-500/5 space-y-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-100/50 transition-colors" />
          
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center py-2">
              <div className="w-4 h-4 rounded-full border-4 border-blue-600 bg-white shadow-[0_0_10px_rgba(37,99,235,0.3)]" />
              <div className="w-0.5 h-16 bg-gradient-to-b from-blue-200 to-purple-200" />
              <div className="w-4 h-4 rounded-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.3)]" />
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Pickup</p>
                <p className="text-lg font-black text-gray-900 leading-tight">{data.pickup || 'Not set'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Destination</p>
                <p className="text-lg font-black text-gray-900 leading-tight">{data.drop || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50/50 p-5 rounded-3xl flex items-center gap-4 border border-gray-100/50 hover:bg-white hover:shadow-lg hover:shadow-blue-500/5 transition-all">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-md">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
              <p className="text-sm font-black text-gray-900">{data.date || 'TBD'}</p>
            </div>
          </div>
          <div className="bg-gray-50/50 p-5 rounded-3xl flex items-center gap-4 border border-gray-100/50 hover:bg-white hover:shadow-lg hover:shadow-purple-500/5 transition-all">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-md">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</p>
              <p className="text-sm font-black text-gray-900">{data.time || 'TBD'}</p>
            </div>
          </div>
          <div className="bg-gray-50/50 p-5 rounded-3xl flex items-center gap-4 border border-gray-100/50 hover:bg-white hover:shadow-lg hover:shadow-blue-500/5 transition-all">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-md">
              {data.vehicleType === 'car' ? <Car size={20} /> : <Bike size={20} />}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle</p>
              <p className="text-sm font-black text-gray-900 truncate max-w-[80px]">{data.vehicleName || 'Vehicle'}</p>
            </div>
          </div>
          <div className="bg-gray-50/50 p-5 rounded-3xl flex items-center gap-4 border border-gray-100/50 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md">
              <span className="font-black text-lg">{data.seats}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seats</p>
              <p className="text-sm font-black text-gray-900">{data.seats} seats</p>
            </div>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-10 rounded-[3rem] text-white shadow-2xl shadow-blue-500/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-1000">
            <IndianRupee size={160} />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
          
          <div className="relative z-10 text-center space-y-4">
            <p className="text-blue-100 text-xs font-black uppercase tracking-[0.3em]">Recommended Price Per Seat</p>
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader size={24} className="animate-spin" />
                <span className="text-lg font-black">Calculating...</span>
              </div>
            ) : error ? (
              <div className="text-red-200 text-sm font-bold py-4">{error}</div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-black opacity-60 mt-4">₹</span>
                  <motion.span 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-black tracking-tighter"
                  >
                    {displayFarePerSeat}
                  </motion.span>
                  <span className="text-lg font-black opacity-60 self-end mb-6">/ seat</span>
                </div>
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  <p className="text-blue-50 text-[10px] font-black uppercase tracking-widest">
                    Based on {displayDistance.toFixed(1)}km & {data.vehicleType}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
