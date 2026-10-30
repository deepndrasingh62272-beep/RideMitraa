"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, ChevronRight } from "lucide-react";

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  date: string;
  tripType: string;
}

interface RatingListProps {
  averageRating: number;
  totalReviews: number;
  reviews?: Review[];
  isCompact?: boolean;
  onViewAll?: () => void;
}

export default function RatingList({
  averageRating,
  totalReviews,
  reviews = [],
  isCompact = false,
  onViewAll
}: RatingListProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const starSize = size === "sm" ? 14 : 18;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={starSize}
            className={star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}
          />
        ))}
      </div>
    );
  };

  if (isCompact) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Star size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Rating</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black text-gray-900">{averageRating}</p>
                  <span className="text-sm text-gray-400">/ 5</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{totalReviews}</p>
              <p className="text-xs text-gray-500">reviews</p>
            </div>
          </div>

          {onViewAll && isMounted && (
            <button
              onClick={onViewAll}
              className="w-full py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              View All Reviews
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Star size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Rating & Reviews</h3>
              <p className="text-xs text-gray-500">What passengers say about you</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-amber-700">{averageRating}</span>
            <span className="text-xs text-amber-600">({totalReviews})</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {reviews.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm">No reviews yet</p>
            <p className="text-xs text-gray-400 mt-1">Complete trips to get ratings from passengers</p>
          </div>
        ) : (
          reviews.slice(0, isCompact ? 2 : reviews.length).map((review, index) => (
            <div
              key={review.id}
              className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{review.reviewerName}</p>
                    <p className="text-[10px] text-gray-400">{review.date}</p>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-2">{review.comment}</p>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full">
                  {review.tripType}
                </span>
              </div>
            </div>
          ))
        )}

        {!isCompact && onViewAll && isMounted && reviews.length > 3 && (
          <button
            onClick={onViewAll}
            className="w-full py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            suppressHydrationWarning
          >
            View All {totalReviews} Reviews
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}