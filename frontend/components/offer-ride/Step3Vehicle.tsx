'use client';

import React from 'react';
import { Car, Bike, Info, AlertTriangle, Gauge } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Step3Props {
  data: any;
  updateData: (fields: any) => void;
}

const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'EV', 'Hybrid'];

// All 7 vehicle types with maintenance rate info
const vehicleTypes = [
  { id: 'BIKE',      label: 'Bike',      icon: '🏍️',  seats: 2,  maintenance: '₹1.2/km' },
  { id: 'AUTO',      label: 'Auto',      icon: '🛺',  seats: 3,  maintenance: '₹2.0/km' },
  { id: 'HATCHBACK', label: 'Hatchback', icon: '🚗',  seats: 5,  maintenance: '₹2.5/km' },
  { id: 'CAR',       label: 'Car',       icon: '🚙',  seats: 5,  maintenance: '₹2.75/km' },
  { id: 'SEDAN',     label: 'Sedan',     icon: '🚘',  seats: 5,  maintenance: '₹3.0/km' },
  { id: 'SUV',       label: 'SUV',       icon: '🚐',  seats: 7,  maintenance: '₹3.5/km' },
  { id: 'VAN',       label: 'Van',       icon: '🚌',  seats: 9,  maintenance: '₹3.0/km' },
];

export const Step3Vehicle: React.FC<Step3Props> = ({ data, updateData }) => {
  const isVehicleNumberValid = data.registrationNumber && data.registrationNumber.trim().length > 0;
  const selectedType = vehicleTypes.find(v => v.id === (data.vehicleType || 'CAR').toUpperCase());

  const handleVehicleTypeSelect = (typeId: string) => {
    const vt = vehicleTypes.find(v => v.id === typeId);
    updateData({
      vehicleType: typeId.toLowerCase(),
      // reset seats to match vehicle default
      seats: typeId === 'BIKE' ? 1 : typeId === 'AUTO' ? 2 : 4,
    });
  };

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Vehicle Details</h2>
        <p className="text-gray-500 font-medium">Tell us what you&apos;re driving</p>
      </div>

      {/* Vehicle Number (MANDATORY) — top, prominent */}
      <div className="space-y-2">
        <Input
          label="Vehicle Number (Required)"
          placeholder="e.g. UP32AB1234"
          value={data.registrationNumber || ''}
          onChange={(e) => updateData({ registrationNumber: e.target.value.toUpperCase() })}
          className={cn(
            'h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl uppercase tracking-wider',
            !isVehicleNumberValid && data.registrationNumber !== undefined
              ? 'border-red-300 bg-red-50/50'
              : ''
          )}
        />
        {!isVehicleNumberValid && data.registrationNumber !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-600 text-xs font-bold ml-2"
          >
            <AlertTriangle size={14} />
            Vehicle number is mandatory to publish a ride
          </motion.div>
        )}
      </div>

      {/* Vehicle Name + Model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Vehicle Name"
          placeholder="e.g. Honda Activa"
          value={data.vehicleName}
          onChange={(e) => updateData({ vehicleName: e.target.value })}
          className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
        />
        <Input
          label="Vehicle Model / Year"
          placeholder="e.g. 2022"
          value={data.vehicleModel}
          onChange={(e) => updateData({ vehicleModel: e.target.value })}
          className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
        />
      </div>

      {/* Fuel Type */}
      <div className="space-y-4">
        <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">
          Fuel Type
        </label>
        <div className="flex flex-wrap gap-3">
          {fuelTypes.map((type) => (
            <motion.button
              key={type}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => updateData({ fuelType: type })}
              className={cn(
                'px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all duration-300',
                data.fuelType === type
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600 bg-white'
              )}
            >
              {type}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Vehicle Type — all 7 options */}
      <div className="space-y-4">
        <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">
          Vehicle Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {vehicleTypes.map((vt) => {
            const isSelected = (data.vehicleType || 'car').toUpperCase() === vt.id;
            return (
              <motion.button
                key={vt.id}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleVehicleTypeSelect(vt.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all duration-300 text-center',
                  isSelected
                    ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-500/15'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                )}
              >
                <span className="text-2xl">{vt.icon}</span>
                <span className={cn(
                  'text-xs font-black uppercase tracking-wider',
                  isSelected ? 'text-blue-700' : 'text-gray-600'
                )}>
                  {vt.label}
                </span>
                <span className={cn(
                  'text-[10px] font-bold',
                  isSelected ? 'text-blue-500' : 'text-gray-400'
                )}>
                  {vt.maintenance}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Selected type info */}
        {selectedType && (
          <motion.div
            key={selectedType.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3"
          >
            <span className="text-xl">{selectedType.icon}</span>
            <div className="text-sm">
              <span className="font-black text-blue-800">{selectedType.label}</span>
              <span className="text-blue-600 ml-2">·</span>
              <span className="text-blue-600 ml-2 font-bold">{selectedType.seats} seats</span>
              <span className="text-blue-600 ml-2">·</span>
              <span className="text-blue-600 ml-2 font-bold">Maintenance {selectedType.maintenance}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Mileage */}
      <div className="group">
        <div className="relative">
          <Input
            label="Mileage (km/L)"
            placeholder="e.g. 18"
            type="number"
            value={data.mileage || ''}
            onChange={(e) =>
              updateData({ mileage: e.target.value ? parseFloat(e.target.value) : '' })
            }
            className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
          />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-400 pointer-events-none mt-3">
            <Gauge size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">km/L</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 ml-2 font-medium">
          Used to calculate fair cost-sharing fare for passengers
        </p>
      </div>

      {/* Eco-Mitra badge */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-[2rem] border border-orange-100 flex items-start gap-4 shadow-sm">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-xl shadow-orange-500/10 flex-shrink-0">
          <Info size={24} className="animate-pulse" />
        </div>
        <div>
          <h4 className="font-black text-orange-900 text-sm uppercase tracking-wider">Eco-Mitra</h4>
          <p className="text-orange-800/80 text-xs mt-1.5 leading-relaxed font-medium">
            Offering rides with{' '}
            <span className="text-orange-600 font-black underline decoration-2 underline-offset-4">
              EV vehicles
            </span>{' '}
            helps you earn extra &quot;Eco-Mitra&quot; badges on your profile.
          </p>
        </div>
      </div>
    </div>
  );
};
