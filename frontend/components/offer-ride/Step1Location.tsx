'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, ArrowDownUp, Loader } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { motion } from 'framer-motion';
import { geocodeAddress } from '@/src/services/mapService';
import rideService from '@/src/services/rideService';

interface Step1Props {
  data: any;
  updateData: (fields: any) => void;
}

export const Step1Location: React.FC<Step1Props> = ({ data, updateData }) => {
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  const [distance, setDistance] = useState<number | null>(data.distance || null);
  const [error, setError] = useState<string | null>(null);
  const updateDataRef = useRef(updateData);
  updateDataRef.current = updateData;

  // Calculate distance when both locations are entered
  useEffect(() => {
    const calculateDistance = async () => {
      if (!data.pickup || !data.drop) {
        setDistance(null);
        setError(null);
        return;
      }

      // Skip if we already have coordinates for these locations
      if (data.pickupCoords && data.dropCoords && data.distance) {
        setDistance(data.distance);
        return;
      }

      setIsLoadingDistance(true);
      setError(null);

      try {
        // Geocode both locations
        const [pickupResult, dropResult] = await Promise.all([
          geocodeAddress(data.pickup),
          geocodeAddress(data.drop),
        ]);

        console.log('Pickup result:', pickupResult);
        console.log('Drop result:', dropResult);

        if (!pickupResult?.data || !dropResult?.data) {
          setError('Could not find one or both locations');
          setIsLoadingDistance(false);
          return;
        }

        const pickupCoords: [number, number] = [pickupResult.data.lng, pickupResult.data.lat];
        const dropCoords: [number, number] = [dropResult.data.lng, dropResult.data.lat];

        console.log('Pickup coords:', pickupCoords);
        console.log('Drop coords:', dropCoords);

        // Get fare estimate to calculate distance
        const fareEstimate = await rideService.estimateFare(
          pickupCoords[1],
          pickupCoords[0],
          dropCoords[1],
          dropCoords[0],
          data.vehicleType || 'car'
        );

        console.log('Fare estimate response:', fareEstimate);

        if (fareEstimate.success && fareEstimate.data) {
          const distanceKm = fareEstimate.data.distanceKm || 0;
          
          console.log('Distance calculated:', distanceKm);
          
          if (distanceKm > 0) {
            setDistance(distanceKm);
            // Update coordinates and distance in form data
            updateDataRef.current({
              pickupCoords,
              dropCoords,
              distance: distanceKm,
            });
          } else {
            // Still save coordinates even if distance is 0
            updateDataRef.current({
              pickupCoords,
              dropCoords,
            });
            setError('Could not calculate distance');
          }
        } else {
          // Still save coordinates even if fare estimate fails
          updateDataRef.current({
            pickupCoords,
            dropCoords,
          });
          setError('Could not calculate distance');
        }
      } catch (err: any) {
        console.error('Error calculating distance:', err);
        setError('Could not calculate distance. Please check locations.');
      } finally {
        setIsLoadingDistance(false);
      }
    };

    const timer = setTimeout(calculateDistance, 1000); // Debounce
    return () => clearTimeout(timer);
  }, [data.pickup, data.drop, data.vehicleType, data.pickupCoords, data.dropCoords, data.distance]);

  const handleSwap = () => {
    updateData({
      pickup: data.drop,
      drop: data.pickup,
      pickupCoords: data.dropCoords,
      dropCoords: data.pickupCoords,
      distance: null,
    });
    setDistance(null);
  };

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Where are you going?</h2>
        <p className="text-gray-500 font-medium">Plan your route and share the journey</p>
      </div>

      <div className="relative space-y-6 pt-4">
        <div className="relative group">
          <Input
            label="Pickup Location"
            placeholder="Search pickup city or landmark"
            value={data.pickup}
            onChange={(e) => updateData({ pickup: e.target.value, pickupCoords: null, distance: null })}
            icon={<MapPin className="text-blue-600" />}
            className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
          />
        </div>

        <div className="absolute right-6 top-[108px] -translate-y-1/2 z-10">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSwap}
            className="w-12 h-12 bg-white shadow-xl shadow-blue-500/10 border border-gray-100 rounded-2xl flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all group"
            suppressHydrationWarning
          >
            <ArrowDownUp size={24} className="group-hover:scale-110 transition-transform" />
          </motion.button>
        </div>

        <div className="relative group">
          <Input
            label="Drop Location"
            placeholder="Search destination"
            value={data.drop}
            onChange={(e) => updateData({ drop: e.target.value, dropCoords: null, distance: null })}
            icon={<MapPin className="text-purple-600" />}
            className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
          />
        </div>
      </div>

      {/* Map Preview with Route Line */}
      <div className="h-60 w-full bg-gray-50 rounded-[2.5rem] relative overflow-hidden border border-gray-100 shadow-inner group">
        <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/80.4,28.6,10/800x400?access_token=pk.xxx')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-1000" />
        
        {/* Route Line UI */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-2/3 h-1">
            <div className="absolute inset-0 bg-gray-200 rounded-full" />
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: data.pickup && data.drop && distance ? '100%' : '0%' }}
              className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            />
            {/* Start Pin */}
            <div className="absolute left-0 -top-2 w-5 h-5 bg-white border-4 border-blue-600 rounded-full shadow-lg" />
            {/* End Pin */}
            <div className="absolute right-0 -top-2 w-5 h-5 bg-white border-4 border-purple-600 rounded-full shadow-lg" />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white shadow-xl flex items-center gap-3">
            {isLoadingDistance ? (
              <>
                <Loader size={14} className="text-blue-600 animate-spin" />
                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">
                  Calculating Distance...
                </span>
              </>
            ) : error ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs font-black text-red-700 uppercase tracking-widest">
                  {error}
                </span>
              </>
            ) : distance && distance > 0 ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse shadow-[0_0_10px_rgba(22,163,74,0.5)]" />
                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">
                  {distance.toFixed(1)} km • Route Ready
                </span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">
                  Enter Route Details
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
