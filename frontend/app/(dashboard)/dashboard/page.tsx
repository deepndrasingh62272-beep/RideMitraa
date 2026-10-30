'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, Search, ArrowRight, MessageSquare, MapPin, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import bookingService from '@/src/services/bookingService';
import { getAvatarDataUri } from '@/src/utils/avatar';
import chatService from '@/src/services/chatService';

export default function DashboardPage() {
  // These will be replaced with real data from APIs
  const [upcomingRide, setUpcomingRide] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch upcoming ride
      const upcomingResult = await bookingService.getMyTrips({ limit: 1, status: 'upcoming' });
      if (upcomingResult.success && upcomingResult.data && upcomingResult.data.length > 0) {
        setUpcomingRide(upcomingResult.data[0]);
      }

      // Fetch recent activity
      const activityResult = await bookingService.getMyTrips({ limit: 3 });
      if (activityResult.success) {
        setRecentActivity(activityResult.data || []);
      }

      // Fetch last message
      const chatResult = await chatService.getConversations({ limit: 1 });
      if (chatResult.success && chatResult.data && chatResult.data.length > 0) {
        setLastMessage(chatResult.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as any },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Greeting Section */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Good Evening, User 👋</h1>
        <p className="text-lg text-gray-500 font-medium">Where are you going today?</p>
      </motion.section>

      {/* Primary Action Buttons */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Offer Ride Button */}
        <Link href="/offer-ride">
          <motion.button
            whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-48 md:h-56 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative group shadow-lg transition-all duration-300"
            suppressHydrationWarning
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20" />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col items-center justify-center gap-4 p-6">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <Car size={32} className="text-white" />
              </motion.div>
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Offer Ride</h2>
                <p className="text-blue-100 text-sm md:text-base">Share your journey & earn</p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-2"
              >
                <ArrowRight size={20} className="text-blue-200" />
              </motion.div>
            </div>
          </motion.button>
        </Link>

        {/* Find Ride Button */}
        <Link href="/find-ride">
          <motion.button
            whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(147, 51, 234, 0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-48 md:h-56 rounded-3xl bg-gradient-to-br from-purple-600 to-purple-700 text-white overflow-hidden relative group shadow-lg transition-all duration-300"
            suppressHydrationWarning
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-white rounded-full -ml-20 -mb-20" />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col items-center justify-center gap-4 p-6">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <Search size={32} className="text-white" />
              </motion.div>
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Find Ride</h2>
                <p className="text-purple-100 text-sm md:text-base">Book a ride instantly</p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-2"
              >
                <ArrowRight size={20} className="text-purple-200" />
              </motion.div>
            </div>
          </motion.button>
        </Link>
      </motion.section>

      {/* Minimal Info Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Ride */}
        <motion.section variants={itemVariants} className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Upcoming Ride</h3>
              <Link href="/bookings" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View <ChevronRight size={16} />
              </Link>
            </div>

            <div className="space-y-4">
              {/* Route */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2 py-1">
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <div className="w-0.5 h-12 bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">FROM</p>
                    <p className="font-semibold text-gray-900">{upcomingRide?.pickup?.name || 'No upcoming ride'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">TO</p>
                    <p className="font-semibold text-gray-900">{upcomingRide?.dropoff?.name || ''}</p>
                  </div>
                </div>
              </div>

              {/* Time and Price */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} />
                  <span className="text-sm font-medium">{upcomingRide?.rideTime || 'No upcoming ride'}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">₹{upcomingRide?.totalAmount || '0'}</p>
                  <p className="text-xs text-gray-500">{upcomingRide?.seatsBooked || 0} passengers</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Chat Preview */}
        <motion.section variants={itemVariants}>
          <Link href="/chat">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all h-full cursor-pointer group">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Latest Message</h3>
              <div className="flex items-start gap-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={getAvatarDataUri(lastMessage?.driverId?.name || lastMessage?.passengerId?.name || 'User')}
                    alt={lastMessage?.driverId?.name || lastMessage?.passengerId?.name || 'User'}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{lastMessage?.driverId?.name || lastMessage?.passengerId?.name || 'No messages'}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{lastMessage?.lastMessage?.text || 'Start a conversation'}</p>
                  <p className="text-xs text-gray-400 mt-2">{lastMessage?.lastMessage?.sentAt ? new Date(lastMessage.lastMessage.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs font-semibold text-blue-600 group-hover:text-blue-700">Open Chat</p>
              </div>
            </div>
          </Link>
        </motion.section>
      </div>

      {/* Recent Activity */}
      <motion.section variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
          <Link href="/bookings" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        <div className="space-y-2">
          {recentActivity.map((activity, index) => (
            <motion.div
              key={activity.id}
              variants={itemVariants}
              className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  activity.status === 'completed' ? "bg-green-100" : "bg-blue-100"
                )}>
                  {activity.status === 'completed' ? (
                    <Car size={20} className="text-green-600" />
                  ) : (
                    <div className="text-blue-600 font-bold text-sm">+</div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {activity.status === 'completed' ? 'Ride Completed' : 'Booking Created'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.pickup?.name || ''} → {activity.dropoff?.name || ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{activity.bookingTime || ''}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
