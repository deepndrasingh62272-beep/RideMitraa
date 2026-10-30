'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Navigation, 
  MapPin, 
  Wifi, 
  WifiOff, 
  Clock, 
  Gauge,
  Compass,
  Send,
  Loader2
} from 'lucide-react';
import socketService from '@/src/services/socketService';
import { toast } from 'sonner';

interface DriverTrackingProps {
  rideId: string;
  driverId: string;
  onLocationSent?: (location: {
    coordinates: [number, number];
    heading?: number;
    speedKmh?: number;
  }) => void;
  autoTrack?: boolean;
  updateInterval?: number; // milliseconds
}

const DriverTracking: React.FC<DriverTrackingProps> = ({
  rideId,
  driverId,
  onLocationSent,
  autoTrack = true,
  updateInterval = 5000 // 5 seconds
}) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastLocation, setLastLocation] = useState<{
    coordinates: [number, number];
    heading?: number;
    speedKmh?: number;
    sentAt?: Date;
  } | null>(null);
  const [locationStats, setLocationStats] = useState({
    totalUpdates: 0,
    lastUpdateTime: '',
    averageInterval: 0
  });
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const statsRef = useRef({
    updates: 0,
    totalInterval: 0,
    lastUpdateTimestamp: 0
  });

  // Check socket connection
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(socketService.isConnected());
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    
    return () => {
      clearInterval(interval);
      stopTracking();
    };
  }, []);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      setIsGettingLocation(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsGettingLocation(false);
          setCurrentPosition(position);
          resolve(position);
        },
        (error) => {
          setIsGettingLocation(false);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);

  // Start watching position
  const startWatchingPosition = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already watching
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position);
        
        // Auto-send if tracking is enabled
        if (isTracking && autoTrack) {
          sendLocationUpdate(position);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    toast.success('Started watching position');
  }, [isTracking, autoTrack]);

  // Stop watching position
  const stopWatchingPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      toast.info('Stopped watching position');
    }
  }, []);

  // Send location update
  const sendLocationUpdate = useCallback(async (position?: GeolocationPosition) => {
    if (!socketService.isConnected()) {
      toast.error('Socket not connected');
      return;
    }

    const positionToUse = position || currentPosition;
    if (!positionToUse) {
      toast.error('No location available');
      return;
    }

    const { coords } = positionToUse;
    const coordinates: [number, number] = [coords.longitude, coords.latitude];
    
    // Calculate heading if available
    let heading: number | undefined;
    if (coords.heading !== null && !isNaN(coords.heading)) {
      heading = coords.heading;
    }

    // Calculate speed in km/h
    let speedKmh: number | undefined;
    if (coords.speed !== null && !isNaN(coords.speed)) {
      speedKmh = coords.speed * 3.6; // Convert m/s to km/h
    }

    const payload = {
      rideId,
      coordinates,
      heading,
      speedKmh,
      eventId: `loc_${Date.now()}`
    };

    try {
      const result = await socketService.sendLocationUpdate(payload);
      
      if (result.ok) {
        const now = new Date();
        setLastLocation({
          coordinates,
          heading,
          speedKmh,
          sentAt: now
        });

        // Update stats
        statsRef.current.updates += 1;
        const currentTime = Date.now();
        if (statsRef.current.lastUpdateTimestamp > 0) {
          const interval = currentTime - statsRef.current.lastUpdateTimestamp;
          statsRef.current.totalInterval += interval;
        }
        statsRef.current.lastUpdateTimestamp = currentTime;

        const avgInterval = statsRef.current.updates > 1 
          ? Math.round(statsRef.current.totalInterval / (statsRef.current.updates - 1) / 1000)
          : 0;

        setLocationStats({
          totalUpdates: statsRef.current.updates,
          lastUpdateTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          averageInterval: avgInterval
        });

        onLocationSent?.(payload);
        toast.success('Location sent successfully');
      } else {
        toast.error(`Failed to send location: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to send location update:', error);
      toast.error('Failed to send location update');
    }
  }, [rideId, currentPosition, onLocationSent]);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!socketService.isConnected()) {
      toast.error('Please connect to socket first');
      return;
    }

    // Get initial location
    try {
      await getCurrentLocation();
    } catch (error) {
      toast.error('Failed to get initial location');
    }

    // Start watching position
    startWatchingPosition();
    
    // Start interval for sending updates
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      if (autoTrack && currentPosition) {
        sendLocationUpdate(currentPosition);
      }
    }, updateInterval);

    setIsTracking(true);
    toast.success('Started real-time tracking');
  }, [getCurrentLocation, startWatchingPosition, autoTrack, currentPosition, sendLocationUpdate, updateInterval]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    stopWatchingPosition();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsTracking(false);
    toast.info('Stopped tracking');
  }, [stopWatchingPosition]);

  // Toggle tracking
  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  // Manual location send
  const handleManualSend = useCallback(() => {
    sendLocationUpdate();
  }, [sendLocationUpdate]);

  // Format coordinates for display
  const formatCoordinates = (coordinates?: [number, number]) => {
    if (!coordinates) return 'N/A';
    const [lng, lat] = coordinates;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Format speed for display
  const formatSpeed = (speedKmh?: number) => {
    if (!speedKmh) return '0 km/h';
    return `${speedKmh.toFixed(1)} km/h`;
  };

  // Format heading for display
  const formatHeading = (heading?: number) => {
    if (heading === undefined) return 'N/A';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return `${directions[index]} (${heading.toFixed(0)}°)`;
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/50 backdrop-blur-xl bg-white/80">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Navigation className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Driver Tracking</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time Location</p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-xs font-bold">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <p className="text-sm text-amber-700 font-bold text-center">
              Please connect to socket service to start tracking
            </p>
          </div>
        )}

        {/* Current Location Info */}
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Current Location</p>
            {isGettingLocation && (
              <Loader2 size={14} className="text-blue-600 animate-spin" />
            )}
          </div>
          
          {currentPosition ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-900">
                  {formatCoordinates([currentPosition.coords.longitude, currentPosition.coords.latitude])}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Gauge size={12} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Speed</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">
                    {formatSpeed(currentPosition.coords.speed ? currentPosition.coords.speed * 3.6 : undefined)}
                  </p>
                </div>
                
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Compass size={12} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Heading</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">
                    {formatHeading(currentPosition.coords.heading || undefined)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-slate-400 font-bold">No location data available</p>
              <p className="text-xs text-slate-300 mt-1">Enable location services</p>
            </div>
          )}
        </div>

        {/* Last Sent Location */}
        {lastLocation && (
          <div className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
            <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-3">Last Sent Location</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">Coordinates</p>
                <p className="text-sm font-mono text-slate-700">{formatCoordinates(lastLocation.coordinates)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">Speed</p>
                <p className="text-sm font-bold text-slate-900">{formatSpeed(lastLocation.speedKmh)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">Heading</p>
                <p className="text-sm font-bold text-slate-900">{formatHeading(lastLocation.heading)}</p>
              </div>
              {lastLocation.sentAt && (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">Sent At</p>
                  <p className="text-sm font-bold text-slate-900">
                    {lastLocation.sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tracking Stats */}
        {isTracking && (
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Tracking Statistics</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">{locationStats.totalUpdates}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Updates</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">{locationStats.averageInterval}s</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Interval</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">{updateInterval / 1000}s</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Set Interval</p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-sm font-bold text-slate-900">
                {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Auto:</span>
              <div className={`w-10 h-5 rounded-full relative ${autoTrack ? 'bg-blue-500' : 'bg-slate-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoTrack ? 'left-5' : 'left-0.5'}`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTracking}
              disabled={!isConnected}
              className={`h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isTracking 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/20'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isTracking ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-white" />
                  Stop Tracking
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Start Tracking
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleManualSend}
              disabled={!isConnected || !currentPosition}
              className={`h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${!isConnected || !currentPosition 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/20'
              }`}
            >
              <Send size={16} />
              Send Now
            </motion.button>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400 font-bold">
              Ride ID: <span className="font-mono text-slate-600">{rideId.substring(0, 8)}...</span>
            </p>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Driver ID: <span className="font-mono text-slate-600">{driverId.substring(0, 8)}...</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverTracking;