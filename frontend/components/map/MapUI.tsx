'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpDown, 
  MapPin, 
  Navigation, 
  Search, 
  ChevronRight, 
  Clock, 
  Route, 
  X,
  Sparkles,
  Car
} from 'lucide-react';
import { useMap } from '@/src/contexts/MapContext';
import { LocationInput } from './LocationInput';
import { Button } from '@/components/ui/Button';

// Dynamically import LeafletMap with no SSR
const LeafletMap = dynamic(() => import('./LeafletMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-rm-blue/20 border-t-rm-blue rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Initializing Map...</p>
      </div>
    </div>
  )
});

export const MapUI = () => {
  const { 
    pickup, 
    drop, 
    route, 
    isLoading, 
    setPickup, 
    setDrop, 
    fetchRoute, 
    swapLocations, 
    clearMap 
  } = useMap();

  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');

  useEffect(() => {
    if (pickup) setPickupText(pickup.address);
    if (drop) setDropText(drop.address);
  }, [pickup, drop]);

  useEffect(() => {
    if (pickup && drop) {
      fetchRoute();
    }
  }, [pickup, drop, fetchRoute]);

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <LeafletMap pickup={pickup} drop={drop} route={route} />
      </div>

      {/* Floating Search Card (Top on mobile, Left on desktop) */}
      <div className="relative z-10 p-4 md:p-8 md:w-[400px] pointer-events-none">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card rounded-[2.5rem] p-6 shadow-2xl border border-white/50 pointer-events-auto backdrop-blur-xl bg-white/80"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rm-blue to-rm-green flex items-center justify-center shadow-lg shadow-rm-blue/20">
              <Car className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Plan Your Trip</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fast, Safe & Reliable</p>
            </div>
          </div>

          <div className="space-y-4 relative">
            <LocationInput
              label="Pickup Location"
              placeholder="Where from?"
              value={pickupText}
              onChange={setPickupText}
              onSelect={(suggestion) => {
                setPickup(suggestion);
                setPickupText(suggestion.address);
              }}
              isPickup
              icon={<div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />}
            />

            <div className="absolute left-6 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20">
              <button 
                onClick={swapLocations}
                className="w-10 h-10 rounded-full bg-white shadow-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rm-blue hover:scale-110 active:scale-95 transition-all"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>

            <LocationInput
              label="Drop Location"
              placeholder="Where to?"
              value={dropText}
              onChange={setDropText}
              onSelect={(suggestion) => {
                setDrop(suggestion);
                setDropText(suggestion.address);
              }}
              icon={<div className="w-2 h-2 rounded-full bg-purple-500 ring-4 ring-purple-500/20" />}
            />
          </div>

          {/* Route Info Overlay */}
          <AnimatePresence>
            {route && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-slate-100"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Route size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Distance</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      {route.distance.toFixed(1)} <span className="text-xs text-slate-400">KM</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                      <Clock size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Est. Time</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      {route.duration} <span className="text-xs text-slate-400">MIN</span>
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full mt-6 h-14 bg-gradient-to-r from-rm-blue to-blue-700 shadow-xl shadow-blue-500/20 rounded-2xl font-black uppercase tracking-widest text-xs"
                >
                  Confirm Route
                  <ChevronRight size={18} className="ml-2" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Mobile Sticky Bottom Card (Uber Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 p-4 pointer-events-none">
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white rounded-t-[2.5rem] rounded-b-[2rem] p-6 shadow-2xl pointer-events-auto"
        >
          <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />
          
          {!pickup || !drop ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mx-auto mb-4">
                <Search size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Set Your Route</h3>
              <p className="text-xs text-slate-400 font-medium">Please select both pickup and drop locations</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Route Details</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      {route?.distance.toFixed(1)} <span className="text-xs text-slate-400 font-bold">KM</span>
                    </p>
                    <span className="text-slate-200 text-lg">•</span>
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      {route?.duration} <span className="text-xs text-slate-400 font-bold">MIN</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Sparkles size={20} />
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-14 bg-gradient-to-r from-rm-blue to-blue-700 shadow-xl shadow-blue-500/20 rounded-2xl font-black uppercase tracking-widest text-xs"
              >
                Find Drivers Now
                <ChevronRight size={18} className="ml-2" />
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Controls Overlay */}
      <div className="fixed top-8 right-8 z-20 flex flex-col gap-4">
        <button 
          onClick={clearMap}
          className="w-12 h-12 rounded-2xl bg-white shadow-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 active:scale-95 transition-all"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
