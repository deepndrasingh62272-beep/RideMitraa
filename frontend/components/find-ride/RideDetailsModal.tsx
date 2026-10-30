"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Star, MapPin, Clock, Users, Car, Bike, 
  ShieldCheck, MessageSquare, Phone, Map,
  ChevronRight, CreditCard, Info, Check, AlertCircle,
  Navigation, Zap, CheckCircle2
} from "lucide-react";
import bookingService from "@/src/services/bookingService";
import { ridesAPI } from "@/src/api/rides";
import { toast } from "sonner";
import { handleError } from "@/src/services/errorHandler";
import { showToast } from "@/components/ui/Toast";
import { useEffect, useCallback } from "react";
import { useSocket } from "@/src/contexts/SocketContext";
import SOSButton from "@/components/safety/SOSButton";
import EmergencyAlertUI from "@/components/safety/EmergencyAlertUI";
import LiveMapTracking from "@/components/safety/LiveMapTracking";
import { Location, Driver, Ride, CreateBookingRequest } from "@/types/ride";
import { getAvatarDataUri } from '@/src/utils/avatar';

/**
 * Transform raw ride data from the backend API into the shape expected by the modal.
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
    dropoff: ride.dropoff?.name || ride.dropoffText || 'Unknown',
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
    farePerSeat: ride.farePerSeat || ride.pricePerSeat || ride.price || 0,
  };
};

interface RideDetailsModalProps {
  rideId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const StatusTimeline = ({ status }: { status: string }) => {
  const steps = ["pending", "accepted", "on_the_way", "completed"];
  const stepLabels = ["Requested", "Accepted", "On the Way", "Completed"];
  const stepIcons = [Clock, Check, Navigation, Check];
  const currentIndex = steps.indexOf(status);

  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between relative">
        {/* Progress Line Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full" />
        
        {/* Active Progress Line */}
        <motion.div 
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 -translate-y-1/2 rounded-full transition-all duration-700"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const IconComponent = stepIcons[index];

          return (
            <div key={step} className="relative z-10 flex flex-col items-center">
              <motion.div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-3 transition-all duration-500 shadow-lg ${
                  isCompleted ? "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-200 shadow-emerald-500/20" : 
                  isCurrent ? "bg-white border-blue-600 shadow-blue-500/20" : "bg-white border-gray-200"
                }`}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isCompleted ? (
                  <Check size={18} className="text-white" />
                ) : isCurrent ? (
                  <IconComponent size={18} className="text-blue-600 animate-pulse" />
                ) : (
                  <IconComponent size={18} className="text-gray-300" />
                )}
              </motion.div>
              <span className={`absolute top-12 whitespace-nowrap text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${
                isCompleted ? "text-emerald-600" :
                isCurrent ? "text-blue-600" : "text-gray-400"
              }`}>
                {stepLabels[index]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function RideDetailsModal({ rideId, isOpen, onClose }: RideDetailsModalProps) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [seatsCount, setSeatsCount] = useState(1);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'pending' | 'accepted' | 'on_the_way' | 'completed' | 'cancelled'>('idle');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [driverAcceptedAt, setDriverAcceptedAt] = useState<Date | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [sosActive, setSOSActive] = useState(false);
  const [sosStatus, setSOSStatus] = useState<'ACTIVE' | 'CANCELLED' | 'RESOLVED'>('ACTIVE');
  const [showLiveMap, setShowLiveMap] = useState(false);
  const { socket } = useSocket();

  const fetchRideDetails = useCallback(async () => {
    if (!rideId) return;
    setIsLoading(true);
    try {
      const response = await ridesAPI.getRideById(rideId);
      // Backend returns _id — normalise to id so ride.id is always available
      const raw = response.data?.data || response.data;
      const normalised = raw ? transformRide(raw) : raw;
      setRide(normalised);
    } catch (error) {
      handleError(error, 'ride');
    } finally {
      setIsLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    if (isOpen && rideId) {
      fetchRideDetails();
      setBookingStep(1);
      setBookingStatus('idle');
      setBookingId(null);
      setDriverAcceptedAt(null);
      setDriverLocation(null);
      setEta(null);
    }
  }, [isOpen, rideId, fetchRideDetails]);

  // Real-time Socket.IO listeners
  useEffect(() => {
    if (!socket || !bookingId) return;

    // Listen for booking status updates
    const handleBookingUpdate = (data: { bookingId: string; status: string; timestamp?: string }) => {
      if (data.bookingId === bookingId) {
        console.log('[Socket] Booking update:', data);
        setBookingStatus(data.status as any);
        
        if (data.status === 'accepted') {
          setDriverAcceptedAt(new Date(data.timestamp || Date.now()));
          toast.success('🎉 Your booking has been accepted!', {
            description: `${ride?.driver?.name || 'Driver'} is on the way to pick you up.`,
          });
          setBookingStep(3);
        } else if (data.status === 'on_the_way') {
          toast.info('🚗 Driver is on the way', {
            description: 'Your driver is heading to your pickup location.',
          });
        } else if (data.status === 'completed') {
          toast.success('✅ Ride completed!', {
            description: 'Thank you for riding with us.',
          });
        }
      }
    };

    // Listen for driver location updates
    const handleDriverLocation = (data: { bookingId: string; location: { lat: number; lng: number }; eta: number }) => {
      if (data.bookingId === bookingId) {
        setDriverLocation(data.location);
        setEta(data.eta);
      }
    };

    // Listen for booking cancellation
    const handleBookingCancelled = (data: { bookingId: string; reason: string }) => {
      if (data.bookingId === bookingId) {
        setBookingStatus('cancelled');
        toast.error('Booking cancelled', {
          description: data.reason || 'The driver cancelled your booking.',
        });
        setTimeout(() => {
          setBookingStep(1);
          setBookingId(null);
        }, 2000);
      }
    };

    socket.on('booking_update', handleBookingUpdate);
    socket.on('driver_location_update', handleDriverLocation);
    socket.on('booking_cancelled', handleBookingCancelled);

    return () => {
      socket.off('booking_update', handleBookingUpdate);
      socket.off('driver_location_update', handleDriverLocation);
      socket.off('booking_cancelled', handleBookingCancelled);
    };
  }, [socket, bookingId, ride]);

  // Handle SOS triggered
  const handleSOSTriggered = () => {
    setSOSActive(true);
    setSOSStatus('ACTIVE');
  };

  // Handle SOS cancelled
  const handleSOSCancelled = () => {
    setSOSActive(false);
    setSOSStatus('CANCELLED');
  };

  // Handle emergency service alert (Police/Ambulance)
  const handleEmergencyServiceAlert = async (serviceType: 'police' | 'ambulance') => {
    try {
      if (!driverLocation) {
        toast.error('Location not available');
        return;
      }

      const response = await fetch('/api/safety/emergency-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          serviceType,
          location: driverLocation,
        }),
      });

      if (!response.ok) throw new Error(`Failed to alert ${serviceType}`);

      toast.success(`${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} has been alerted`);
    } catch (error) {
      console.error(`Emergency alert error:`, error);
      toast.error(`Failed to alert ${serviceType}`);
    }
  };

  const pricePerSeat = ride?.farePerSeat || ride?.pricePerSeat || ride?.price || 0;
  const subtotal = pricePerSeat * seatsCount;
  const platformFee = Math.round(subtotal * 0.05); // 5% of subtotal
  const totalCost = ride ? subtotal + platformFee : 0;

  const handleConfirmBooking = async () => {
    if (!ride) return;
    
    setBookingStatus('pending');
    try {
      /**
       * Normalize any coordinate format to [lng, lat] array for the backend.
       * The ride object stores coordinates as [lat, lng] for frontend display.
       * The backend expects [lng, lat] in GeoJSON format.
       * This function converts frontend [lat, lng] back to backend [lng, lat].
       */
      const normalizeCoords = (coords: any): [number, number] => {
        if (!coords) return [0, 0];
        // Frontend format: [lat, lng] array from pickupCoordinates/dropCoordinates
        if (Array.isArray(coords) && coords.length === 2) {
          // Swap back to [lng, lat] for backend GeoJSON format
          return [Number(coords[1]), Number(coords[0])];
        }
        // { lat, lng } object (responseMapper output)
        if (typeof coords === 'object' && 'lng' in coords && 'lat' in coords) {
          return [Number(coords.lng), Number(coords.lat)];
        }
        // GeoJSON { type: 'Point', coordinates: [lng, lat] }
        if (typeof coords === 'object' && Array.isArray(coords.coordinates) && coords.coordinates.length === 2) {
          return [Number(coords.coordinates[0]), Number(coords.coordinates[1])];
        }
        return [0, 0];
      };

      // rideId: raw backend response uses _id; mapped response uses id — handle both
      const rideId = (ride as any)._id || ride.id;

      // Extract pickup coordinates — these are stored as [lat, lng] for frontend
      const pickupCoords =
        ride.pickupCoordinates ||
        (typeof ride.pickup === 'object' && ride.pickup?.coordinates) ||
        [0, 0];

      // Extract dropoff coordinates — these are stored as [lat, lng] for frontend
      const dropoffCoords =
        ride.dropCoordinates ||
        (ride as any).dropoffCoordinates ||
        (typeof ride.drop === 'object' && ride.drop?.coordinates) ||
        (typeof ride.dropoff === 'object' && ride.dropoff?.coordinates) ||
        [0, 0];

      const bookingData = {
        rideId,
        passengersCount: seatsCount,
        seatsBooked: seatsCount,
        paymentMethod: 'CASH' as const, // Cash mode — no payment gateway needed
        pickup: {
          name: typeof ride.pickup === 'string' ? ride.pickup : (ride.pickup as any)?.name || 'Pickup',
          coordinates: normalizeCoords(pickupCoords),
        },
        dropoff: {
          name: typeof ride.drop === 'string' ? ride.drop : (ride.drop as any)?.name || (ride.dropoff as any)?.name || 'Dropoff',
          coordinates: normalizeCoords(dropoffCoords),
        },
      };
      
      console.log('[BOOKING] Sending booking request:', JSON.stringify(bookingData, null, 2));
      const response = await bookingService.createBooking(bookingData);
      setBookingId(response.data.id);
      
      // Emit booking event to Socket.IO
      if (socket) {
        socket.emit('booking_created', {
          bookingId: response.data.id,
          rideId: ride.id,
          passengerId: response.data.passengerId,
          seats: seatsCount,
        });
      }

      showToast.success('Booking Request Sent!', {
        description: `Waiting for ${ride?.driver?.name || 'Driver'} to accept your request...`,
      });
      setBookingStep(3);
    } catch (error) {
      setBookingStatus('idle');
      handleError(error, 'booking');
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingId) return;
    try {
      await bookingService.cancelBooking(bookingId);
      setBookingStatus('cancelled');
      showToast.success('Booking cancelled');
      setTimeout(() => {
        setBookingStep(1);
        setBookingId(null);
      }, 1500);
    } catch (error) {
      handleError(error, 'booking');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors z-10 border border-gray-100"
            >
              <X className="w-5 h-5" />
            </button>

            {/* SOS Button - Only show when ride is accepted/on the way */}
            {['accepted', 'on_the_way'].includes(bookingStatus) && (
              <SOSButton 
                isActive={true}
                rideId={rideId || ''}
                onSOSTriggered={handleSOSTriggered}
              />
            )}

            {/* Emergency Alert UI */}
            <EmergencyAlertUI
              isVisible={sosActive}
              sosStatus={sosStatus}
              locationSharingActive={sosActive}
              emergencyContactsNotified={0}
              policeAlerted={false}
              ambulanceAlerted={false}
              onCancel={handleSOSCancelled}
              onCallPolice={() => handleEmergencyServiceAlert('police')}
              onCallAmbulance={() => handleEmergencyServiceAlert('ambulance')}
            />

            <div className="flex flex-col md:flex-row h-full max-h-[90vh] overflow-y-auto">
              {/* Left Column: Ride Info */}
              <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-gray-100">
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative">
                    <img
                      src={ride?.driver?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ride?.driver?.name || 'Driver')}&background=3b82f6&color=fff&size=64`}
                      alt={ride?.driver?.name || 'Driver'}
                      className="w-16 h-16 rounded-[1.5rem] object-cover border-2 border-blue-500/10"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{ride?.driver?.name || 'Driver'}</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold">{ride?.driver?.rating || '4.5'}</span>
                      </div>
                      <span className="text-gray-200">•</span>
                      <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{(ride as any)?.driver?.isVerified ? 'Verified Driver' : 'Driver'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Route Timeline */}
                  <div className="relative pl-8 space-y-8">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500" />
                    
                    <div className="relative">
                      <div className="absolute -left-[2.35rem] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-lg shadow-blue-500/20" />
                      <div>
                        <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Pickup • {ride?.time}</span>
                        <p className="text-gray-900 font-bold mt-1">
                          {typeof ride?.pickup === 'string' ? ride.pickup : ride?.pickup?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[2.35rem] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-purple-500 shadow-lg shadow-purple-500/20" />
                      <div>
                        <span className="text-xs text-purple-600 font-bold uppercase tracking-wider">Dropoff • {ride?.date || 'Today'}</span>
                        <p className="text-gray-900 font-bold mt-1">
                          {typeof ride?.drop === 'string'
                            ? ride.drop
                            : ride?.drop?.name ||
                              (typeof ride?.dropoff === 'string'
                                ? ride.dropoff
                                : ride?.dropoff?.name) ||
                              'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Details */}
                  <div className="p-5 rounded-[1.5rem] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-gray-900 font-bold text-sm">Vehicle Information</h4>
                      {ride?.vehicleType === 'car' ? <Car className="w-5 h-5 text-blue-600" /> : <Bike className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold">Model</span>
                        <p className="text-gray-900 text-sm font-bold">{ride?.vehicle?.model || ride?.vehicleModel || 'Vehicle Model'}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold">Number Plate</span>
                        <p className="text-gray-900 text-sm font-bold">{ride?.vehicle?.numberPlate || ride?.vehicleNumber || 'XX XX XXXX'}</p>
                      </div>
                      {ride?.vehicle?.color && (
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold">Color</span>
                          <p className="text-gray-900 text-sm font-bold">{ride?.vehicle?.color}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Booking Panel */}
              <div className="w-full md:w-80 bg-gradient-to-b from-gray-50 to-white p-8">
                {bookingStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <h3 className="text-gray-900 font-bold text-lg">Select Seats</h3>
                    
                    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                      <span className="text-gray-600 font-bold">Number of Seats</span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSeatsCount(Math.max(1, seatsCount - 1))}
                          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-all font-bold"
                        >−</button>
                        <span className="text-gray-900 font-black w-6 text-center text-lg">{seatsCount}</span>
                        <button 
                          onClick={() => setSeatsCount(Math.min(ride?.seats || 4, seatsCount + 1))}
                          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-all font-bold"
                        >+</button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                      <p className="text-xs text-blue-700 leading-relaxed font-medium flex items-start gap-2">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>You are booking {seatsCount} seat{seatsCount > 1 ? 's' : ''}. Total price will be divided across all passengers.</span>
                      </p>
                    </div>

                    {/* Live Price Breakdown in Step 1 */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <div className="flex justify-between text-gray-500 text-xs font-bold">
                        <span>Ride Fare ({seatsCount} × ₹{pricePerSeat})</span>
                        <span className="text-gray-900">₹{pricePerSeat * seatsCount}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-xs font-bold">
                        <span>Platform Fee (5%)</span>
                        <span className="text-gray-900">₹{platformFee}</span>
                      </div>
                      <div className="flex justify-between text-gray-900 font-black text-lg pt-2 border-t border-gray-100">
                        <span>Total Amount</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">₹{totalCost}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setBookingStep(2)}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      Continue to Pay
                    </button>
                  </motion.div>
                )}

                {bookingStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => setBookingStep(1)} className="text-gray-400 hover:text-gray-900 transition-colors">
                        <ChevronRight className="w-5 h-5 rotate-180" />
                      </button>
                      <h3 className="text-gray-900 font-bold text-lg">Price Breakdown</h3>
                    </div>

                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-100">
                      <div className="flex justify-between text-gray-500 text-sm font-bold">
                        <span>Per Seat Cost</span>
                        <span className="text-gray-900">₹{pricePerSeat}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-sm font-bold">
                        <span>Ride Fare ({seatsCount} seats)</span>
                        <span className="text-gray-900">₹{pricePerSeat * seatsCount}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-sm font-bold">
                        <span>Platform & Service Fee (5%)</span>
                        <span className="text-gray-900">₹{platformFee}</span>
                      </div>
                      <div className="h-px bg-gray-100 my-4" />
                      <div className="flex justify-between text-gray-900 font-black text-xl">
                        <span>Total Payable</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">₹{totalCost}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleConfirmBooking}
                      disabled={bookingStatus === 'pending'}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {bookingStatus === 'pending' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Confirm Booking
                        </>
                      )}
                    </button>
                  </motion.div>
                )}

                {bookingStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col justify-center items-center text-center space-y-6 py-8"
                  >
                    {/* Status Icon */}
                    <motion.div 
                      className={`w-20 h-20 rounded-full flex items-center justify-center ${
                        bookingStatus === 'accepted' 
                          ? 'bg-emerald-50 border-2 border-emerald-200' 
                          : 'bg-blue-50 border-2 border-blue-100'
                      }`}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {bookingStatus === 'accepted' ? (
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                      ) : (
                        <Clock className="w-10 h-10 text-blue-600 animate-pulse" />
                      )}
                    </motion.div>

                    <div>
                      <h3 className="text-gray-900 font-bold text-xl mb-2">
                        {bookingStatus === 'accepted' ? '🎉 Booking Accepted!' : 'Request Sent!'}
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed font-medium max-w-[200px] mx-auto">
                        {bookingStatus === 'accepted' 
                          ? `${ride?.driver?.name || 'Driver'} accepted your booking. Go to My Bookings to pay and continue.`
                          : `Waiting for ${ride?.driver?.name || 'the driver'} to accept your request. You'll be notified when accepted.`
                        }
                      </p>
                    </div>

                    {/* Live indicator */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
                      <div className={`w-2 h-2 rounded-full ${bookingStatus === 'accepted' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
                      <span className="text-xs font-bold text-gray-600">
                        {bookingStatus === 'accepted' ? 'Accepted' : 'Waiting for driver response...'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full space-y-3 pt-2">
                      <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        View in My Bookings
                      </button>
                      <button
                        onClick={handleCancelBooking}
                        className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all"
                      >
                        Cancel Request
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Live Map Modal */}
            <AnimatePresence>
              {showLiveMap && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 rounded-[2.5rem]"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full h-full max-h-[80vh] relative"
                  >
                    <button
                      onClick={() => setShowLiveMap(false)}
                      className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white hover:bg-gray-100 text-gray-900 transition-colors border border-gray-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <LiveMapTracking
                      rideId={rideId || ''}
                      driverLocation={driverLocation || undefined}
                      passengerLocation={undefined}
                      eta={eta || undefined}
                      driverName={ride?.driver?.name || 'Driver'}
                      vehicleInfo={{
                        model: ride?.vehicle?.model || ride?.vehicleModel || 'Vehicle Model',
                        plate: ride?.vehicle?.numberPlate || ride?.vehicleNumber || 'XX XX XXXX',
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
