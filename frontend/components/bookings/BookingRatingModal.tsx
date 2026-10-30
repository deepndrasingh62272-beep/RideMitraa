"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ThumbsUp, X, Check } from "lucide-react";
import { toast } from "sonner";
import bookingService from "@/src/services/bookingService";

interface BookingRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "passenger_rating_driver" | "driver_rating_passenger";
  name: string;
  avatar?: string;
  bookingId?: string;
}

export default function BookingRatingModal({
  isOpen,
  onClose,
  type,
  name,
  avatar,
  bookingId
}: BookingRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isPassengerRating = type === "passenger_rating_driver";
  const title = isPassengerRating ? "Rate Your Driver" : "Rate Your Passenger";
  const avatarUrl = (avatar && avatar.trim() !== '')
    ? avatar
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  const quickTags = isPassengerRating ? [
    "Safe Driving", "Clean Vehicle", "Friendly", "On Time", "Good Route", "Professional"
  ] : [
    "Polite", "On Time", "Clean", "Friendly", "Good Communication", "Respectful"
  ];

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!bookingId) {
      toast.error("Booking ID is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bookingService.rateBooking(bookingId, rating, comment);
      if (result.success) {
        setIsSubmitted(true);
        toast.success(isPassengerRating ? "Driver rated successfully!" : "Passenger rated successfully!");
        
        setTimeout(() => {
          onClose();
          setRating(0);
          setComment("");
          setIsSubmitted(false);
        }, 2000);
      } else {
        toast.error("Failed to submit rating");
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {!isSubmitted ? (
              <>
                <div className="p-6 pb-0">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-gray-900">{title}</h2>
                    <button
                      onClick={onClose}
                      className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center mb-6">
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-20 h-20 rounded-3xl object-cover border-4 border-gray-100 shadow-lg mb-4"
                    />
                    <h3 className="text-lg font-bold text-gray-900">{name}</h3>
                    <p className="text-sm text-gray-500 mt-3">How was your trip?</p>
                  </div>
                </div>

                <div className="px-6 pb-4">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="focus:outline-none"
                      >
                        <Star
                          size={40}
                          className={`transition-all duration-200 ${
                            star <= (hoverRating || rating)
                              ? "fill-amber-400 text-amber-400 scale-110"
                              : "text-gray-200 hover:text-amber-200"
                          }`}
                        />
                      </motion.button>
                    ))}
                  </div>

                  {rating > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm font-bold text-amber-600 mb-4"
                    >
                      {rating === 5 ? "Excellent! 🌟" :
                       rating === 4 ? "Very Good! 👍" :
                       rating === 3 ? "Good 👍" :
                       rating === 2 ? "Could be better" :
                       "Poor 😞"}
                    </motion.p>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {quickTags.map((tag) => (
                      <button
                        key={tag}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Comments (Optional)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={rating === 0 || isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp size={20} />
                        Submit Rating
                      </>
                    )}
                  </motion.button>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <Check size={48} className="text-emerald-600" />
                </motion.div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">Thank You!</h3>
                <p className="text-gray-500">Your feedback helps improve our community</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}