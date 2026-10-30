"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, MapPin, Users, Check, X, Star,
  Phone, MessageSquare, Navigation, ChevronRight,
  AlertCircle, CheckCircle2, Circle, CreditCard, Shield
} from "lucide-react";
import BookingCard from "./BookingCard";
import BookingRatingModal from "./BookingRatingModal";
import TrackRide from "./TrackRide";
import SosButton from "./SosButton";
import OTPModal from "./OTPModal";
import PaymentModal from "./PaymentModal";
import bookingService from "@/src/services/bookingService";
import rideService from "@/src/services/rideService";
import { useSocket } from "@/src/contexts/SocketContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type TabType = "requests" | "upcoming" | "completed";
type ViewAs = "passenger" | "driver";

const StatusStepper = ({ status }: { status: string }) => {
  const steps = ["requested", "accepted", "on_the_way", "completed"];
  const currentIndex = steps.indexOf(status);

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isCompleted ? "bg-emerald-500" :
                isCurrent ? "bg-blue-600" : "bg-gray-100"
              }`}>
                {isCompleted ? (
                  <Check size={14} className="text-white" />
                ) : (
                  <span className={`text-[10px] font-bold ${isCurrent ? "text-white" : "text-gray-400"}`}>
                    {index + 1}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                isCompleted ? "text-emerald-600" :
                isCurrent ? "text-blue-600" : "text-gray-300"
              }`}>
                {step.replace("_", " ")}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                index < currentIndex ? "bg-emerald-500" : "bg-gray-100"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<TabType>("requests");
  const [viewAs, setViewAs] = useState<ViewAs>("passenger");
  const [bookings, setBookings] = useState<any[]>([]);
  // All offered rides including cancelled — split into active vs history
  const [myOfferedRides, setMyOfferedRides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{
    isOpen: boolean;
    type: "passenger_rating_driver" | "driver_rating_passenger";
    name: string;
    avatar?: string;
    bookingId: string;
  }>({ isOpen: false, type: "passenger_rating_driver", name: "", avatar: undefined, bookingId: "" });
  const [trackRide, setTrackRide] = useState<{
    isVisible: boolean;
    booking: any | null;
    status: "accepted" | "on_the_way" | "arrived" | "in_progress" | "completed";
  }>({ isVisible: false, booking: null, status: "accepted" });
  const [isRideActive, setIsRideActive] = useState(false);

  // OTP Modal State
  const [otpModal, setOtpModal] = useState<{
    isOpen: boolean;
    bookingId: string;
  }>({ isOpen: false, bookingId: "" });

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    booking: any | null;
  }>({ isOpen: false, booking: null });

  // Details Modal State
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; booking: any | null }>({ isOpen: false, booking: null });

  // Socket for real-time updates
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  // ── Derived lists ────────────────────────────────────────────────────────────
  // Active offered rides: not cancelled/completed — shown in Upcoming tab
  const activeOfferedRides = myOfferedRides.filter(r => {
    const s = (r.status || '').toLowerCase();
    return !['cancelled', 'completed'].includes(s);
  });

  // Cancelled/completed offered rides — shown in Completed tab for driver
  const doneOfferedRides = myOfferedRides.filter(r => {
    const s = (r.status || '').toLowerCase();
    return ['cancelled', 'completed'].includes(s);
  });

  // ── Driver tab derived lists (from bookings state) ───────────────────────────
  const driverPendingBookings = bookings.filter(b =>
    (b.status || '').toLowerCase() === 'pending'
  );

  const driverUpcomingBookings = bookings.filter(b => {
    const s = (b.status || '').toLowerCase();
    return ['accepted', 'payment_done', 'otp_verified', 'ongoing'].includes(s);
  });

  const driverCompletedBookings = bookings.filter(b => {
    const s = (b.status || '').toLowerCase();
    return ['completed', 'cancelled', 'rejected'].includes(s);
  }).sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      if (viewAs === "passenger") {
        // Passenger: fetch their own trip bookings
        const result = await bookingService.getMyTrips();
        if (result.success) {
          setBookings(result.data || []);
        }
      } else {
        // Driver: fetch INCOMING booking requests (BookingRequest where driverId = me, status = PENDING)
        const result = await bookingService.getBookingRequests();
        if (result.success) {
          // Backend returns { incoming: [...], sent: [...] }
          // We want incoming requests for the driver
          const raw = result.data as any;
          const incoming: any[] = raw?.incoming || raw?.requests || (Array.isArray(raw) ? raw : []);
          setBookings(incoming);
          console.log('[Bookings] Driver incoming requests:', incoming.length, incoming);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  }, [viewAs]);

  const fetchMyOfferedRides = useCallback(async () => {
    try {
      // showCancelled=true → include cancelled rides so they appear in history
      const result = await rideService.getMyRides({ showCancelled: true });
      if (result.success) {
        setMyOfferedRides(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching offered rides:', error);
    }
  }, []);

  // ── Real-time socket listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Driver: new incoming booking request arrived
    const handleBookingNew = (data: any) => {
      console.log('[Bookings] booking:new received:', data);
      if (viewAs === 'driver') {
        toast.info('New booking request received!');
        fetchBookings();
        // Switch to requests tab so driver sees it immediately
        setActiveTab('requests');
      }
    };

    // Passenger/Driver: booking status changed (accepted, rejected, etc.)
    const handleBookingUpdate = (data: any) => {
      console.log('[Bookings] booking:update received:', data);
      fetchBookings();

      // Auto-open rating modal when ride is completed
      if (data?.status && data.status.toUpperCase() === 'COMPLETED') {
        // Find the booking in current state to get the name
        setBookings(prev => {
          const completedBooking = prev.find(b => b.id === data.bookingId);
          if (completedBooking) {
            setRatingModal({
              isOpen: true,
              type: viewAs === 'passenger' ? 'passenger_rating_driver' : 'driver_rating_passenger',
              name: viewAs === 'passenger'
                ? (completedBooking.driver?.name || 'Driver')
                : (completedBooking.passenger?.name || 'Passenger'),
              avatar: viewAs === 'passenger'
                ? (completedBooking.driver?.avatar || undefined)
                : (completedBooking.passenger?.avatar || undefined),
              bookingId: completedBooking.id,
            });
          }
          return prev;
        });
      }
    };

    // On reconnect, re-fetch all data to reconcile missed events
    const handleConnect = () => {
      console.log('[Bookings] Socket reconnected — re-fetching data');
      fetchBookings();
      // fetchMyOfferedRides is no longer needed for driver tab rendering
      // (driver tabs now use bookings state). Keep only if published ride
      // management is used elsewhere.
    };

    socket.on('booking:new', handleBookingNew);
    socket.on('booking:update', handleBookingUpdate);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('booking:new', handleBookingNew);
      socket.off('booking:update', handleBookingUpdate);
      socket.off('connect', handleConnect);
    };
  }, [socket, viewAs, fetchBookings, fetchMyOfferedRides]);

  // ── Start / Complete ride handlers ───────────────────────────────────────────
  const handleStartRide = async (rideId: string) => {
    try {
      const result = await bookingService.startRide(rideId);
      if (result.success) {
        toast.success(`Ride started! OTP: ${result.data?.otpCode || result.otpCode || ''}`);
        fetchBookings();
        fetchMyOfferedRides();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to start ride");
    }
  };

  const handleCompleteRide = async (rideId: string) => {
    try {
      const result = await bookingService.endRide(rideId);
      if (result.success) {
        toast.success("Ride completed successfully!");
        fetchBookings();
        fetchMyOfferedRides();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to complete ride");
    }
  };

  const handleVerifyOTP = (bookingId: string) => {
    setOtpModal({ isOpen: true, bookingId });
  };

  const handleOTPVerified = () => {
    fetchBookings();
    setOtpModal({ isOpen: false, bookingId: "" });
  };

  const handleOpenChat = (booking: any) => {
    const rideIdRaw = booking.rideId;
    const rideId = typeof rideIdRaw === 'string'
      ? rideIdRaw
      : (rideIdRaw?.id || rideIdRaw?._id || booking.id);
    if (rideId) {
      sessionStorage.setItem('chatOpenRideId', rideId);
    }
    router.push('/chat');
  };

  // Map booking status to a valid TrackRide status key
  const toTrackStatus = (bookingStatus: string): "accepted" | "on_the_way" | "arrived" | "in_progress" | "completed" => {
    const s = (bookingStatus || '').toLowerCase();
    if (s === 'ongoing' || s === 'started') return 'in_progress';
    if (s === 'otp_verified') return 'accepted';
    if (s === 'completed') return 'completed';
    if (s === 'on_the_way') return 'on_the_way';
    if (s === 'arrived') return 'arrived';
    return 'accepted'; // safe fallback
  };

  useEffect(() => {
    fetchBookings();
    if (viewAs === "driver") {
      fetchMyOfferedRides();
    }
  }, [viewAs]);

  // ── Client-side filter: hide rejected bookings older than 1 hour ─────────────
  const filterRejectedBookings = (bookingList: any[]) => {
    const nowSeconds = Date.now() / 1000;
    return bookingList.filter(b => {
      const s = (b.status || '').toLowerCase();
      if (s !== 'rejected') return true;
      // Keep if updatedAt is within the last 3600 seconds
      const updatedAt = b.updatedAt
        ? (typeof b.updatedAt === 'string'
            ? new Date(b.updatedAt).getTime() / 1000
            : b.updatedAt)
        : 0;
      return nowSeconds - updatedAt < 3600;
    });
  };

  // ── Filtered bookings (passenger view) ──────────────────────────────────────
  const filteredBookings = filterRejectedBookings(bookings).filter(b => {
    const s = (b.status || '').toLowerCase();
    if (activeTab === "requests") return s === "pending";
    if (activeTab === "upcoming") return [
      "accepted", "payment_done", "otp_verified",
      "on_the_way", "arrived", "in_progress", "ongoing"
    ].includes(s);
    if (activeTab === "completed") return s === "completed" || s === "cancelled";
    return true;
  });

  // ── Tab counts ───────────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string; count: number }[] = [
    {
      id: "requests",
      label: "Requests",
      count: viewAs === "driver"
        ? driverPendingBookings.length
        : bookings.filter(b => (b.status || '').toLowerCase() === "pending").length,
    },
    {
      id: "upcoming",
      label: "Upcoming",
      count: viewAs === "driver"
        ? driverUpcomingBookings.length
        : bookings.filter(b => [
            "accepted", "payment_done", "otp_verified",
            "on_the_way", "arrived", "in_progress", "ongoing"
          ].includes((b.status || '').toLowerCase())).length,
    },
    {
      id: "completed",
      label: "Completed",
      count: viewAs === "driver"
        ? driverCompletedBookings.length
        : bookings.filter(b => ["completed", "cancelled"].includes((b.status || '').toLowerCase())).length,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Bookings</h1>

        <div className="flex p-1 bg-gray-100 rounded-2xl w-fit shadow-sm">
          <button
            onClick={() => setViewAs("passenger")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              viewAs === "passenger"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            As Passenger
          </button>
          <button
            onClick={() => setViewAs("driver")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              viewAs === "driver"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            As Driver
          </button>
        </div>
      </div>


      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-full overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-200 text-gray-600"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* ── REQUESTS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">
                {viewAs === "passenger" ? "Ride Requests Sent" : "Incoming Ride Requests"}
              </h2>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-48 rounded-3xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    type={viewAs}
                    booking={booking}
                    showStatusStepper
                    onActionSuccess={fetchBookings}
                    onViewDetails={() => setDetailsModal({ isOpen: true, booking })}
                  />
                ))
              ) : (
                <EmptyState message={viewAs === "passenger" ? "No pending requests" : "No incoming requests"} />
              )}
            </div>
          )}

          {/* ── UPCOMING TAB ─────────────────────────────────────────────────── */}
          {activeTab === "upcoming" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">
                {viewAs === "driver" ? "My Offered Rides" : "Confirmed Rides"}
              </h3>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-48 rounded-3xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : viewAs === "driver" ? (
                driverUpcomingBookings.length > 0 ? (
                  driverUpcomingBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      type="driver"
                      booking={booking}
                      showStatusStepper
                      onActionSuccess={fetchBookings}
                      onStartRide={() => handleStartRide(
                        typeof booking.rideId === 'string' ? booking.rideId : (booking.rideId?.id || booking.rideId?._id || booking.id)
                      )}
                      onCompleteRide={() => handleCompleteRide(
                        typeof booking.rideId === 'string' ? booking.rideId : (booking.rideId?.id || booking.rideId?._id || booking.id)
                      )}
                      onTrack={() => setTrackRide({ isVisible: true, booking, status: toTrackStatus(booking.status) })}
                      onChat={() => handleOpenChat(booking)}
                    />
                  ))
                ) : (
                  <EmptyState message="No active rides. Accept a booking request to get started!" />
                )
              ) : filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    type={viewAs}
                    booking={booking}
                    showStatusStepper
                    onTrack={() => setTrackRide({ isVisible: true, booking, status: toTrackStatus(booking.status) })}
                    onActionSuccess={fetchBookings}
                    onVerifyOTP={() => handleVerifyOTP(booking.id)}
                    onPayNow={() => setPaymentModal({ isOpen: true, booking })}
                    onViewDetails={() => setDetailsModal({ isOpen: true, booking })}
                    onChat={() => handleOpenChat(booking)}
                  />
                ))
              ) : (
                <EmptyState message="No upcoming rides found" />
              )}
            </div>
          )}

          {/* ── COMPLETED TAB ────────────────────────────────────────────────── */}
          {activeTab === "completed" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Ride History</h2>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-48 rounded-3xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : viewAs === "driver" ? (
                // Driver: show booking requests that are done/cancelled/rejected
                driverCompletedBookings.length > 0 ? (
                  driverCompletedBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      type="driver"
                      booking={booking}
                      showStatusStepper
                      onRate={
                        (booking.status || '').toLowerCase() === 'completed'
                          ? () => setRatingModal({
                              isOpen: true,
                              type: "driver_rating_passenger",
                              name: booking.passenger?.name || 'Passenger',
                              avatar: booking.passenger?.avatar || undefined,
                              bookingId: booking.id,
                            })
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <EmptyState message="No ride history found" />
                )
              ) : (
                // Passenger: show their booking history sorted newest-first
                (() => {
                  const sortedCompleted = [...filteredBookings].sort((a, b) => {
                    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
                    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                    return bTime - aTime;
                  });
                  return sortedCompleted.length > 0 ? (
                    sortedCompleted.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        type={viewAs}
                        booking={booking}
                        onRate={
                          (booking.status || '').toLowerCase() === 'completed'
                            ? () => setRatingModal({
                                isOpen: true,
                                type: "passenger_rating_driver",
                                name: booking.driver?.name || 'Driver',
                                avatar: booking.driver?.avatar || undefined,
                                bookingId: booking.id,
                              })
                            : undefined
                        }
                      />
                    ))
                  ) : (
                    <EmptyState message="No ride history found" />
                  );
                })()
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <BookingRatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ ...ratingModal, isOpen: false })}
        type={ratingModal.type}
        name={ratingModal.name}
        avatar={ratingModal.avatar}
        bookingId={ratingModal.bookingId}
      />

      {trackRide.booking && (
        <TrackRide
          ride={{
            id: trackRide.booking.id,
            driver: {
              name: trackRide.booking.driver?.name || 'Driver',
              avatar: trackRide.booking.driver?.avatar || '',
              phone: "+91 98765 43210",
              rating: 4.8,
              vehicle: {
                model: "Maruti Swift",
                number: "KA 01 AB 1234",
                color: "White"
              }
            },
            pickup: typeof trackRide.booking.pickup === 'string' ? trackRide.booking.pickup : trackRide.booking.pickup?.name || 'Unknown',
            drop: typeof trackRide.booking.drop === 'string' ? trackRide.booking.drop : trackRide.booking.drop?.name || 'Unknown',
            time: trackRide.booking.time,
            date: trackRide.booking.date,
            price: trackRide.booking.price,
            otp: trackRide.booking.otpCode || "4521"
          }}
          status={trackRide.status}
          isVisible={trackRide.isVisible}
          onClose={() => {
            setTrackRide({ ...trackRide, isVisible: false });
            setIsRideActive(false);
          }}
          onSOS={() => setIsRideActive(true)}
          showSOS={true}
        />
      )}

      {/* OTP Verification Modal */}
      <OTPModal
        isOpen={otpModal.isOpen}
        onClose={() => setOtpModal({ ...otpModal, isOpen: false })}
        bookingId={otpModal.bookingId}
        onVerified={handleOTPVerified}
      />

      {/* Payment Modal */}
      {paymentModal.booking && (
        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false, booking: null })}
          booking={{
            id: paymentModal.booking.id,
            pricePerSeat: paymentModal.booking.pricePerSeat ?? paymentModal.booking.price ?? 0,
            seatsBooked: paymentModal.booking.seatsBooked ?? paymentModal.booking.seats ?? paymentModal.booking.passengersCount ?? 1,
            pickup: typeof paymentModal.booking.pickup === 'string'
              ? paymentModal.booking.pickup
              : paymentModal.booking.pickup?.name || 'Unknown',
            drop: typeof (paymentModal.booking.drop || paymentModal.booking.dropoff) === 'string'
              ? (paymentModal.booking.drop || paymentModal.booking.dropoff)
              : (paymentModal.booking.drop?.name || paymentModal.booking.dropoff?.name || 'Unknown'),
          }}
          onPaymentSuccess={() => {
            setPaymentModal({ isOpen: false, booking: null });
            fetchBookings();
          }}
        />
      )}

      <SosButton isVisible={isRideActive} />

      {/* Booking Details Modal */}
      {detailsModal.isOpen && detailsModal.booking && (
        <BookingDetailsModal
          booking={detailsModal.booking}
          onClose={() => setDetailsModal({ isOpen: false, booking: null })}
        />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm"
    >
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        <AlertCircle size={32} className="text-gray-300" />
      </div>
      <p className="text-gray-500 font-bold">{message}</p>
    </motion.div>
  );
}

function BookingDetailsModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const status = (booking.status || '').toLowerCase();
  const pricePerSeat = booking.pricePerSeat ?? booking.price ?? 0;
  const seats = booking.seatsBooked ?? booking.seats ?? booking.passengersCount ?? 1;
  const platformFee = booking.platformFee ?? Math.round(pricePerSeat * seats * 0.05);
  const total = booking.totalAmount ?? (pricePerSeat * seats + platformFee);

  const pickup = typeof booking.pickup === 'string'
    ? booking.pickup
    : booking.pickup?.name || booking.pickup?.address || 'Unknown';
  const drop = typeof (booking.drop || booking.dropoff) === 'string'
    ? (booking.drop || booking.dropoff)
    : (booking.drop?.name || booking.dropoff?.name || booking.drop?.address || booking.dropoff?.address || 'Unknown');

  const driverName = booking.driver?.name || booking.driverId?.name || null;
  const driverRating = booking.driver?.rating ?? booking.driverId?.rating ?? null;
  const passengerName = booking.passenger?.name || booking.passengerId?.name || null;
  const passengerRating = booking.passenger?.rating ?? booking.passengerId?.rating ?? null;

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    accepted: 'bg-blue-50 text-blue-600 border-blue-100',
    payment_done: 'bg-amber-50 text-amber-700 border-amber-200',
    otp_verified: 'bg-teal-50 text-teal-600 border-teal-100',
    ongoing: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    cancelled: 'bg-red-50 text-red-500 border-red-100',
    rejected: 'bg-gray-50 text-gray-500 border-gray-100',
  };
  const statusColor = statusColors[status] || 'bg-gray-50 text-gray-600 border-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Status + Booking ID */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColor}`}>
              {booking.status || 'Unknown'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              #{(booking.id || '').slice(-8).toUpperCase()}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-start gap-3">
            <div className="mt-1 flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <div className="w-0.5 h-10 bg-gray-100" />
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Pickup</p>
                <p className="text-sm font-semibold text-gray-800">{pickup}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Drop</p>
                <p className="text-sm font-semibold text-gray-800">{drop}</p>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <Clock size={16} className="text-gray-400 shrink-0" />
            <p className="text-xs font-bold text-gray-700">
              {booking.date || (booking.rideTime ? new Date(booking.rideTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')}
              {' • '}
              {booking.time || (booking.rideTime ? new Date(booking.rideTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—')}
            </p>
          </div>

          {/* Price Breakdown */}
          <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-3">Price Breakdown</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹{pricePerSeat} × {seats} seat{seats > 1 ? 's' : ''}</span>
              <span className="font-bold text-gray-800">₹{pricePerSeat * seats}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Platform fee</span>
              <span className="font-bold text-gray-800">₹{platformFee}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="font-black text-gray-900">Total</span>
              <span className="font-black text-gray-900">₹{total}</span>
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-2 gap-3">
            {driverName && (
              <div className="p-3 bg-blue-50 rounded-2xl">
                <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-1">Driver</p>
                <p className="text-sm font-bold text-blue-800">{driverName}</p>
                {driverRating !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={10} className="text-amber-400 fill-current" />
                    <span className="text-[10px] text-blue-600 font-bold">{driverRating}</span>
                  </div>
                )}
              </div>
            )}
            {passengerName && (
              <div className="p-3 bg-purple-50 rounded-2xl">
                <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-1">Passenger</p>
                <p className="text-sm font-bold text-purple-800">{passengerName}</p>
                {passengerRating !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={10} className="text-amber-400 fill-current" />
                    <span className="text-[10px] text-purple-600 font-bold">{passengerRating}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
