'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, 
  Users, 
  MapPin, 
  Clock, 
  Navigation, 
  Route,
  ChevronRight,
  Wifi,
  Battery,
  AlertCircle
} from 'lucide-react';
import RealTimeTrackingMap from './RealTimeTrackingMap';
import DriverTracking from './DriverTracking';
import { Button } from '@/components/ui/Button';
import socketService from '@/src/services/socketService';
import { toast } from 'sonner';

interface TrackingDashboardProps {
  rideId: string;
  userRole: 'driver' | 'passenger';
  userId: string;
  initialData: {
    pickup: {
      lat: number;
      lng: number;
      address: string;
    };
    drop: {
      lat: number;
      lng: number;
      address: string;
    };
    routePolyline?: [number, number][];
    driverId?: string;
    passengerId?: string;
    estimatedDistance?: number; // km
    estimatedDuration?: number; // minutes
  };
}

const TrackingDashboard: React.FC<TrackingDashboardProps> = ({
  rideId,
  userRole,
  userId,
  initialData
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'details' | 'driver'>('map');
  const [isConnected, setIsConnected] = useState(false);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [eta, setEta] = useState<number>(initialData.estimatedDuration || 0);
  const [connectionStats, setConnectionStats] = useState({
    lastUpdate: '',
    updateCount: 0,
    averageInterval: 0
  });

  // Check socket connection
  useEffect(() => {
    const checkConnection = () => {
      const connected = socketService.isConnected();
      setIsConnected(connected);
      
      if (!connected && userRole === 'passenger') {
        toast.error('Disconnected from real-time tracking');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, [userRole]);

  // Handle driver location updates
  const handleDriverLocationUpdate = (location: any) => {
    setDriverLocation(location);
    
    // Update connection stats
    const now = new Date();
    setConnectionStats(prev => ({
      lastUpdate: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      updateCount: prev.updateCount + 1,
      averageInterval: prev.updateCount > 0 
        ? Math.round((prev.averageInterval * prev.updateCount + 5000) / (prev.updateCount + 1) / 1000)
        : 5
    }));
  };

  // Handle ETA updates
  const handleETAUpdate = (etaMinutes: number) => {
    setEta(etaMinutes);
  };

  // Format time remaining
  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 1) return 'Arriving now';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!initialData.estimatedDuration || eta <= 0) return 0;
    const progress = Math.max(0, Math.min(100, 
      ((initialData.estimatedDuration - eta) / initialData.estimatedDuration) * 100
    ));
    return Math.round(progress);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              {userRole === 'driver' ? (
                <Car className="text-white" size={24} />
              ) : (
                <Users className="text-white" size={24} />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {userRole === 'driver' ? 'Driver Tracking' : 'Live Tracking'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Ride #{rideId.substring(0, 8)}...
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-bold">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            
            {userRole === 'passenger' && driverLocation && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
                <Clock size={12} />
                <span className="text-xs font-bold">{formatTimeRemaining(eta)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'map' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Navigation size={16} />
              Live Map
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'details' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Route size={16} />
              Trip Details
            </div>
          </button>
          
          {userRole === 'driver' && (
            <button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'driver' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Car size={16} />
                Driver Controls
              </div>
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Map Tab */}
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <RealTimeTrackingMap
                rideId={rideId}
                pickupLocation={initialData.pickup}
                dropLocation={initialData.drop}
                routePolyline={initialData.routePolyline}
                driverId={initialData.driverId}
                onDriverLocationUpdate={handleDriverLocationUpdate}
                onETAUpdate={handleETAUpdate}
              />
            </motion.div>
          )}
          
          {/* Details Tab */}
          {activeTab === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-6"
            >
              <div className="space-y-6">
                {/* Trip Summary */}
                <div className="glass-card rounded-2xl p-6 border border-gray-100">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Trip Summary</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Pickup</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{initialData.pickup.address}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {initialData.pickup.lat.toFixed(6)}, {initialData.pickup.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Drop</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{initialData.drop.address}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {initialData.drop.lat.toFixed(6)}, {initialData.drop.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Route size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Distance</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">
                      {initialData.estimatedDistance?.toFixed(1) || '0.0'} <span className="text-sm text-slate-400">KM</span>
                    </p>
                  </div>
                  
                  <div className="glass-card rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                      <Clock size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Est. Time</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900">
                      {initialData.estimatedDuration || 0} <span className="text-sm text-slate-400">MIN</span>
                    </p>
                  </div>
                  
                  {userRole === 'passenger' && (
                    <>
                      <div className="glass-card rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <Clock size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Time Left</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {eta} <span className="text-sm text-slate-400">MIN</span>
                        </p>
                      </div>
                      
                      <div className="glass-card rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                          <Navigation size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Progress</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {calculateProgress()} <span className="text-sm text-slate-400">%</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Connection Stats */}
                <div className="glass-card rounded-2xl p-6 border border-gray-100">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Connection Status</h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-sm font-bold text-slate-900">Socket Connection</span>
                      </div>
                      <span className={`text-sm font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    
                    {driverLocation && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wifi size={14} className="text-blue-600" />
                            <span className="text-sm font-bold text-slate-900">Last Update</span>
                          </div>
                          <span className="text-sm font-bold text-slate-900">{connectionStats.lastUpdate}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Battery size={14} className="text-green-600" />
                            <span className="text-sm font-bold text-slate-900">Update Count</span>
                          </div>
                          <span className="text-sm font-bold text-slate-900">{connectionStats.updateCount}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-600" />
                            <span className="text-sm font-bold text-slate-900">Avg Interval</span>
                          </div>
                          <span className="text-sm font-bold text-slate-900">{connectionStats.averageInterval}s</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Driver Info (for passengers) */}
                {userRole === 'passenger' && initialData.driverId && (
                  <div className="glass-card rounded-2xl p-6 border border-gray-100">
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Driver Information</h2>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                        <Car className="text-white" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">Driver #{initialData.driverId.substring(0, 8)}...</p>
                        <p className="text-xs text-slate-400 mt-1">Live tracking active</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Status</p>
                        <p className={`text-sm font-bold mt-1 ${driverLocation ? 'text-green-600' : 'text-amber-600'}`}>
                          {driverLocation ? 'Moving' : 'Waiting for location'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          
          {/* Driver Controls Tab */}
          {activeTab === 'driver' && userRole === 'driver' && (
            <motion.div
              key="driver"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-6"
            >
              <DriverTracking
                rideId={rideId}
                driverId={userId}
                onLocationSent={handleDriverLocationUpdate}
                autoTrack={true}
                updateInterval={5000}
              />
              
              {/* Driver Instructions */}
              <div className="mt-6 glass-card rounded-2xl p-6 border border-gray-100">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Tracking Instructions</h2>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <p className="text-sm text-slate-700">
                      Keep the app open for continuous tracking
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <p className="text-sm text-slate-700">
                      Ensure location services are enabled on your device
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <p className="text-sm text-slate-700">
                      Passengers will see your live location on their map
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <p className="text-sm text-slate-700">
                      Manual send button is available for testing
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            <p className="font-bold">Ride #{rideId.substring(0, 8)}...</p>
            <p className="text-xs mt-1">{userRole === 'driver' ? 'Driver Mode' : 'Passenger Mode'}</p>
          </div>
          
          <Button 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 rounded-2xl font-bold"
            onClick={() => {
              if (userRole === 'driver') {
                setActiveTab('driver');
              } else {
                setActiveTab('map');
              }
            }}
          >
            {userRole === 'driver' ? 'Tracking Controls' : 'View Live Map'}
            <ChevronRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrackingDashboard;