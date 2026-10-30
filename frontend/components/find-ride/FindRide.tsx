"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Calendar, Search, ArrowUpDown, 
  Car, Bike, SlidersHorizontal, ChevronRight,
  User, Shield, Sparkles, AlertCircle, RefreshCw
} from "lucide-react";
import FiltersBar from "./FiltersBar";
import RideCard from "./RideCard";
import RideDetailsModal from "./RideDetailsModal";
import rideService from "@/src/services/rideService";
import { toast } from "sonner";
import { getAvatarDataUri } from "@/src/utils/avatar";
import { Ride } from "@/types/ride";
import { filterActiveRides } from "@/src/utils/rideFilters";

/**
 * Transform raw ride data from the backend API into the shape expected by RideCard.
 * Backend returns: { _id, pickup: { name, coordinates }, dropoff: { name, coordinates },
 *   driverId: { name, rating, totalRatings }, farePerSeat, availableSeats, schedule: { time, date },
 *   vehicleType, vehicle: { type, name } }
 */
const transformRide = (ride: any) => {
  const driverData = ride.driverId || ride.driver || {};
  
  // Extract coordinates from GeoJSON format [lng, lat]
  const pickupCoords = ride.pickup?.coordinates?.coordinates;
  const dropCoords = ride.dropoff?.coordinates?.coordinates;
  
  return {
    ...ride,
    id: ride.id || ride._id,
    driver: {
      name: typeof driverData === 'object' ? (driverData.name || 'Driver') : 'Driver',
      avatar: typeof driverData === 'object' ? (driverData.avatar || getAvatarDataUri(driverData.name || 'D')) : getAvatarDataUri('D'),
      rating: typeof driverData === 'object' ? (driverData.rating || 4.5) : 4.5,
      isVerified: typeof driverData === 'object' ? (driverData.kycStatus === 'verified' || driverData.isVerified) : false,
    },
    pickup: ride.pickup?.name || ride.pickupText || 'Unknown',
    drop: ride.dropoff?.name || ride.dropoffText || 'Unknown',
    // Store coordinates for booking (swap lng/lat to lat/lng for map compatibility)
    pickupCoordinates: pickupCoords ? [pickupCoords[1], pickupCoords[0]] as [number, number] : undefined,
    dropCoordinates: dropCoords ? [dropCoords[1], dropCoords[0]] as [number, number] : undefined,
    time: ride.schedule?.time || ride.time || '--:--',
    date: ride.schedule?.date || ride.date || '',
    price: ride.farePerSeat || ride.pricePerSeat || 0,
    seats: ride.effectiveAvailableSeats ?? ride.availableSeats ?? 0,
    vehicleType: (ride.vehicleType || ride.vehicle?.type || 'car').toLowerCase(),
    distanceKm: ride.distanceKm || 0,
    vehicle: {
      model: ride.vehicle?.name || ride.vehicle?.model || 'Vehicle Model',
      numberPlate: ride.vehicle?.registrationNumber || ride.vehicle?.numberPlate || 'XX XX XXXX',
      color: ride.vehicle?.color || 'Color',
      type: ride.vehicle?.type || ride.vehicleType || 'car',
    },
  };
};

interface SearchFilters {
  pickup?: string;
  dropoff?: string;
  _t?: number;
}

