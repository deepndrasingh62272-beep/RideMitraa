"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Clock, MapPin, Check, X, MessageSquare, 
  Phone, Map, ChevronRight, User
} from "lucide-react";

interface BookingCardProps {
  type: "passenger" | "driver";
  status: "pending" | "accepted" | "on_the_way" | "completed";
  booking: any;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function BookingCard({ type, status, booking, onAccept, onReject }: BookingCardProps) {
  const getStatusColor = (s: string) => {
    switch (s) {
      case "pending": return "text-amber-600 bg-amber-50 border-amber-100";
      case "accepted": return "text-blue-600 bg-blue-50 border-blue-100";
      case "on_the_way": return "text-indigo-600 bg-indigo-50 border-indigo-100";
      case "completed": return "text-green-600 bg-green-50 border-green-100";
      default: return "text-gray-400 bg-gray-50 border-gray-100";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-3xl p-6 hover:border-gray-200 transition-all group shadow-sm hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
            {type === "passenger" ? (
              <img src={booking.driver.avatar} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-gray-900 font-bold">
              {type === "passenger" ? booking.driver.name : booking.passenger.name}
            </h3>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${getStatusColor(status)}`}>
              {status.replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-lg font-black text-gray-900">₹{booking.totalPrice}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{booking.seats} Seats</span>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-0.5 h-6 bg-gray-100" />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-xs text-gray-600 font-bold line-clamp-1">
              {typeof booking.pickup === 'string' ? booking.pickup : booking.pickup?.name || 'Unknown'}
            </p>
            <p className="text-xs text-gray-600 font-bold line-clamp-1">
              {typeof booking.drop === 'string' ? booking.drop : booking.drop?.name || 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {type === "passenger" ? (
        <div className="grid grid-cols-2 gap-3">
          {status === "pending" ? (
            <button className="col-span-2 py-3 rounded-2xl bg-gray-50 hover:bg-pink-50 text-pink-600 text-sm font-bold transition-all border border-gray-100 hover:border-pink-100">
              Cancel Request
            </button>
          ) : (
            <>
              <button className="py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold transition-all border border-gray-100 flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button className="py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold transition-all border border-gray-100 flex items-center justify-center gap-2">
                <Map className="w-4 h-4" />
                Track
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {status === "pending" ? (
            <>
              <button 
                onClick={onReject}
                className="py-3 rounded-2xl bg-gray-50 hover:bg-pink-50 text-pink-600 text-sm font-bold transition-all border border-gray-100 hover:border-pink-100 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button 
                onClick={onAccept}
                className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
            </>
          ) : (
            <button className="col-span-2 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold transition-all border border-gray-100 flex items-center justify-center gap-2">
              <Phone className="w-4 h-4" />
              Contact Passenger
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
