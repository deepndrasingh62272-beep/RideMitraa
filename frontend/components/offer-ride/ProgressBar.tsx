'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0" />
        
        {/* Progress Line */}
        <motion.div 
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600 -translate-y-1/2 z-10"
        />

        {/* Steps */}
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNumber = i + 1;
          const isCompleted = currentStep > stepNumber;
          const isActive = currentStep === stepNumber;

          return (
            <div key={stepNumber} className="relative z-20 flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted ? '#10b981' : (isActive ? '#2563eb' : '#ffffff'),
                  borderColor: isCompleted ? '#10b981' : (isActive ? '#2563eb' : '#e5e7eb'),
                  scale: isActive ? 1.1 : 1,
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-sm border-2",
                  isCompleted ? "text-white" : (isActive ? "text-white" : "text-gray-400"),
                  isActive && "ring-4 ring-blue-100 shadow-lg shadow-blue-500/20"
                )}
              >
                {isCompleted ? <Check size={18} /> : stepNumber}
              </motion.div>
              <span className={cn(
                "absolute -bottom-8 text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap",
                isActive ? "text-blue-600" : (isCompleted ? "text-emerald-500" : "text-gray-400")
              )}>
                {isActive ? `Step ${stepNumber}` : (isCompleted ? 'Done' : `Step ${stepNumber}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