export default function FindRideContainer() {
  const [isLoading, setIsLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Use a ref to store the latest fetchRides function to avoid stale closures
  const fetchRidesRef = React.useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchRides = async (params?: SearchFilters) => {
    setIsLoading(true);
    try {
      // Add timestamp to prevent caching
      const cacheBuster = { ...params, _t: Date.now() };
      
      // Use rideService.getAllRides which hits GET /api/rides
      const result = await rideService.getAllRides(cacheBuster);
      
      console.log("📡 API Response:", result);
      console.log("🎢 Raw rides count:", result.data?.length || 0);
      
      if (result.success) {
        const rawRides = result.data || [];
        
        if (rawRides.length === 0) {
          console.log("✅ No rides in database - showing empty state");
          setRides([]);
          setIsLoading(false);
          return;
        }
        
        // Transform raw API rides to the shape RideCard expects
        const transformedRides = rawRides.map(transformRide);
        console.log("🔄 Transformed rides:", transformedRides.length);
        
        // Filter only active rides (available seats + future departure)
        const activeRides = filterActiveRides(transformedRides);
        console.log("✨ Active rides after filtering:", activeRides.length);
        
        setRides(activeRides);
      } else {
        toast.error('Failed to fetch rides');
        setRides([]);
      }
    } catch (error) {
      console.error("❌ Failed to fetch rides:", error);
      toast.error('Failed to fetch rides');
      setRides([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Update ref after each render with latest fetchRides
  React.useLayoutEffect(() => {
    fetchRidesRef.current = fetchRides;
  });

  // Fetch rides on mount
  // Note: The isMounted state is used to prevent hydration mismatches in SSR
  // This is a valid use case for setState in useEffect - it ensures the component
  // only renders client-side features after the initial server render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    fetchRidesRef.current();
  }, []);

  if (!isMounted) return null;

  const handleSwap = () => {
    setPickup(drop);
    setDrop(pickup);
  };

  const handleSearch = () => {
    if (!pickup && !drop) {
      // If both empty, fetch all rides
      fetchRides();
      return;
    }
    // Backend expects 'pickup' and 'dropoff' query params (not 'drop')
    fetchRides({ 
      pickup: pickup || undefined, 
      dropoff: drop || undefined 
    });
  };

  const handleViewDetails = (ride: Ride) => {
    setSelectedRide(ride);
    setIsModalOpen(true);
  };

  const handleBookNow = (ride: Ride) => {
    setSelectedRide(ride);
    setIsModalOpen(true);
    // You could directly open booking step here if needed
  };

  return (
    <div className="text-gray-900 selection:bg-blue-500/30">
      {/* Hero / Search Section */}
      <section className="relative pt-8 pb-16 px-4 overflow-hidden bg-white border border-gray-100 rounded-[2.5rem] mb-10 shadow-sm">
        {/* Background Gradients - Adjusted for light mode */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Premium Ride Sharing Experience</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-gray-900">
              Find Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Perfect Ride</span>
            </h1>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium">
              Connect with verified drivers and travel comfortably across the city with RideMitra.
            </p>
          </motion.div>

          {/* Search Box */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-2 md:p-3 bg-white border border-gray-100 rounded-[2.5rem] shadow-xl relative"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_auto] items-center gap-2">
              {/* Pickup */}
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <MapPin className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Pickup Location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent focus:border-blue-500/20 focus:bg-white rounded-[1.8rem] py-5 pl-14 pr-6 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-semibold"
                  suppressHydrationWarning
                />
              </div>

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 border border-gray-100 hover:bg-white hover:border-blue-500/30 transition-all group mx-auto md:mx-0 shadow-sm"
                title="Swap pickup and drop locations"
                aria-label="Swap pickup and drop locations"
                suppressHydrationWarning
              >
                <ArrowUpDown className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </button>

              {/* Drop */}
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                  <MapPin className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Drop Location"
                  value={drop}
                  onChange={(e) => setDrop(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent focus:border-indigo-500/20 focus:bg-white rounded-[1.8rem] py-5 pl-14 pr-6 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-semibold"
                  suppressHydrationWarning
                />
              </div>

              {/* Date */}
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-pink-600 transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Date"
                  defaultValue="Today"
                  className="w-full bg-gray-50 border border-transparent focus:border-pink-500/20 focus:bg-white rounded-[1.8rem] py-5 pl-14 pr-6 outline-none transition-all text-gray-900 placeholder:text-gray-400 font-semibold"
                  suppressHydrationWarning
                />
              </div>

              {/* Search Button */}
              <button 
                onClick={handleSearch}
                className="h-full min-h-[64px] px-8 rounded-[1.8rem] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group"
                suppressHydrationWarning
              >
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="hidden md:inline">Search Rides</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto pb-12">
        {/* Filters */}
        <div className="mb-10">
          <FiltersBar />
        </div>

        {/* Rides Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
              Available Rides
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                {rides.length} found
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  // Clear caches and reload
                  localStorage.removeItem('rides-cache');
                  sessionStorage.clear();
                  fetchRides();
                }}
                className="flex items-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button 
                className="flex items-center gap-2 text-sm text-gray-500 font-semibold hover:text-gray-900 transition-colors"
                title="Sort rides by different criteria"
                aria-label="Sort rides"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Sort: Recommended</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                // Skeleton Loading
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 rounded-[2rem] bg-white animate-pulse border border-gray-100 shadow-sm" />
                ))
              ) : rides.length > 0 ? (
                rides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onViewDetails={handleViewDetails}
                    onBookNow={handleBookNow}
                  />
                ))
              ) : (
                // Empty State
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-20 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No active rides found</h3>
                  <p className="text-gray-500 font-medium max-w-md mx-auto">
                    Try adjusting your search or check back later. Note: Rides that are fully booked or have already departed are automatically hidden.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RideDetailsModal
        rideId={selectedRide?.id || null}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
