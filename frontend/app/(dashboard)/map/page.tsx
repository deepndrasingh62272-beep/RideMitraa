'use client';

import React from 'react';
import { MapUI } from '@/components/map/MapUI';

export default function MapPage() {
  return (
    <div className="absolute inset-0 z-0">
      <MapUI />
    </div>
  );
}
