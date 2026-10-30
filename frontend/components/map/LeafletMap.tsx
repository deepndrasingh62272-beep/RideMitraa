'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationData, RouteData } from '@/src/api/map';

// Fix for default marker icons in Leaflet
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const pickupIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/20">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const dropIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-8 h-8 bg-purple-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-purple-500/20">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface MapViewProps {
  pickup: LocationData | null;
  drop: LocationData | null;
  route: RouteData | null;
}

// Component to handle auto-zooming and bounds
const MapController = ({ pickup, drop, route }: MapViewProps) => {
  const map = useMap();

  useEffect(() => {
    if (pickup && drop) {
      const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [drop.lat, drop.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 15, { animate: true });
    } else if (drop) {
      map.setView([drop.lat, drop.lng], 15, { animate: true });
    }
  }, [pickup, drop, map]);

  return null;
};

const LeafletMap: React.FC<MapViewProps> = ({ pickup, drop, route }) => {
  // Decode polyline string if provided (simple implementation or use library like @mapbox/polyline)
  // For simplicity, let's assume route.polyline is already decoded or we use the API coordinates
  // Actually, if the API returns a polyline string, we should decode it.
  // I'll add a helper for decoding polyline later.
  
  const polylinePositions = useMemo(() => {
    if (!route?.polyline) return [];
    // Basic polyline decoding (standard algorithm)
    const points: [number, number][] = [];
    let index = 0, len = route.polyline.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = route.polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = route.polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }, [route]);

  return (
    <MapContainer
      center={[20.5937, 78.9629]} // Default center (India)
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup className="custom-popup">
            <div className="p-2">
              <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Pickup Location</p>
              <p className="text-sm font-bold text-gray-900">{pickup.address}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {drop && (
        <Marker position={[drop.lat, drop.lng]} icon={dropIcon}>
          <Popup className="custom-popup">
            <div className="p-2">
              <p className="text-xs font-black text-purple-600 uppercase tracking-widest mb-1">Drop Location</p>
              <p className="text-sm font-bold text-gray-900">{drop.address}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {polylinePositions.length > 0 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ 
            color: '#3b82f6', 
            weight: 6, 
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: '1, 10' // For a dotted path look if desired
          }}
        />
      )}

      <MapController pickup={pickup} drop={drop} route={route} />
      
      {/* Add extra Leaflet styles globally if needed */}
      <style jsx global>{`
        .leaflet-container {
          background-color: #f8fafc;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 1.5rem;
          padding: 0.5rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .custom-popup .leaflet-popup-tip {
          box-shadow: none;
        }
      `}</style>
    </MapContainer>
  );
};

export default LeafletMap;
