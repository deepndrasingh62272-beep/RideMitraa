"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, Star, Shield, AlertTriangle,
  CheckCircle2, Clock, X, Camera, Upload, ChevronRight,
  Plus, Trash2, Heart, MessageSquare, Phone as PhoneIcon, FileText
} from "lucide-react";
import EditProfileModal from "./EditProfileModal";
import KycSection from "./KycSection";
import EmergencyContacts from "./EmergencyContacts";
import RatingModal from "./RatingModal";
import RatingList from "./RatingList";
import KycUploadModal from "./KycUploadModal";
import { toast } from "sonner";
import userService from "@/src/services/userService";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchProfile();
  }, []);

  const fetchRatings = async (userId: string) => {
    try {
      const result = await userService.getUserRatings(userId, 1, 10);
      if (result.success && result.data.ratings) {
        // Transform backend ratings to frontend Review interface
        const transformedRatings = result.data.ratings.map((rating: any) => ({
          id: rating._id || rating.id,
          reviewerName: rating.raterId?.name || 'Anonymous',
          rating: rating.score,
          comment: rating.comment || 'No comment',
          date: new Date(rating.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          tripType: rating.role === 'PASSENGER' ? 'Passenger' : 'Driver'
        }));
        setRatings(transformedRatings);
      }
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
    }
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const result = await userService.getProfile();
      if (result.success) {
        // Ensure all required fields with defaults from API
        const profileData = {
          name: result.data.name || 'User',
          email: result.data.email || '',
          phone: result.data.phone || '',
          avatar: result.data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.data.name || 'U'}`,
          rating: result.data.rating || 0,
          totalReviews: result.data.totalReviews || result.data.totalRatings || 0,
          isKycVerified: result.data.kycStatus === 'APPROVED' || result.data.kycStatus === 'verified',
          kycStatus: result.data.kycStatus || 'not_verified',
          walletBalance: result.data.walletBalance || 0,
          ...result.data
        };
        setProfile(profileData);
        // Fetch ratings after profile is loaded
        if (result.data._id || result.data.id) {
          fetchRatings(result.data._id || result.data.id);
        }
      } else {
        toast.error('Failed to fetch profile');
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      toast.error('Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  };

  const getKycStatusConfig = (status: string) => {
    switch (status) {
      case "verified":
        return {
          color: "bg-emerald-50 text-emerald-600 border-emerald-100",
          icon: CheckCircle2,
          label: "Verified",
          bgGlow: "bg-emerald-500/10"
        };
      case "pending":
        return {
          color: "bg-amber-50 text-amber-600 border-amber-100",
          icon: Clock,
          label: "Pending",
          bgGlow: "bg-amber-500/10"
        };
      default:
        return {
          color: "bg-red-50 text-red-600 border-red-100",
          icon: AlertTriangle,
          label: "Not Verified",
          bgGlow: "bg-red-500/10"
        };
    }
  };

  // Loading state
  if (!profile || isLoading) {
    return (
      <div className="space-y-8">
        {/* Profile Header Skeleton */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative" />
          <div className="px-8 pb-8 -mt-16 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* Stats Skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-6 text-center shadow-sm">
              <div className="w-12 h-12 bg-gray-200 rounded-2xl mx-auto mb-3 animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded mx-auto mb-2 animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded mx-auto animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const kycConfig = getKycStatusConfig(profile.kycStatus);
  const KycIcon = kycConfig.icon;

  return (
    <div className="space-y-8">
      {isMounted ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            </div>
          </div>

          <div className="px-8 pb-8 -mt-16 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="relative">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl object-cover"
                />
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition-colors"
                >
                  <Camera size={18} />
                </button>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black text-gray-900">{profile.name}</h1>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${kycConfig.color}`}>
                    <KycIcon size={14} />
                    <span className="text-xs font-bold">{kycConfig.label}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span>{profile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} />
                    <span>{profile.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={18}
                        className={star <= Math.round(profile.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-900">{profile.rating}</span>
                  <span className="text-sm text-gray-400">({profile.totalReviews} reviews)</span>
                </div>
              </div>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
                suppressHydrationWarning
              >
                Edit Profile
              </button>
              {profile.kycStatus !== "verified" && (
                <button
                  onClick={() => setIsKycModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg flex items-center gap-2"
                  suppressHydrationWarning
                >
                  <FileText size={18} />
                  Upload KYC
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative" />
          <div className="px-8 pb-8 -mt-16 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl bg-gray-200" />
              <div className="flex-1">
                <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-64 bg-gray-100 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-gray-100 p-6 text-center shadow-sm"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Star size={24} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{profile.rating || 0}</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Rating</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl border border-gray-100 p-6 text-center shadow-sm"
        >
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{profile.totalTrips || profile.trips || 0}</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Trips</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl border border-gray-100 p-6 text-center shadow-sm"
        >
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Heart size={24} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{profile.satisfactionRate || profile.completionRate || 0}%</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Satisfaction</p>
        </motion.div>
      </div>

      {/* KYC Section */}
      <motion.div
        id="kyc-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <KycSection status={profile.kycStatus as "verified" | "pending" | "not_verified"} />
      </motion.div>

      {/* Emergency Contacts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <EmergencyContacts />
      </motion.div>

      {/* Rating & Reviews - Click to rate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <RatingList
          averageRating={profile.rating}
          totalReviews={profile.totalReviews}
          reviews={ratings}
          onViewAll={() => setIsRatingModalOpen(true)}
        />
      </motion.div>

      {/* Modals */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={(updated) => setProfile({ ...profile, ...updated })}
      />

      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        type="driver"
        name={profile.name}
      />

      <KycUploadModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        onSubmit={() => {
          setProfile({ ...profile, kycStatus: "pending", isKycVerified: false });
          toast.success("KYC submitted! Status: Pending verification");
        }}
      />
    </div>
  );
}
