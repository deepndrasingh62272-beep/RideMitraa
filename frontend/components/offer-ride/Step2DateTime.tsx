'use client';

import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface Step2Props {
  data: any;
  updateData: (fields: any) => void;
}

export const Step2DateTime: React.FC<Step2Props> = ({ data, updateData }) => {
  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">When are you leaving?</h2>
        <p className="text-gray-500 font-medium">Pick a date and time for your journey</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div className="group">
          <Input
            label="Departure Date"
            type="date"
            value={data.date}
            onChange={(e) => updateData({ date: e.target.value })}
            icon={<Calendar className="text-blue-600" />}
            className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="group">
          <Input
            label="Departure Time"
            type="time"
            value={data.time}
            onChange={(e) => updateData({ time: e.target.value })}
            icon={<Clock className="text-purple-600" />}
            className="h-16 text-lg font-bold bg-gray-50/50 border-gray-100 focus:bg-white rounded-3xl"
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100/50 flex items-start gap-4 shadow-sm">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-xl shadow-blue-500/10 flex-shrink-0">
          <Clock size={24} className="animate-pulse" />
        </div>
        <div>
          <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Pro Tip</h4>
          <p className="text-gray-600 text-xs mt-1.5 leading-relaxed font-medium">
            Rides scheduled during peak hours (8 AM - 10 AM) are <span className="text-blue-600 font-black">40% more likely</span> to find co-passengers quickly.
          </p>
        </div>
      </div>
    </div>
  );
};
