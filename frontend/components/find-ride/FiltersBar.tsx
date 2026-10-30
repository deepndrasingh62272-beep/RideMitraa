"use client";

import React from "react";
import { motion } from "framer-motion";
import { Filter, Clock, Car, Bike, DollarSign } from "lucide-react";

const filterOptions = [
  { id: "price", label: "Price Range", icon: DollarSign },
  { id: "time-morning", label: "Morning", icon: Clock },
  { id: "time-afternoon", label: "Afternoon", icon: Clock },
  { id: "time-night", label: "Night", icon: Clock },
  { id: "vehicle-car", label: "Car", icon: Car },
  { id: "vehicle-bike", label: "Bike", icon: Bike },
];

export default function FiltersBar() {
  const [activeFilters, setActiveFilters] = React.useState<string[]>([]);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-4">
      <div className="flex items-center gap-3 min-w-max px-4">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-gray-900 shadow-sm mr-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold">Filters</span>
        </div>
        
        {filterOptions.map((filter) => {
          const isActive = activeFilters.includes(filter.id);
          return (
            <motion.button
              key={filter.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleFilter(filter.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 border ${
                isActive
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200 shadow-sm"
              }`}
            >
              <filter.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-400"}`} />
              <span className="text-sm font-bold">{filter.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
