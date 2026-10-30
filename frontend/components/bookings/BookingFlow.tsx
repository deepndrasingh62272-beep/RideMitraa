"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Clock, MapPin, Users, Check, X, Loader2, 
  AlertCircle, CheckCircle2, XCircle, 
  Navigation, Phone, MessageSquare, Car
} from "lucide-react";
import { toast } from "sonner";
import bookingService, { CreateBookingRequest } from "@/src/services/bookingService";
import { useSocket } from "@/src/contexts/SocketContext";

interface Ride {
  id: string;
  driver: {
    name: string;
    rating: number;
    phone: string;
  };
  vehicle: {
    model: string;
    number: string;
    type: 'CAR' | 'BIKE';
  };
  pickup: {
    name: string;
    coordinates: [number, number];
  };
  dropoff: {
    name: string;
    coordinates: [number, number];
  };
  schedule: {
    departureAt: string;
  };
  pricePerSeat: number;
  availableSeats: number;
}

interface BookingFlowProps {
  ride: Ride;
  onBookingComplete?: (bookingId: string) => void;
  onCancel?: () => void;
}

type BookingStatus = 'IDLE' | 'CREATING' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

const BookingFlow: React.FC<BookingFlowProps> = ({ ride, onBookingComplete, onCancel }) => {
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('IDLE');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [passengersCount, setPassengersCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'WALLET'>('CASH');
  const [countdown, setCountdown] = useState<number | null>(null);
  const { socket, isConnected } = useSocket();

  // Listen for booking updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = (data: any) => {
      console.log('Booking update received:', data);
      
      if (data.bookingId === bookingId) {
        switch (data.status) {
          case 'ACCEPTED':
            setBookingStatus('ACCEPTED');
            toast.success('Booking accepted! Driver is on the way.');
            break;
          case 'REJECTED':
            setBookingStatus('REJECTED');
            toast.error('Booking rejected by driver.');
            if (data.autoMatch) {
              toast.info('Finding you another ride...');
              // Auto-match logic would go here
            }
            break;
          case 'CANCELLED':
            setBookingStatus('CANCELLED');
            toast.info('Booking was cancelled.');
            break;
          case 'COMPLETED':
            setBookingStatus('COMPLETED');
            toast.success('Ride completed!');
            break;
        }
      }
    };

    socket.on('booking:update', handleBookingUpdate);

    return () => {
      socket.off('booking:update', handleBookingUpdate);
    };
  }, [socket, bookingId]);

  // Countdown timer for pending bookings
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (bookingStatus === 'PENDING' && countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [bookingStatus, countdown]);

  const handleCreateBooking = async () => {
    if (bookingStatus !== 'IDLE') return;
    
    setBookingStatus('CREATING');
    
    try {
      // Helper to normalize coordinates to [lng, lat] array format for backend
      const normalizeCoords = (coords: any): [number, number] => {
        if (Array.isArray(coords) && coords.length === 2) {
          return [Number(coords[0]), Number(coords[1])];
        }
        if (coords && typeof coords === 'object' && 'lng' in coords && 'lat' in coords) {
          return [Number(coords.lng), Number(coords.lat)];
        }
        return [0, 0];
      };

      const bookingData: CreateBookingRequest = {
        rideId: ride.id,
        passengersCount,
        seatsBooked: passengersCount,
        paymentMethod,
        pickup: {
          name: ride.pickup.name,
          coordinates: normalizeCoords(ride.pickup.coordinates)
        },
        dropoff: {
          name: ride.dropoff.name,
          coordinates: normalizeCoords(ride.dropoff.coordinates)
        }
      };

      const result = await bookingService.createBooking(bookingData);
      
      if (result.success) {
        const booking = result.data;
        setBookingId(booking.id);
        setBookingStatus('PENDING');
        setCountdown(300); // 5 minutes countdown
        
        toast.success('Booking request sent! Waiting for driver confirmation.');
        
        if (onBookingComplete) {
          onBookingComplete(booking.id);
        }
      } else {
        throw new Error('Failed to create booking');
      }
    } catch (error: any) {
      console.error('Booking creation failed:', error);
      setBookingStatus('IDLE');
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (error.message.includes('No seats available')) {
        toast.error('No seats available. Please try another ride.');
      } else {
        toast.error('Failed to create booking. Please try again.');
      }
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingId) return;
    
    try {
      const result = await bookingService.cancelBooking(bookingId, 'User cancelled');
      
      if (result.success) {
        setBookingStatus('CANCELLED');
        toast.info('Booking cancelled successfully.');
        
        if (onCancel) {
          onCancel();
        }
      }
    } catch (error) {
      console.error('Cancellation failed:', error);
      toast.error('Failed to cancel booking.');
    }
  };

  const getStatusIcon = () => {
    switch (bookingStatus) {
      case 'CREATING':
        return <Loader2 className="w-6 h-6 animate-spin text-blue-600" />;
      case 'PENDING':
        return <Clock className="w-6 h-6 text-amber-600" />;
      case 'ACCEPTED':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case 'REJECTED':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'CANCELLED':
        return <XCircle className="w-6 h-6 text-gray-600" />;
      case 'COMPLETED':
        return <Check className="w-6 h-6 text-emerald-600" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (bookingStatus) {
      case 'IDLE':
        return 'Ready to book';
      case 'CREATING':
        return 'Creating booking...';
      case 'PENDING':
        return `Waiting for driver response... ${countdown ? `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}` : ''}`;
      case 'ACCEPTED':
        return 'Booking accepted! Driver is on the way.';
      case 'REJECTED':
        return 'Booking rejected by driver.';
      case 'CANCELLED':
        return 'Booking cancelled.';
      case 'COMPLETED':
        return 'Ride completed!';
      default:
        return '';
    }
  };

  const getActionButton = () => {
    switch (bookingStatus) {
      case 'IDLE':
        return (
          <button
            onClick={handleCreateBooking}
            disabled={!isConnected}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnected ? 'Confirm Booking' : 'Connecting...'}
          </button>
        );
      case 'PENDING':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-amber-600 font-bold">
              <Clock className="w-5 h-5 animate-pulse" />
              <span>Request Sent - Waiting for driver</span>
            </div>
            <button
              onClick={handleCancelBooking}
              className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all duration-300"
            >
              Cancel Booking
            </button>
          </div>
        );
      case 'ACCEPTED':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Booking Confirmed!</span>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 py-3 bg-blue-100 text-blue-700 font-bold rounded-2xl hover:bg-blue-200 transition-all duration-300 flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                Call Driver
              </button>
              <button className="flex-1 py-3 bg-green-100 text-green-700 font-bold rounded-2xl hover:bg-green-200 transition-all duration-300 flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-red-600 font-bold">
              <XCircle className="w-5 h-5" />
              <span>Booking Rejected</span>
            </div>
            <button
              onClick={() => setBookingStatus('IDLE')}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all duration-300"
            >
              Try Another Ride
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={() => setBookingStatus('IDLE')}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all duration-300"
          >
            Start New Booking
          </button>
        );
    }
  };

  const calculateTotal = () => {
    return (ride.pricePerSeat * passengersCount).toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Book This Ride</h2>
          <p className="text-gray-500 text-sm">Real-time booking with instant updates</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-bold text-gray-700">{getStatusMessage()}</span>
        </div>
      </div>

      {/* Ride Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{ride.vehicle.model}</h3>
              <p className="text-sm text-gray-500">{ride.vehicle.number}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900">₹{ride.pricePerSeat}</p>
            <p className="text-sm text-gray-500">per seat</p>
          </div>
        </div>

        {/* Route */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Pickup</p>
              <p className="text-gray-600">{ride.pickup.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Dropoff</p>
              <p className="text-gray-600">{ride.dropoff.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Departure</p>
              <p className="text-gray-600">{new Date(ride.schedule.departureAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Controls - Only show when IDLE */}
      {bookingStatus === 'IDLE' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          {/* Passenger Count */}
          <div className="space-y-2">
            <label className="font-bold text-gray-900">Passengers</label>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
              <button
                onClick={() => setPassengersCount(prev => Math.max(1, prev - 1))}
                disabled={passengersCount <= 1}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-700 font-bold shadow-sm disabled:opacity-50"
              >
                -
              </button>
              <div className="text-center">
                <p className="text-2xl font-black text-gray-900">{passengersCount}</p>
                <p className="text-sm text-gray-500">passenger{passengersCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setPassengersCount(prev => Math.min(ride.availableSeats, prev + 1))}
                disabled={passengersCount >= ride.availableSeats}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-700 font-bold shadow-sm disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="text-sm text-gray-500 text-center">
              {ride.availableSeats - passengersCount} seat{ride.availableSeats - passengersCount !== 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="font-bold text-gray-900">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {(['CASH', 'UPI', 'CARD', 'WALLET'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-2xl font-bold transition-all duration-300 ${
                    paymentMethod === method
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Price per seat</span>
              <span className="font-bold">₹{ride.pricePerSeat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Passengers</span>
              <span className="font-bold">×{passengersCount}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between">
              <span className="text-lg font-bold text-gray-900">Total Amount</span>
              <span className="text-2xl font-black text-gray-900">₹{calculateTotal()}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Button */}
      <div className="pt-4">
        {getActionButton()}
      </div>

      {/* Real-time Status Indicator */}
      {bookingStatus !== 'IDLE' && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className="text-sm font-bold">
                {isConnected ? 'Real-time updates active' : 'Disconnected - reconnecting...'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              Listening for: booking:update
            </span>
          </div>
        </div>
      )}

      {/* Socket Connection Status */}
      {!isConnected && bookingStatus !== 'IDLE' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-700">
              Connection lost. Real-time updates may be delayed.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default BookingFlow;