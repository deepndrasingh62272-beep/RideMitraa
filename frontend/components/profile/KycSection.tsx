"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, Upload, Camera, CheckCircle2, Clock, AlertTriangle,
  FileText, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/src/services/apiClient";

interface KycSectionProps {
  status: "verified" | "pending" | "not_verified";
  onStatusChange?: (status: string) => void;
}

export default function KycSection({ status: initialStatus, onStatusChange }: KycSectionProps) {
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [preview, setPreview] = useState<{ front?: string; back?: string; selfie?: string }>({});

  // Fetch KYC status on mount
  useEffect(() => {
    const fetchKycStatus = async () => {
      try {
        const response = await apiClient.get('/kyc/verification-status');
        const kycStatus = response.data?.kycStatus || response.data?.status;
        if (kycStatus === 'APPROVED') {
          setStatus('verified');
        } else if (kycStatus === 'PENDING') {
          setStatus('pending');
        } else {
          setStatus('not_verified');
        }
      } catch (error) {
        console.error('Error fetching KYC status:', error);
      }
    };
    fetchKycStatus();
  }, []);

  const getStatusConfig = (s: string) => {
    switch (s) {
      case "verified":
        return {
          color: "bg-emerald-50 text-emerald-600 border-emerald-100",
          icon: CheckCircle2,
          label: "Verified",
          description: "Your identity has been verified. You can offer rides."
        };
      case "pending":
        return {
          color: "bg-amber-50 text-amber-600 border-amber-100",
          icon: Clock,
          label: "Under Review",
          description: "Your documents are being reviewed. This usually takes 24-48 hours."
        };
      default:
        return {
          color: "bg-red-50 text-red-600 border-red-100",
          icon: AlertTriangle,
          label: "Not Verified",
          description: "Complete your KYC to start offering rides."
        };
    }
  };

  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setState: React.Dispatch<React.SetStateAction<File | null>>,
    previewKey: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setState(file);
      const url = URL.createObjectURL(file);
      setPreview(prev => ({ ...prev, [previewKey]: url }));
    }
  };

  const handleSubmit = async () => {
    if (!aadhaarFront || !aadhaarBack || !selfie) {
      toast.error("Please upload all required documents");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('drivingLicense', aadhaarFront);
      formData.append('govtId', aadhaarBack);
      formData.append('selfie', selfie);

      // DO NOT set Content-Type manually — Axios sets it with the correct multipart boundary
      const response = await apiClient.post('/kyc/photo-verify', formData);

      if (response.status === 200) {
        toast.success("KYC documents submitted successfully!");
        setStatus('pending');
        onStatusChange?.('pending');
        setAadhaarFront(null);
        setAadhaarBack(null);
        setSelfie(null);
        setPreview({});
      }
    } catch (error: any) {
      console.error('KYC upload error:', error);
      toast.error(error?.response?.data?.error || "Failed to upload KYC documents");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.color.split(' ')[0]}`}>
              <StatusIcon size={24} className={config.color.split(' ')[1]} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Identity Verification</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.color}`}>
                  {config.label}
                </span>
              </div>
            </div>
          </div>
          <Shield size={24} className="text-blue-600" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {status === "not_verified" ? (
          <>
            {/* Upload Instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6">
              <h4 className="font-black text-gray-900 mb-3">Required Documents</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Aadhaar Card</p>
                    <p className="text-xs text-gray-500">Upload front and back side</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Selfie Verification</p>
                    <p className="text-xs text-gray-500">Take a clear photo of yourself</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Document Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Aadhaar Front */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Aadhaar Front</label>
                <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                  {preview.front ? (
                    <img src={preview.front} alt="Aadhaar Front" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Upload size={24} className="mb-2 group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-medium">Upload</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setAadhaarFront, 'front')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Aadhaar Back */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Aadhaar Back</label>
                <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                  {preview.back ? (
                    <img src={preview.back} alt="Aadhaar Back" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Upload size={24} className="mb-2 group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-medium">Upload</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setAadhaarBack, 'back')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Selfie</label>
                <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                  {preview.selfie ? (
                    <img src={preview.selfie} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Camera size={24} className="mb-2 group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-medium">Capture</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => handleFileChange(e, setSelfie, 'selfie')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={isSubmitting || !aadhaarFront || !aadhaarBack || !selfie}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FileText size={20} />
                  Submit KYC Documents
                </>
              )}
            </motion.button>
          </>
        ) : status === "pending" ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock size={40} className="text-amber-600" />
            </div>
            <h4 className="text-lg font-black text-gray-900 mb-2">Verification In Progress</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">{config.description}</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h4 className="text-lg font-black text-gray-900 mb-2">Identity Verified</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">{config.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
