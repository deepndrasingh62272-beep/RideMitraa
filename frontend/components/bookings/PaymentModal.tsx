"use client";

import React, { useState } from "react";
import { X, CheckCircle, CreditCard, Wallet, Smartphone, Banknote } from "lucide-react";
import { confirmPayment } from "@/src/services/bookingService";
import { toast } from "sonner";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    pricePerSeat: number;
    seatsBooked: number;
    pickup?: string;
    drop?: string;
  };
  onPaymentSuccess: () => void;
}

type PaymentMethod = "CASH" | "UPI" | "CARD" | "WALLET";
type ModalStep = "SELECT" | "SUCCESS";

const PLATFORM_FEE_PERCENT = 0.05;

const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "CASH", label: "Cash", icon: <Banknote className="w-5 h-5" />, description: "Pay directly to driver" },
  { id: "UPI", label: "UPI", icon: <Smartphone className="w-5 h-5" />, description: "GPay, PhonePe, Paytm" },
  { id: "CARD", label: "Card", icon: <CreditCard className="w-5 h-5" />, description: "Debit / Credit card" },
  { id: "WALLET", label: "Wallet", icon: <Wallet className="w-5 h-5" />, description: "RideMitra wallet" },
];

export default function PaymentModal({ isOpen, onClose, booking, onPaymentSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [step, setStep] = useState<ModalStep>("SELECT");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const subtotal = booking.pricePerSeat * booking.seatsBooked;
  const platformFee = parseFloat((subtotal * PLATFORM_FEE_PERCENT).toFixed(2));
  const grandTotal = parseFloat((subtotal + platformFee).toFixed(2));

  const handlePayNow = async () => {
    if (isProcessing) return;
    // Immediately show success screen (dummy payment — no real gateway)
    setStep("SUCCESS");

    // After 1500ms, call backend to confirm payment and close
    setTimeout(async () => {
      setIsProcessing(true);
      try {
        await confirmPayment(booking.id);
        onPaymentSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Payment confirmation failed. Please try again.");
        // Stay on SUCCESS screen — user can retry by reopening
      } finally {
        setIsProcessing(false);
        setStep("SELECT");
      }
    }, 1500);
  };

  const handleClose = () => {
    if (step === "SUCCESS") return; // Don't allow close during processing
    setStep("SELECT");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {step === "SUCCESS" ? (
          /* ── Success Screen ── */
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful ✓</h2>
            <p className="text-gray-500 text-sm">Confirming your booking…</p>
          </div>
        ) : (
          /* ── Payment Selection Screen ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">Complete Payment</h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Fare Breakdown */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Fare Breakdown</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    ₹{booking.pricePerSeat} × {booking.seatsBooked} seat{booking.seatsBooked > 1 ? "s" : ""}
                  </span>
                  <span className="font-bold text-gray-900">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform fee (5%)</span>
                  <span className="font-semibold text-gray-700">₹{platformFee}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-xl font-black text-blue-600">₹{grandTotal}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Method</h3>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                        selectedMethod === method.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      <span className={selectedMethod === method.id ? "text-blue-600" : "text-gray-400"}>
                        {method.icon}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${selectedMethod === method.id ? "text-blue-700" : "text-gray-700"}`}>
                          {method.label}
                        </p>
                        <p className="text-[10px] text-gray-400">{method.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={handlePayNow}
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-base transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Pay ₹{grandTotal} via {paymentMethods.find((m) => m.id === selectedMethod)?.label}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
