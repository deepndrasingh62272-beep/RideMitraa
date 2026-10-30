'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function GenericPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 max-w-2xl mx-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 bg-blue-100 text-blue-600 rounded-[32px] flex items-center justify-center shadow-xl shadow-blue-500/10"
      >
        <LayoutDashboard size={40} />
      </motion.div>
      
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
        <p className="text-gray-500 text-lg font-medium leading-relaxed">
          This is a placeholder for the <span className="text-blue-600 font-bold">{title}</span> page. 
          The full functional UI is currently under development to provide you with the best experience.
        </p>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <Link href="/dashboard">
          <Button className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 px-8 py-6">
            Back to Dashboard
            <ArrowRight size={20} className="ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
