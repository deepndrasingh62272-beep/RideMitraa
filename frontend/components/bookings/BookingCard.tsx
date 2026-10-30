"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Clock, Users, Check, X, Star, 
  MessageSquare, AlertCircle,
  Eye, Shield, Play, Square, CreditCard
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import bookingService from "@/src/services/bookingService";

interface BookingCardProps {
  type: "passenger" | "driver";
  booking: any;
  showStatusStepper?: boolean;
  onActionSuccess?: () => void;
  onTrack?: () => void;
  onRate?: () => void;
  onStartRide?: () => void;
  onCompleteRide?: () => void;
  onVerifyOTP?: () => void;
  onPayNow?: () => void;
  onChat?: () => void;
  onViewDetails?: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (s: string) => {
    switch (s.toLowerCase()) {
      case "pending":
        return { color: "bg-amber-50 text-amber-600 border-amber-100", label: "Pending" };
      case "accepted":
        return { color: "bg-blue-50 text-blue-600 border-blue-100", label: "Accepted" };
      case "payment_done":
        return { color: "bg-amber-50 text-amber-700 border-amber-200", label: "Payment Done" };
      case "otp_verified":
        return { color: "bg-teal-50 text-teal-600 border-teal-100", label: "OTP Verified" };
      case "on_the_way":
        return { color: "bg-indigo-50 text-indigo-600 border-indigo-100", label: "On the way" };
      case "ongoing":
      case "started":
        return { color: "bg-indigo-50 text-indigo-600 border-indigo-100", label: "Ongoing" };
      case "completed":
        return { color: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Completed" };
      case "cancelled":
        return { color: "bg-red-50 text-red-500 border-red-100", label: "Cancelled" };
      case "booking_open":
        return { color: "bg-green-50 text-green-600 border-green-100", label: "Open" };
      case "created":
        return { color: "bg-gray-50 text-gray-600 border-gray-100", label: "Created" };
      case "full":
        return { color: "bg-orange-50 text-orange-600 border-orange-100", label: "Full" };
      default:
        return { color: "bg-gray-50 text-gray-600 border-gray-100", label: s };
    }
  };

  const config = getStatusConfig(status || '');

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.color}`}>
      {config.label}
    </span>
  );
};

export default function BookingCard({ 
  type, booking, showStatusStepper = false, 
  onActionSuccess, onTrack, onRate, 
  onStartRide, onCompleteRide, onVerifyOTP, onPayNow,
  onChat, onViewDetails
}: BookingCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [driverOTP, setDriverOTP] = useState<string | null>(null);
  const person = type === "passenger" ? booking.driver : booking.passenger;
  const personName = type === "passenger" ? booking.driver?.name : booking.passenger?.name;
  // Normalise status to lowercase for all comparisons
  const status = (booking.status || '').toLowerCase();

  // Fetch OTP for driver when status is payment_done or otp_verified
  // The OTP is populated directly on the booking from the backend (rideId.otpCode)
  // — no API call needed. We just read it from the booking object.
  useEffect(() => {
    if (type === "driver" && (status === "payment_done" || status === "otp_verified")) {
      const rideIdRaw = booking.rideId;

      // OTP can be at: booking.otpCode, booking.otp, booking.rideOtp,
      // or nested inside the populated rideId object
      const otp =
        booking.otpCode ||
        booking.otp ||
        booking.rideOtp ||
        (typeof rideIdRaw === 'object' && rideIdRaw !== null
          ? (rideIdRaw.otpCode || rideIdRaw.otp)
          : null);

      if (otp) {
        setDriverOTP(String(otp));
      }
      // No API fallback — GET /rides/:id/otp is driver-only and
      // the OTP is already populated in the booking response from the backend.
    }
  }, [type, status, booking.rideId, booking.id, booking.otpCode, booking.otp, booking.rideOtp]);

  const handleAction = async (action: 'accept' | 'reject' | 'cancel' | 'view-details' | 'cancel-ride') => {
    if (action === 'view-details') {
      onViewDetails?.();
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'accept') {
        await bookingService.acceptBooking(booking.id);
        toast.success("Booking accepted!");
      } else if (action === 'reject') {
        await bookingService.rejectBooking(booking.id);
        toast.success("Booking rejected!");
      } else if (action === 'cancel' || action === 'cancel-ride') {
        // Both cancel and cancel-ride now cancel the booking request via bookingService
        await bookingService.cancelBooking(booking.id);
        toast.success("Booking cancelled!");
      }
      onActionSuccess?.();
    } catch (error: any) {
      console.error(`Failed to ${action}:`, error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        `Failed to ${action}`;
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group ${
        status === 'cancelled' ? 'border-red-100 opacity-80' : 'border-gray-100'
      }`}
    >
      {/* Cancelled banner */}
      {status === 'cancelled' && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 rounded-2xl border border-red-100">
          <X size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-500">This ride was cancelled</span>
        </div>
      )}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {person?.avatar ? (
                <img 
                  src={person.avatar} 
                  alt={personName}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-100"
                />
              ) : null}
              <div className={`w-12 h-12 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center ${person?.avatar ? 'hidden' : ''}`}>
                <span className="text-white font-bold text-lg">
                  {(personName || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              {type === "passenger" && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white">
                  <Check size={10} className="text-white absolute top-0.5 left-0.5" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{personName || (type === "passenger" ? "Driver" : "Passenger")}</h3>
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">
                  {booking.date || (booking.rideTime ? new Date(booking.rideTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')}
                  {' • '}
                  {booking.time || (booking.rideTime ? new Date(booking.rideTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—')}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-900">₹{booking.price ?? booking.totalAmount ?? 0}</p>
            <div className="flex items-center gap-1 text-gray-400">
              <Users size={12} />
              <span className="text-[10px] font-bold">{booking.seats || booking.seatsBooked || booking.passengersCount || 1} seat{(booking.seats || booking.seatsBooked || booking.passengersCount || 1) > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-0.5 h-8 bg-gray-100" />
            <div className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Pickup</p>
              <p className="text-sm font-semibold text-gray-700">
                {typeof booking.pickup === 'string'
                  ? booking.pickup
                  : booking.pickup?.name || booking.pickup?.address || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Drop</p>
              <p className="text-sm font-semibold text-gray-700">
                {typeof (booking.drop || booking.dropoff) === 'string'
                  ? (booking.drop || booking.dropoff)
                  : (booking.drop?.name || booking.dropoff?.name || booking.drop?.address || booking.dropoff?.address || 'Unknown')}
              </p>
            </div>
          </div>
        </div>

        {showStatusStepper && (
          <div className="pt-4 border-t border-gray-50">
            <StatusBadge status={booking.status} />
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          {type === "driver" && status === "pending" ? (
            /* Driver - Incoming Request - Accept/Reject */
            <>
              <button 
                onClick={() => handleAction('accept')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
                Accept
              </button>
              <button 
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Reject
              </button>
            </>
          ) : type === "driver" && status === "accepted" ? (
            /* Driver - Accepted booking - Waiting for passenger payment + Chat + Cancel */
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                <AlertCircle size={18} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-700">Waiting for payment</p>
                  <p className="text-xs text-blue-500">The passenger needs to complete payment before the ride can start.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={onChat}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  <MessageSquare size={16} />
                  Chat
                </button>
                <button 
                  onClick={() => handleAction('cancel')}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                  Cancel
                </button>
              </div>
            </div>
          ) : type === "passenger" && status === "pending" ? (
            /* Passenger - Request Sent - Cancel Request */
            <>
              <button 
                onClick={() => handleAction('view-details')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors"
              >
                <Eye size={16} />
                View Details
              </button>
              <button 
                onClick={() => handleAction('cancel')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Cancel
              </button>
            </>
          ) : type === "passenger" && status === "accepted" ? (
            /* Passenger - Accepted ride - Show Pay Now + Chat + Cancel */
            <div className="w-full space-y-3">
              <div className="flex gap-3">
                <button 
                  onClick={onPayNow}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <CreditCard size={16} />
                  Pay Now
                </button>
                <button 
                  onClick={onChat}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  <MessageSquare size={16} />
                  Chat
                </button>
              </div>
              <button 
                onClick={() => handleAction('cancel')}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Cancel
              </button>
            </div>
          ) : type === "passenger" && status === "payment_done" ? (
            /* Passenger - Payment done - Show Verify OTP + Chat + Cancel */
            <div className="w-full space-y-3">
              <div className="flex gap-3">
                <button 
                  onClick={onVerifyOTP}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Shield size={16} />
                  Verify OTP
                </button>
                <button 
                  onClick={onChat}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  <MessageSquare size={16} />
                  Chat
                </button>
              </div>
              <button 
                onClick={() => handleAction('cancel')}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Cancel
              </button>
            </div>
          ) : type === "driver" && status === "payment_done" ? (
            /* Driver - Payment done - Show large OTP + Chat + Cancel Ride */
            <div className="w-full space-y-3">
              <div className="flex flex-col items-center justify-center p-4 bg-gray-900 rounded-2xl">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Ride OTP</p>
                <p className="text-3xl font-black text-white tracking-[0.3em]">
                  {driverOTP ?? '------'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Share with passenger to verify boarding</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={onChat}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  <MessageSquare size={16} />
                  Chat
                </button>
                <button 
                  onClick={() => handleAction('cancel-ride')}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                  Cancel
                </button>
              </div>
            </div>
          ) : type === "passenger" && status === "otp_verified" ? (
            /* Passenger - OTP verified - Waiting for driver to start + Chat + Cancel */
            <>
              <div className="flex-1 relative group/tooltip">
                <button 
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 text-emerald-400 text-sm font-bold cursor-not-allowed opacity-60"
                >
                  <Play size={16} />
                  Start Ride
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-xl whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                  Only the driver can start the ride
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
              <button 
                onClick={onChat}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                <MessageSquare size={16} />
                Chat
              </button>
              <button 
                onClick={() => handleAction('cancel')}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Cancel
              </button>
            </>
          ) : type === "driver" && status === "otp_verified" ? (
            /* Driver - OTP verified - Start Ride (enabled) + Chat + Cancel */
            <div className="w-full space-y-3">
              {/* Show OTP for reference */}
              {driverOTP && (
                <div className="flex flex-col items-center justify-center p-3 bg-teal-50 rounded-2xl border border-teal-100">
                  <p className="text-[10px] text-teal-600 uppercase tracking-widest font-bold mb-1">OTP Verified ✓</p>
                  <p className="text-3xl font-black text-teal-700 tracking-[0.3em]">{driverOTP}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button 
                  onClick={onStartRide}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={18} />}
                  Start Ride
                </button>
                <button 
                  onClick={onChat}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  <MessageSquare size={16} />
                  Chat
                </button>
                <button 
                  onClick={() => handleAction('cancel-ride')}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                  Cancel
                </button>
              </div>
            </div>
          ) : type === "driver" && (status === "ongoing" || status === "started") ? (
            /* Driver - Ongoing ride - Track Ride + Chat + Complete Ride */
            <>
              <button 
                onClick={onTrack}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors"
              >
                <MessageSquare size={16} />
                Track Ride
              </button>
              <button 
                onClick={onChat}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                <MessageSquare size={16} />
                Chat
              </button>
              <button 
                onClick={onCompleteRide}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Square size={18} />}
                Complete Ride
              </button>
            </>
          ) : status === "completed" ? (
            /* Completed - Rate button */
            <button 
              onClick={onRate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-50 text-amber-600 text-sm font-bold hover:bg-amber-100 transition-colors"
            >
              <Star size={16} className="fill-current" />
              Rate {type === "passenger" ? "Driver" : "Passenger"}
            </button>
          ) : ["ongoing", "on_the_way", "arrived", "in_progress"].includes(status) ? (
            /* Passenger - Ongoing ride - Track + Chat + Cancel */
            <>
              <button 
                onClick={onTrack}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors"
              >
                <MessageSquare size={16} />
                Track
              </button>
              <button 
                onClick={onChat}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                <MessageSquare size={16} />
                Chat
              </button>
              <button 
                onClick={() => handleAction('cancel')}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <X size={18} />}
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
