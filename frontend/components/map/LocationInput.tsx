'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Search, X } from 'lucide-react';
import { mapAPI, AutocompleteSuggestion } from '@/src/api/map';
import { cn } from '@/lib/utils';

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (address: string) => void;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  icon?: React.ReactNode;
  className?: string;
  isPickup?: boolean;
}

export const LocationInput: React.FC<LocationInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  icon,
  className,
  isPickup
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (value.length > 2 && isOpen) {
        setIsLoading(true);
        try {
          const response = await mapAPI.getAutocomplete(value);
          setSuggestions(response.data);
        } catch (error) {
          console.error('Autocomplete error:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGetCurrentLocation = async () => {
    if ('geolocation' in navigator) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await mapAPI.reverseGeocode(latitude, longitude);
          onSelect(response.data);
          setIsOpen(false);
        } catch (error) {
          console.error('Reverse geocode error:', error);
        } finally {
          setIsLoading(false);
        }
      }, (error) => {
        console.error('Geolocation error:', error);
        setIsLoading(false);
      });
    }
  };

  return (
    <div className={cn("relative space-y-1", className)} ref={dropdownRef}>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rm-blue transition-colors">
          {icon || <MapPin size={18} />}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-12 pl-12 pr-10 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-rm-blue/20 focus:bg-white transition-all outline-none font-medium text-sm"
        />
        {value && (
          <button 
            onClick={() => {
              onChange('');
              setSuggestions([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-[60] left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-64 overflow-y-auto"
          >
            {isPickup && (
              <button
                onClick={handleGetCurrentLocation}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Navigation size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-600">Use Current Location</p>
                  <p className="text-[10px] text-slate-400 font-medium">Quickly set your current position</p>
                </div>
              </button>
            )}

            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2 bg-slate-50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSelect(suggestion);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-rm-blue/10 group-hover:text-rm-blue transition-colors">
                    <MapPin size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{suggestion.address}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Select Location</p>
                  </div>
                </button>
              ))
            ) : value.length > 2 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400 font-medium">No locations found</p>
              </div>
            ) : !isPickup && (
              <div className="p-6 text-center">
                <Search size={24} className="mx-auto text-slate-200 mb-2" />
                <p className="text-sm text-slate-400 font-medium">Start typing to search...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
