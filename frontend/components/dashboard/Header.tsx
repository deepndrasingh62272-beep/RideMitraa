'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, User, Settings, LogOut, AlertTriangle, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import HeaderSOS from './HeaderSOS';
import { toast } from 'sonner';
import { getAvatarDataUri } from '@/src/utils/avatar';
import { useAuth } from '@/src/contexts/AuthContext';

export const Header = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  // Single source of truth — user comes from AuthContext, no extra API call
  const { user, logout } = useAuth();

  useEffect(() => {
    setIsHydrated(true);
    // Notifications are a separate concern — keep this fetch
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    // TODO: Replace with real notifications API when available
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    // Use AuthContext logout — clears token, user state, and shows toast
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-6 flex items-center justify-end">
      <div className="flex items-center gap-2 lg:gap-4">
        <HeaderSOS isActive={true} />
        
        {/* Notifications */}
        {isHydrated && (
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 relative transition-all active:scale-95"
              suppressHydrationWarning
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rm-orange border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <>
                  <div onClick={() => setIsNotificationsOpen(false)} className="fixed inset-0 z-10" />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden"
                  >
                    <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                      <span className="font-bold text-gray-900">Notifications</span>
                      <button className="text-xs text-blue-600 font-semibold hover:underline">Mark all read</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group flex items-start gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                              notif.unread ? "bg-blue-600" : "bg-transparent"
                            )} />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{notif.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <Link href="/notifications" className="block p-3 text-center text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-50 font-medium">
                      View all notifications
                    </Link>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        <HeaderSOS />

        {/* Profile Dropdown */}
        {isHydrated && (
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-gray-100 transition-colors group"
              suppressHydrationWarning
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500 p-0.5">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center overflow-hidden">
                  <Image 
                    src={user?.avatar || getAvatarDataUri(user?.name || 'User')} 
                    alt="User Avatar" 
                    width={40} 
                    height={40} 
                    unoptimized 
                  />
                </div>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-bold text-gray-900">{user?.name || 'User'}</p>
                <p className="text-[10px] text-gray-500">{user?.role || 'User'}</p>
              </div>
              <ChevronDown size={16} className={cn("text-gray-400 transition-transform duration-300", isProfileOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div onClick={() => setIsProfileOpen(false)} className="fixed inset-0 z-10" />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden p-2"
                  >
                    <div className="p-4 border-b border-slate-50 dark:border-slate-800/50 mb-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">{user?.name || 'User'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{user?.email || ''}</p>
                    </div>
                    <div className="space-y-1">
                      <Link href="/profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group">
                        <div className="w-8 h-8 rounded-lg bg-rm-blue/10 flex items-center justify-center text-rm-blue group-hover:bg-rm-blue group-hover:text-white transition-all">
                          <User size={16} />
                        </div>
                        <span className="text-sm font-bold">My Profile</span>
                      </Link>
                      <Link href="/settings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 dark:group-hover:bg-white dark:group-hover:text-black group-hover:text-white transition-all">
                          <Settings size={16} />
                        </div>
                        <span className="text-sm font-bold">Settings</span>
                      </Link>
                    </div>
                    <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all">
                        <LogOut size={16} />
                      </div>
                      <span className="text-sm font-bold">Logout</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
};
