'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { mapAPI, LocationData, RouteData } from '@/src/api/map';
import { toast } from 'sonner';

interface MapContextType {
  pickup: LocationData | null;
  drop: LocationData | null;
  route: RouteData | null;
  isLoading: boolean;
  setPickup: (location: LocationData | null) => void;
  setDrop: (location: LocationData | null) => void;
  fetchRoute: () => Promise<void>;
  swapLocations: () => void;
  clearMap: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMap must be used within MapProvider');
  return context;
};

export const MapProvider = ({ children }: { children: React.ReactNode }) => {
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [drop, setDrop] = useState<LocationData | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRoute = useCallback(async () => {
    if (!pickup || !drop) return;
    setIsLoading(true);
    try {
      const response = await mapAPI.getRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
      setRoute(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch route');
      setRoute(null);
    } finally {
      setIsLoading(false);
    }
  }, [pickup, drop]);

  const swapLocations = useCallback(() => {
    const temp = pickup;
    setPickup(drop);
    setDrop(temp);
    setRoute(null);
  }, [pickup, drop]);

  const clearMap = useCallback(() => {
    setPickup(null);
    setDrop(null);
    setRoute(null);
  }, []);

  return (
    <MapContext.Provider
      value={{
        pickup,
        drop,
        route,
        isLoading,
        setPickup,
        setDrop,
        fetchRoute,
        swapLocations,
        clearMap,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};
