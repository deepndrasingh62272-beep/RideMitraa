'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { 
  Car, 
  Users, 
  MapPin, 
  Navigation, 
  Wifi, 
  WifiOff,
  Battery,
  Clock,
  Route,
  ChevronRight,
  Play,
  StopCircle,
  Send
} from 'lucide-react';
import socketService from '@/src/services/socketService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

// Dynamically import tracking components
const TrackingDashboard = dynamic(() => import('@/components/map/TrackingDashboard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-slate-100 animate-pulse rounded-3xl flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Tracking Dashboard...</p>
      </div>
    </div>
  )
});

const DriverTracking = dynamic(() => import('@/components/map/DriverTracking'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md mx-auto bg-slate-100 animate-pulse rounded-3xl p-6">
      <div className="h-12 bg-slate-200 rounded-2xl mb-4" />
      <div className="h-32 bg-slate-200 rounded-2xl mb-4" />
      <div className="h-10 bg-slate-200 rounded-2xl" />
    </div>
  )
});

const RealTimeTrackingMap = dynamic(() => import('@/components/map/RealTimeTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-slate-100 animate-pulse rounded-3xl" />
  )
});

export default function TrackingDemoPage() {
  const [activeDemo, setActiveDemo] = useState<'passenger' | 'driver'>('passenger');
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState('');
  const [rideId, setRideId] = useState('666666666666666666666666');
  const [driverId, setDriverId] = useState('666666666666666666666667');
  const [passengerId, setPassengerId] = useState('666666666666666666666668');

  // Mock data for demo
  const mockRouteData = {
    pickup: {
      lat: 28.6139,
      lng: 77.2090,
      address: 'Connaught Place, New Delhi, India'
    },
    drop: {
      lat: 28.7041,
      lng: 77.1025,
      address: 'India Gate, New Delhi, India'
    },
    routePolyline: [
      [28.6139, 77.2090],
      [28.6145, 77.2085],
      [28.6150, 77.2080],
      [28.6155, 77.2075],
      [28.6160, 77.2070],
      [28.7041, 77.1025]
    ] as [number, number][],
    estimatedDistance: 12.5,
    estimatedDuration: 25
  };

  // Check socket connection
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(socketService.isConnected());
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Connect to socket
  const connectSocket = () => {
    if (!token.trim()) {
      toast.error('Please enter a JWT token');
      return;
    }

    try {
      socketService.connect(token);
      toast.success('Socket connected successfully');
    } catch (error) {
      console.error('Failed to connect socket:', error);
      toast.error('Failed to connect socket');
    }
  };

  // Disconnect socket
  const disconnectSocket = () => {
    socketService.disconnect();
    toast.info('Socket disconnected');
  };

  // Generate test token
  const generateTestToken = () => {
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsInJvbGUiOiJwYXNzZW5nZXIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicGhvbmUiOiIrOTExMjM0NTY3ODkwIiwiaWF0IjoxNzc3MDk5MzMwLCJleHAiOjE3Nzc3MDQxMzB9.CqVUAli001jVqQJZxgDReW-_s8yn3uZbPQ2mHMeltEU';
    setToken(testToken);
    toast.success('Test token generated');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-4">
              Real-Time Driver Tracking System
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Live location tracking, route visualization, and ETA calculation using Socket.IO and Geoapify
            </p>
          </motion.div>

          {/* Connection Panel */}
          <div className="glass-card rounded-3xl p-6 mb-8 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Socket Connection</h2>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
                    <span className="text-sm font-bold">{isConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    Backend: <span className="font-mono">localhost:5000</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="JWT Token"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={generateTestToken}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20 rounded-2xl font-bold"
                  >
                    Test Token
                  </Button>
                  
                  {isConnected ? (
                    <Button
                      onClick={disconnectSocket}
                      className="bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/20 rounded-2xl font-bold"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={connectSocket}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 rounded-2xl font-bold"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Demo Selector */}
          <div className="glass-card rounded-3xl p-2 mb-8 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
            <div className="flex">
              <button
                onClick={() => setActiveDemo('passenger')}
                className={`flex-1 py-3 px-4 rounded-2xl text-center transition-all ${activeDemo === 'passenger' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users size={20} />
                  <span className="font-bold">Passenger View</span>
                </div>
              </button>
              
              <button
                onClick={() => setActiveDemo('driver')}
                className={`flex-1 py-3 px-4 rounded-2xl text-center transition-all ${activeDemo === 'driver' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Car size={20} />
                  <span className="font-bold">Driver View</span>
                </div>
              </button>
            </div>
          </div>

          {/* Demo Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Demo Area */}
            <div className="lg:col-span-2">
              {activeDemo === 'passenger' ? (
                <div className="space-y-8">
                  {/* Passenger Tracking Dashboard */}
                  <div className="glass-card rounded-3xl overflow-hidden border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                    <TrackingDashboard
                      rideId={rideId}
                      userRole="passenger"
                      userId={passengerId}
                      initialData={{
                        ...mockRouteData,
                        driverId,
                        passengerId
                      }}
                    />
                  </div>

                  {/* Standalone Map */}
                  <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Live Tracking Map</h2>
                    <div className="h-96 rounded-2xl overflow-hidden">
                      <RealTimeTrackingMap
                        rideId={rideId}
                        pickupLocation={mockRouteData.pickup}
                        dropLocation={mockRouteData.drop}
                        routePolyline={mockRouteData.routePolyline}
                        driverId={driverId}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Driver Tracking Controls */}
                  <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Driver Tracking Controls</h2>
                    <DriverTracking
                      rideId={rideId}
                      driverId={driverId}
                      autoTrack={true}
                      updateInterval={5000}
                    />
                  </div>

                  {/* Driver Instructions */}
                  <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">How It Works</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                          <Navigation size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">Location Updates</h3>
                        <p className="text-sm text-slate-600">
                          Driver's location is sent every 5 seconds via Socket.IO
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100/50">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 mb-3">
                          <Route size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">Route Visualization</h3>
                        <p className="text-sm text-slate-600">
                          Real-time polyline showing driver's path and progress
                        </p>
                      </div>
                      
                      <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 mb-3">
                          <Clock size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">ETA Calculation</h3>
                        <p className="text-sm text-slate-600">
                          Dynamic ETA based on current speed and remaining distance
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side Panel */}
            <div className="space-y-8">
              {/* Socket Events Panel */}
              <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Socket Events</h2>
                
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-bold text-slate-900">location:update</span>
                      </div>
                      <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Driver → Server</span>
                    </div>
                    <p className="text-xs text-slate-500">Driver sends location updates</p>
                  </div>
                  
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-bold text-slate-900">location:receive</span>
                      </div>
                      <span className="text-xs font-black text-green-600 uppercase tracking-wider">Server → Passengers</span>
                    </div>
                    <p className="text-xs text-slate-500">Passengers receive location updates</p>
                  </div>
                  
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-sm font-bold text-slate-900">join_ride</span>
                      </div>
                      <span className="text-xs font-black text-purple-600 uppercase tracking-wider">Client → Server</span>
                    </div>
                    <p className="text-xs text-slate-500">Join ride room for tracking</p>
                  </div>
                  
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-sm font-bold text-slate-900">heartbeat</span>
                      </div>
                      <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Driver → Server</span>
                    </div>
                    <p className="text-xs text-slate-500">Driver heartbeat for online status</p>
                  </div>
                </div>
              </div>

              {/* Test Controls */}
              <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Test Controls</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Ride ID</label>
                    <input
                      type="text"
                      value={rideId}
                      onChange={(e) => setRideId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Driver ID</label>
                    <input
                      type="text"
                      value={driverId}
                      onChange={(e) => setDriverId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Passenger ID</label>
                    <input
                      type="text"
                      value={passengerId}
                      onChange={(e) => setPassengerId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono"
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-600 mb-3">
                      Use valid 24-character MongoDB ObjectId format for testing
                    </p>
                    <Button
                      onClick={() => {
                        setRideId('666666666666666666666666');
                        setDriverId('666666666666666666666667');
                        setPassengerId('666666666666666666666668');
                        toast.success('Reset to test IDs');
                      }}
                      className="w-full bg-gradient-to-r from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20 rounded-2xl font-bold"
                    >
                      Reset Test IDs
                    </Button>
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div className="glass-card rounded-3xl p-6 border border-white/50 backdrop-blur-xl bg-white/80 shadow-2xl">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Features</h2>
                
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Real-time driver location tracking</span>
                  </li>
                  
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Route polyline visualization</span>
                  </li>
                  
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Dynamic ETA calculation</span>
                  </li>
                  
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Socket.IO real-time events</span>
                  </li>
                  
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Geoapify map integration</span>
                  </li>
                  
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700">Driver & passenger views</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="text-center">
              <p className="text-sm text-slate-500">
                Real-Time Driver Tracking System • Built with Socket.IO, Geoapify, and Leaflet
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Backend runs on port 5000 • Frontend uses Next.js 14
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}