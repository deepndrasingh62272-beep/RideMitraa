"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import userService from "@/src/services/userService";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onSave: (updated: any) => void;
}

export default function EditProfileModal({ isOpen, onClose, profile, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    
    // Show preview immediately
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Upload to backend
    try {
      toast.loading("Uploading photo...");
      const result = await userService.uploadProfilePhoto(file);
      
      if (result.success) {
        setFormData({ ...formData, avatar: result.data.profilePhoto || result.data.avatar });
        toast.dismiss();
        toast.success("Photo uploaded!");
      } else {
        toast.dismiss();
        toast.error("Failed to upload photo");
      }
    } catch (error) {
      toast.dismiss();
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo. Please try again.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update name/email (avatar already uploaded when selected)
      const result = await userService.updateProfile({
        name: formData.name,
        email: formData.email,
      });
      
      if (result.success) {
        // Include avatar in saved data
        onSave({ 
          ...formData, 
          ...result.data,
          avatar: formData.avatar || result.data.profilePhoto || result.data.avatar 
        });
        toast.success("Profile updated successfully!");
        onClose();
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
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
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">Edit Profile</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <img
                    src={previewUrl || formData.avatar}
                    alt={formData.name}
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-gray-100 shadow-lg"
                  />
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    <Camera size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline cursor-pointer">
                  <Upload size={16} />
                  Upload New Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 font-medium"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={20} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
