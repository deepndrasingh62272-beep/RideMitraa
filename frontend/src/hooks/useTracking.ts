import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '@/src/services/socketService';
import trackingService, { DriverLocationData, RouteData } from '@/src/services/trackingService';
import { toast } from 'sonner';

interface UseTrackingProps {
  rideId: string;
  userRole: 'driver' | 'passenger';
  userId: string;
  initialRoute?: RouteData;
  onLocationUpdate?: (location: any) => void;
  onETAUpdate?: (etaMinutes: number) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

interface UseTrackingReturn {
  // State
  driverLocation: any | null;
  eta: number;
  isConnected: boolean;
  isTracking: boolean;
  trackingStats: {
    totalUpdates: number;
    lastUpdateTime: string;
    averageInterval: number;
  };
  
  // Actions
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  sendLocationUpdate: (payload: {
    coordinates: [number, number];
    heading?: number;
    speedKmh?: number;
  }) => Promise<void>;
  joinRideRoom: () => Promise<void>;
  leaveRideRoom: () => void;
  
  // Connection
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  reconnect: () => void;
}

export const useTracking = ({
  rideId,
  userRole,
  userId,
  initialRoute,
  onLocationUpdate,
  onETAUpdate,
  onConnectionChange
}: UseTrackingProps): UseTrackingReturn => {
  const [driverLocation, setDriverLocation] = useState<any | null>(null);
  const [eta, setEta] = useState<number>(initialRoute?.durationMin || 0);
  const [isConnected, setIsConnected] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [trackingStats, setTrackingStats] = useState({
    totalUpdates: 0,
    lastUpdateTime: '',
    averageInterval: 0
  });

  const statsRef = useRef({
    updates: 0,
    totalInterval: 0,
    lastUpdateTimestamp: 0
  });
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Check socket connection
  useEffect(() => {
    const checkConnection = () => {
      const connected = socketService.isConnected();
      setIsConnected(connected);
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      onConnectionChange?.(connected);
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, [onConnectionChange]);

  // Listen for location updates (passenger only)
  useEffect(() => {
    if (userRole !== 'passenger' || !isConnected) return;

    const handleLocationUpdate = (location: any) => {
      console.log('[useTracking] Received location update:', location);
      setDriverLocation(location);
      
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

      setTrackingStats({
        totalUpdates: statsRef.current.updates,
        lastUpdateTime: new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        averageInterval: avgInterval
      });

      onLocationUpdate?.(location);
    };

    // Subscribe to location events
    unsubscribeRef.current = socketService.on('location:receive', handleLocationUpdate);
    
    // Also listen for legacy event
    socketService.on('location_update', handleLocationUpdate);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userRole, isConnected, onLocationUpdate]);

  // Join ride room for location updates
  const joinRideRoom = useCallback(async () => {
    if (!socketService.isConnected()) {
      toast.error('Socket not connected');
      return;
    }

    try {
      const result = await socketService.joinRide(rideId);
      if (result.ok) {
        console.log(`[useTracking] Joined ride room: ${rideId}`);
        setIsTracking(true);
        toast.success('Connected to real-time tracking');
      } else {
        toast.error(`Failed to join ride: ${result.error}`);
      }
    } catch (error) {
      console.error('[useTracking] Failed to join ride room:', error);
      toast.error('Failed to connect to real-time tracking');
    }
  }, [rideId]);

  // Leave ride room
  const leaveRideRoom = useCallback(() => {
    socketService.leaveRide(rideId);
    setIsTracking(false);
    console.log(`[useTracking] Left ride room: ${rideId}`);
  }, [rideId]);

  // Start tracking (driver only)
  const startTracking = useCallback(async () => {
    if (userRole !== 'driver') {
      toast.error('Only drivers can start tracking');
      return;
    }

    if (!socketService.isConnected()) {
      toast.error('Please connect to socket first');
      return;
    }

    // Join ride room
    await joinRideRoom();
    setIsTracking(true);
    toast.success('Started real-time tracking');
  }, [userRole, joinRideRoom]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    leaveRideRoom();
    setIsTracking(false);
    toast.info('Stopped tracking');
  }, [leaveRideRoom]);

  // Send location update (driver only)
  const sendLocationUpdate = useCallback(async (payload: {
    coordinates: [number, number];
    heading?: number;
    speedKmh?: number;
  }) => {
    if (userRole !== 'driver') {
      toast.error('Only drivers can send location updates');
      return;
    }

    if (!socketService.isConnected()) {
      toast.error('Socket not connected');
      return;
    }

    const fullPayload = {
      rideId,
      ...payload,
      eventId: `loc_${Date.now()}`
    };

    try {
      const result = await socketService.sendLocationUpdate(fullPayload);
      if (result.ok) {
        // Update local state for driver
        setDriverLocation({
          ...fullPayload,
          driverId: userId,
          updatedAt: new Date().toISOString(),
          source: 'driver'
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

        setTrackingStats({
          totalUpdates: statsRef.current.updates,
          lastUpdateTime: new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }),
          averageInterval: avgInterval
        });

        toast.success('Location sent successfully');
      } else {
        toast.error(`Failed to send location: ${result.error}`);
      }
    } catch (error) {
      console.error('[useTracking] Failed to send location update:', error);
      toast.error('Failed to send location update');
    }
  }, [rideId, userId, userRole]);

  // Reconnect to socket
  const reconnect = useCallback(() => {
    if (socketService.isConnected()) {
      toast.info('Already connected');
      return;
    }

    // Try to reconnect by checking connection state
    // The socket service should automatically reconnect
    setConnectionStatus('reconnecting');
    toast.info('Reconnecting...');
    
    // Check again after 2 seconds
    setTimeout(() => {
      const connected = socketService.isConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      setIsConnected(connected);
      
      if (connected) {
        toast.success('Reconnected successfully');
      } else {
        toast.error('Reconnection failed');
      }
    }, 2000);
  }, []);

  // Calculate ETA when driver location changes
  useEffect(() => {
    if (!driverLocation || !initialRoute) return;

    // Simple ETA calculation based on remaining distance and speed
    if (driverLocation.speedKmh && driverLocation.speedKmh > 0) {
      // This is a simplified calculation - in production you'd want
      // to calculate remaining distance along the route
      const estimatedRemainingTime = initialRoute.durationMin * 0.5; // Simplified
      setEta(estimatedRemainingTime);
      onETAUpdate?.(estimatedRemainingTime);
    }
  }, [driverLocation, initialRoute, onETAUpdate]);

  // Auto-join ride room for passengers
  useEffect(() => {
    if (userRole === 'passenger' && isConnected) {
      joinRideRoom();
    }

    return () => {
      if (userRole === 'passenger') {
        leaveRideRoom();
      }
    };
  }, [userRole, isConnected, joinRideRoom, leaveRideRoom]);

  return {
    // State
    driverLocation,
    eta,
    isConnected,
    isTracking,
    trackingStats,
    
    // Actions
    startTracking,
    stopTracking,
    sendLocationUpdate,
    joinRideRoom,
    leaveRideRoom,
    
    // Connection
    connectionStatus,
    reconnect
  };
};

export default useTracking;