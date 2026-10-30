'use client';

import React from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider, useSidebar } from '@/components/dashboard/SidebarContext';
import { Header } from '@/components/dashboard/Header';
import { SOSButton } from '@/components/dashboard/SOSButton';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar />
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-[260px]'
        }`}
      >
        {!pathname.startsWith('/map') && <Header />}
        <main className={cn(
          "p-4 lg:p-8 xl:p-10 overflow-x-hidden relative flex-1",
          pathname.startsWith('/map') && "p-0 lg:p-0 xl:p-0"
        )}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ 
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1] 
              }}
              className={cn("w-full h-full", pathname.startsWith('/map') && "h-[calc(100vh)]")}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <SOSButton />
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}