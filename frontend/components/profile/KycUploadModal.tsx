"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Camera, Check, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/src/services/apiClient";

interface KycUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export default function KycUploadModal({ isOpen, onClose, onSubmit }: KycUploadModalProps) {
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ front?: string; back?: string; selfie?: string }>({});

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
      toast.success("Document uploaded!");
    }
  };

  const handleSubmit = async () => {
    if (!aadhaarFront || !aadhaarBack || !selfie) {
      toast.error("Please upload all documents");
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
        toast.success("KYC submitted successfully! Verification in progress.");
        onSubmit();
        onClose();
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

  const isComplete = aadhaarFront && aadhaarBack && selfie;

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
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Upload KYC Documents</h2>
                  <p className="text-xs text-gray-500">Complete verification to post rides</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <h3 className="font-bold text-gray-900 mb-2">Required Documents</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-500" />
                    Aadhaar Card (Front & Back)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-500" />
                    Selfie with Aadhaar
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Aadhaar Front</label>
                  <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                    {preview.front ? (
                      <img src={preview.front} alt="Aadhaar Front" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500">
                        <Upload size={32} className="mb-2" />
                        <span className="text-sm font-medium">Upload Front</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setAadhaarFront, 'front')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {aadhaarFront && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={14} /> Uploaded
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Aadhaar Back</label>
                  <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                    {preview.back ? (
                      <img src={preview.back} alt="Aadhaar Back" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500">
                        <Upload size={32} className="mb-2" />
                        <span className="text-sm font-medium">Upload Back</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setAadhaarBack, 'back')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {aadhaarBack && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={14} /> Uploaded
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Selfie with Aadhaar</label>
                  <div className="relative aspect-[3/2] rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group">
                    {preview.selfie ? (
                      <img src={preview.selfie} alt="Selfie" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500">
                        <Camera size={32} className="mb-2" />
                        <span className="text-sm font-medium">Capture Selfie</span>
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
                  {selfie && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={14} /> Uploaded
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Your documents will be verified within 24-48 hours. You can still offer rides once verified.
                </p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <motion.button
                whileHover={{ scale: isComplete ? 1.02 : 1 }}
                whileTap={{ scale: isComplete ? 0.98 : 1 }}
                onClick={handleSubmit}
                disabled={!isComplete || isSubmitting}
                className={`w-full py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isComplete
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Submit KYC
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}