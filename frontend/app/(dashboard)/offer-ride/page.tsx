'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/offer-ride/ProgressBar';
import { Step1Location } from '@/components/offer-ride/Step1Location';
import { Step2DateTime } from '@/components/offer-ride/Step2DateTime';
import { Step3Vehicle } from '@/components/offer-ride/Step3Vehicle';
import { Step4Seats } from '@/components/offer-ride/Step4Seats';
import { Step5Pricing } from '@/components/offer-ride/Step5Pricing';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import rideService from '@/src/services/rideService';
import { geocodeAddress } from '@/src/services/mapService';

const INITIAL_DATA = {
  pickup: '',
  drop: '',
  pickupCoords: null as [number, number] | null,
  dropCoords: null as [number, number] | null,
  distance: null as number | null,
  date: '',
  time: '',
  vehicleType: 'car',
  vehicleName: '',
  vehicleModel: '',
  registrationNumber: '',
  fuelType: 'Petrol',
  mileage: '' as number | string,
  seats: 1,
  farePerSeat: 0,
};

export default function OfferRidePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateFormData = (fields: Partial<typeof INITIAL_DATA>) => {
    setFormData(prev => ({ ...prev, ...fields }));
  };

  const next = () => {
    if (currentStep < 5) {
      setCurrentStep(curr => curr + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const back = () => {
    if (currentStep > 1) {
      setCurrentStep(curr => curr - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return formData.pickup.trim().length > 0 && formData.drop.trim().length > 0;
      case 2: return formData.date !== '' && formData.time !== '';
      case 3: {
        const hasVehicleName = formData.vehicleName.trim() !== '';
        const hasVehicleModel = (formData.vehicleModel || '').trim() !== '';
        const hasRegistration = (formData.registrationNumber || '').trim() !== '';
        return hasVehicleName && hasVehicleModel && hasRegistration;
      }
      case 4: return formData.seats > 0;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    // Final validation
    if (!formData.registrationNumber || formData.registrationNumber.trim() === '') {
      toast.error('Vehicle number is required', {
        description: 'Please go back to Step 3 and enter your vehicle registration number.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Use coordinates from Step 1 (already geocoded)
      let pickupCoords = formData.pickupCoords;
      let dropCoords = formData.dropCoords;

      // If coordinates are not available, geocode them
      if (!pickupCoords) {
        try {
          const pickupResult = await geocodeAddress(formData.pickup);
          if (pickupResult?.data) {
            pickupCoords = [pickupResult.data.lng, pickupResult.data.lat];
          }
        } catch {
          toast.error('Could not geocode pickup location. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      if (!dropCoords) {
        try {
          const dropResult = await geocodeAddress(formData.drop);
          if (dropResult?.data) {
            dropCoords = [dropResult.data.lng, dropResult.data.lat];
          }
        } catch {
          toast.error('Could not geocode drop location. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      if (!pickupCoords || !dropCoords) {
        toast.error('Failed to get coordinates for the locations');
        setIsSubmitting(false);
        return;
      }

      // Determine the vehicle type enum for the backend
      const vehicleTypeMap: Record<string, 'CAR' | 'SEDAN' | 'SUV' | 'HATCHBACK' | 'BIKE' | 'AUTO' | 'VAN'> = {
        'car': 'CAR',
        'bike': 'BIKE',
        'sedan': 'SEDAN',
        'suv': 'SUV',
        'hatchback': 'HATCHBACK',
        'auto': 'AUTO',
        'van': 'VAN',
      };

      const backendVehicleType = vehicleTypeMap[formData.vehicleType.toLowerCase()] || 'CAR';

      // Seating capacity per vehicle type (must match SEAT_RULES on backend)
      const seatingCapacityMap: Record<string, number> = {
        'BIKE': 2,
        'AUTO': 3,
        'HATCHBACK': 5,
        'CAR': 5,
        'SEDAN': 5,
        'SUV': 7,
        'VAN': 9,
      };
      const seatingCapacity = seatingCapacityMap[backendVehicleType] ?? 5;

      const result = await rideService.publishRide({
        pickup: { 
          name: formData.pickup,
          address: formData.pickup,
          coordinates: pickupCoords,
        },
        dropoff: { 
          name: formData.drop,
          address: formData.drop,
          coordinates: dropCoords,
        },
        vehicle: {
          type: backendVehicleType,
          name: `${formData.vehicleName} ${formData.vehicleModel || ''}`.trim(),
          registrationNumber: formData.registrationNumber.trim().toUpperCase(),
          seatingCapacity: seatingCapacity,
          fuelType: formData.fuelType || 'Petrol',
          mileageKmPerLitre: formData.mileage ? Number(formData.mileage) : undefined,
        },
        schedule: { 
          date: formData.date, 
          time: formData.time,
        },
        farePerSeat: formData.farePerSeat || undefined,
      });
      
      if (result.success) {
        toast.success('Ride Published Successfully!', {
          description: `Your ride from ${formData.pickup} to ${formData.drop} is now live.`,
        });
        router.push('/dashboard');
      } else {
        toast.error('Failed to publish ride');
      }
    } catch (error: any) {
      console.error("Failed to publish ride:", error);
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to create ride';
      
      if (status === 401) {
        toast.error('Please login first', {
          description: 'You need to be logged in to publish a ride.',
        });
      } else if (status === 403) {
        toast.error('KYC Verification Required', {
          description: 'Please complete your KYC verification before publishing rides. Go to Profile → KYC.',
        });
      } else if (status === 400) {
        toast.error('Validation Error', {
          description: errorMsg,
        });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1Location data={formData} updateData={updateFormData} />;
      case 2: return <Step2DateTime data={formData} updateData={updateFormData} />;
      case 3: return <Step3Vehicle data={formData} updateData={updateFormData} />;
      case 4: return <Step4Seats data={formData} updateData={updateFormData} />;
      case 5: return <Step5Pricing data={formData} updateData={updateFormData} />;
      default: return null;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="max-w-4xl mx-auto pt-4 pb-20">
      <div className="mb-16">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight text-center mb-10 uppercase tracking-[0.1em]">Offer a Ride</h1>
        <ProgressBar currentStep={currentStep} totalSteps={5} />
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl shadow-blue-500/10 border border-gray-100 overflow-hidden relative">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-400/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 animate-pulse delay-1000" />

        <div className="relative z-10 p-10 sm:p-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-16 pt-10 border-t border-gray-100">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={back}
                className="w-full sm:w-auto px-10 h-14 font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all"
              >
                <ChevronLeft className="mr-2" size={22} />
                Back
              </Button>
            )}
            
            <div className="sm:ml-auto w-full sm:w-auto">
              {currentStep < 5 ? (
                <Button
                  onClick={next}
                  disabled={!isStepValid()}
                  className="w-full sm:w-auto px-12 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  Continue
                  <ChevronRight className="ml-2" size={22} />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  className="w-full sm:w-auto px-12 h-14 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xl shadow-emerald-500/30 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Publish Ride
                  {!isSubmitting && <Check className="ml-2" size={22} />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Helper */}
      <p className="text-center text-xs text-gray-400 mt-8 px-8">
        By publishing, you agree to our <span className="text-blue-600 font-bold hover:underline cursor-pointer">Community Guidelines</span> and confirm your vehicle&apos;s documentation is up-to-date.
      </p>
    </div>
  );
}
