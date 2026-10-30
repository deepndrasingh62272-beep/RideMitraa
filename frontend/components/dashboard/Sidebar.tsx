'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Car, 
  Search, 
  Calendar, 
  MessageSquare, 
  Wallet, 
  User, 
  ChevronLeft, 
  LogOut,
  Menu,
  X,
  Map as MapIcon
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSidebar } from './SidebarContext';
import { authAPI } from '@/src/api/auth';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Car, label: 'Offer Ride', href: '/offer-ride' },
  { icon: Search, label: 'Find Ride', href: '/find-ride' },
  { icon: Calendar, label: 'My Bookings', href: '/bookings' },
  { icon: MessageSquare, label: 'Chats', href: '/chat' },
  { icon: Wallet, label: 'Wallet', href: '/wallet' },
  { icon: User, label: 'Profile', href: '/profile' },
];

export const Sidebar = () => {
  const { isCollapsed, setIsCollapsed, isHydrated } = useSidebar();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem('token');
      toast.success("Logged out successfully!");
      router.push('/');
    }
  };

  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-6">
      <div className="p-6 mb-4 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rm-blue to-rm-green flex items-center justify-center shadow-lg shadow-rm-blue/20">
              <Car className="text-white" size={24} />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-rm-blue">ride</span>
              <span className="text-xl font-black tracking-tight text-rm-green">mitra</span>
            </div>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
          suppressHydrationWarning
        >
          <ChevronLeft className={cn("transition-transform duration-500", isCollapsed && "rotate-180")} size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
                isActive 
                  ? "bg-rm-blue/10 text-rm-blue font-bold shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-rm-blue"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 w-1 h-6 bg-rm-blue rounded-r-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon size={22} className={cn(
                "transition-colors duration-300",
                isActive ? "text-rm-blue" : "group-hover:text-rm-blue"
              )} />
              {!isCollapsed && <span className="text-[15px]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pt-6 border-t border-gray-100">
        <button 
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-300",
            isCollapsed && "justify-center"
          )}
          suppressHydrationWarning
        >
          <LogOut size={22} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isHydrated && (
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-md border border-gray-100"
          suppressHydrationWarning
        >
          <Menu size={24} className="text-gray-600" />
        </button>
      )}

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-gray-100 z-30 transition-all duration-300"
        )}
      >
        <SidebarContent />
      </motion.aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-72 bg-white z-50 lg:hidden"
            >
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                suppressHydrationWarning
              >
                <X size={20} />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
