'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import socketService from '@/src/services/socketService';
import { toast } from 'sonner';
import { 
  calculateDistance, 
  calculateRouteProgress,
  formatDistance,
  formatSpeed,
  formatTime,
  lngLatToLatLng 
} from '@/src/utils/trackingUtils';

// Fix for default marker icons in Leaflet
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Driver marker icon
const driverIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white ring-4 ring-blue-500/30 animate-pulse">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Z"/><line x1="6" x2="6" y1="12" y2="13"/><line x1="10" x2="10" y1="12" y2="13"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Passenger marker icon
const passengerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-8 h-8 bg-green-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-green-500/20">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface DriverLocation {
  rideId: string;
  driverId: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number;
  speedKmh?: number;
  updatedAt: string;
  source: string;
}

interface RealTimeTrackingMapProps {
  rideId: string;
  pickupLocation: Location;
  dropLocation: Location;
  routePolyline?: [number, number][];
  driverId?: string;
  onDriverLocationUpdate?: (location: DriverLocation) => void;
  onETAUpdate?: (etaMinutes: number) => void;
}

// Component to handle map updates when driver location changes
const MapController = ({ driverLocation, pickupLocation, dropLocation }: { 
  driverLocation: DriverLocation | null;
  pickupLocation: Location;
  dropLocation: Location;
}) => {
  const map = useMap();
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (driverLocation) {
      const driverLatLng = L.latLng(driverLocation.coordinates[1], driverLocation.coordinates[0]);
      
      // Smoothly pan to driver location
      map.panTo(driverLatLng, { animate: true, duration: 1 });
      
      // Update marker rotation if heading is available
      const marker = map.getPane('markerPane')?.querySelector('.driver-marker') as HTMLElement;
      if (marker && driverLocation.heading !== undefined) {
        marker.style.transform = `rotate(${driverLocation.heading}deg)`;
      }
    }
  }, [driverLocation, map]);

  // Fit bounds to include all points
  useEffect(() => {
    const points: L.LatLng[] = [
      L.latLng(pickupLocation.lat, pickupLocation.lng),
      L.latLng(dropLocation.lat, dropLocation.lng)
    ];
    
    if (driverLocation) {
      points.push(L.latLng(driverLocation.coordinates[1], driverLocation.coordinates[0]));
    }
    
    const bounds = L.latLngBounds(points);
    
    // Only update bounds if they've changed significantly
    if (!lastBoundsRef.current || !lastBoundsRef.current.equals(bounds, 0.01)) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
      lastBoundsRef.current = bounds;
    }
  }, [pickupLocation, dropLocation, driverLocation, map]);

  return null;
};

// Calculate ETA based on distance and speed
const calculateETAMinutes = (
  driverLocation: DriverLocation, 
  destination: Location,
  routePolyline?: [number, number][]
): number => {
  if (!driverLocation.speedKmh || driverLocation.speedKmh <= 0) {
    return 0;
  }

  // Convert coordinates to lat/lng
  const driverLatLng = lngLatToLatLng(driverLocation.coordinates);
  const destinationLatLng: [number, number] = [destination.lat, destination.lng];

  // Calculate distance
  const distanceKm = calculateDistance(driverLatLng, destinationLatLng);

  // Calculate ETA in minutes: (distance / speed) * 60
  const etaMinutes = (distanceKm / driverLocation.speedKmh) * 60;
  
  return etaMinutes;
};

const RealTimeTrackingMap: React.FC<RealTimeTrackingMapProps> = ({
  rideId,
  pickupLocation,
  dropLocation,
  routePolyline = [],
  driverId,
  onDriverLocationUpdate,
  onETAUpdate
}) => {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [eta, setEta] = useState<number>(0);
  const [trackingHistory, setTrackingHistory] = useState<[number, number][]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Join ride room for location updates
  const joinRideRoom = useCallback(async () => {
    try {
      const result = await socketService.joinRide(rideId);
      if (result.ok) {
        console.log(`[Tracking] Joined ride room: ${rideId}`);
        setIsConnected(true);
        
        // Listen for location updates
        unsubscribeRef.current = socketService.on('location:receive', (location: DriverLocation) => {
          console.log('[Tracking] Received driver location:', location);
          setDriverLocation(location);
          
          // Add to tracking history
          setTrackingHistory(prev => {
            const newHistory: [number, number][] = [...prev, [location.coordinates[1], location.coordinates[0]]];
            // Keep only last 50 points
            return newHistory.slice(-50);
          });
          
          // Calculate ETA to drop location
          const etaMinutes = calculateETAMinutes(location, dropLocation, routePolyline);
          setEta(etaMinutes);
          
          // Call callbacks
          onDriverLocationUpdate?.(location);
          onETAUpdate?.(etaMinutes);
        });
        
        // Also listen for legacy event
        socketService.on('location_update', (location: DriverLocation) => {
          console.log('[Tracking] Received legacy location update:', location);
          setDriverLocation(location);
        });
        
        toast.success('Connected to real-time tracking');
      } else {
        toast.error(`Failed to join ride: ${result.error}`);
      }
    } catch (error) {
      console.error('[Tracking] Failed to join ride room:', error);
      toast.error('Failed to connect to real-time tracking');
    }
  }, [rideId, dropLocation, routePolyline, onDriverLocationUpdate, onETAUpdate]);

  // Leave ride room
  const leaveRideRoom = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    socketService.leaveRide(rideId);
    setIsConnected(false);
    console.log(`[Tracking] Left ride room: ${rideId}`);
  }, [rideId]);

  // Initialize tracking
  useEffect(() => {
    if (!socketService.isConnected()) {
      toast.error('Socket not connected. Please connect to chat service first.');
      return;
    }
    
    joinRideRoom();
    
    return () => {
      leaveRideRoom();
    };
  }, [joinRideRoom, leaveRideRoom]);

  // Format speed display
  const formatSpeed = (speedKmh?: number) => {
    if (!speedKmh) return '0 km/h';
    return formatSpeed(speedKmh);
  };

  // Format heading display
  const formatHeading = (heading?: number) => {
    if (heading === undefined) return 'N/A';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return `${directions[index]} (${heading}°)`;
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[pickupLocation.lat, pickupLocation.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Pickup Marker */}
        <Marker 
          position={[pickupLocation.lat, pickupLocation.lng]} 
          icon={passengerIcon}
        >
          <Popup className="custom-popup">
            <div className="p-2">
              <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">Pickup Location</p>
              <p className="text-sm font-bold text-gray-900">{pickupLocation.address || 'Pickup point'}</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Drop Marker */}
        <Marker 
          position={[dropLocation.lat, dropLocation.lng]} 
          icon={passengerIcon}
        >
          <Popup className="custom-popup">
            <div className="p-2">
              <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">Drop Location</p>
              <p className="text-sm font-bold text-gray-900">{dropLocation.address || 'Drop point'}</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Driver Marker */}
        {driverLocation && (
          <Marker 
            position={[driverLocation.coordinates[1], driverLocation.coordinates[0]]} 
            icon={driverIcon}
            key={`driver-${driverLocation.updatedAt}`}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-[200px]">
                <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Driver Location</p>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900">Live Tracking Active</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Speed</p>
                      <p className="text-sm font-black text-gray-900">{formatSpeed(driverLocation.speedKmh)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Heading</p>
                      <p className="text-sm font-black text-gray-900">{formatHeading(driverLocation.heading)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">ETA</p>
                      <p className="text-sm font-black text-gray-900">{eta} min</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Updated</p>
                      <p className="text-sm font-black text-gray-900">
                        {new Date(driverLocation.updatedAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Route Polyline */}
        {routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 4, 
              opacity: 0.6,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}
        
        {/* Driver Tracking Path */}
        {trackingHistory.length > 1 && (
          <Polyline
            positions={trackingHistory}
            pathOptions={{ 
              color: '#ef4444', 
              weight: 2, 
              opacity: 0.4,
              lineJoin: 'round',
              lineCap: 'round',
              dashArray: '5, 10'
            }}
          />
        )}
        
        {/* Map Controller */}
        <MapController 
          driverLocation={driverLocation}
          pickupLocation={pickupLocation}
          dropLocation={dropLocation}
        />
        
        {/* Connection Status Overlay */}
        <div className="absolute top-4 right-4 z-[1000]">
          <div className={`px-3 py-2 rounded-lg shadow-lg ${isConnected ? 'bg-green-500' : 'bg-red-500'} text-white text-sm font-bold flex items-center gap-2`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-300' : 'bg-red-300'} animate-pulse`} />
            {isConnected ? 'Live Tracking' : 'Disconnected'}
          </div>
        </div>
        
        {/* ETA Display Overlay */}
        {eta > 0 && (
          <div className="absolute bottom-4 left-4 z-[1000]">
            <div className="px-4 py-3 bg-white rounded-xl shadow-xl border border-gray-100">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Estimated Arrival</p>
              <p className="text-2xl font-black text-gray-900">{eta} <span className="text-sm text-gray-500">min</span></p>
              <p className="text-xs text-gray-400 mt-1">to destination</p>
            </div>
          </div>
        )}
        
        {/* Custom Styles */}
        <style jsx global>{`
          .leaflet-container {
            background-color: #f8fafc;
          }
          .custom-popup .leaflet-popup-content-wrapper {
            border-radius: 1rem;
            padding: 0;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(0,0,0,0.05);
          }
          .custom-popup .leaflet-popup-tip {
            box-shadow: none;
          }
          .driver-marker {
            transition: transform 0.5s ease;
          }
        `}</style>
      </MapContainer>
    </div>
  );
};

export default RealTimeTrackingMap;