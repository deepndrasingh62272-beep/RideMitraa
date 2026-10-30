"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, AlertCircle, Phone, MessageSquare } from "lucide-react";
import { useSocket } from "@/src/contexts/SocketContext";

interface LiveMapTrackingProps {
  rideId: string;
  driverLocation?: { lat: number; lng: number };
  passengerLocation?: { lat: number; lng: number };
  eta?: number;
  driverName?: string;
  vehicleInfo?: {
    model: string;
    plate: string;
  };
}

export default function LiveMapTracking({
  rideId,
  driverLocation,
  passengerLocation,
  eta,
  driverName,
  vehicleInfo,
}: LiveMapTrackingProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const { socket } = useSocket();

  // Initialize map using Leaflet
  useEffect(() => {
    if (!mapContainer.current || isMapLoaded) return;

    // Dynamically load Leaflet
    const loadLeaflet = async () => {
      // Add Leaflet CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.async = true;
      script.onload = () => {
        initializeMap();
      };
      document.body.appendChild(script);
    };

    const initializeMap = () => {
      const L = (window as any).L;

      // Default center (use driver location if available)
      const center = driverLocation || { lat: 28.6139, lng: 77.209 }; // Delhi default

      map.current = L.map(mapContainer.current).setView([center.lat, center.lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);

      // Add markers
      if (driverLocation) {
        const driverIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg border-2 border-white">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 11.894 1.789l-1.233.616 1.738 5.42a1 1 0 01-.471 1.106l-5.587 2.793a1 1 0 01-.894 0l-5.587-2.793a1 1 0 01-.471-1.106l1.738-5.42-1.233-.616a1 1 0 11.894-1.789l1.599.8L9 4.323V3a1 1 0 011-1h0z"/>
              </svg>
            </div>
          `,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
          .addTo(map.current)
          .bindPopup(`<div class="text-sm font-bold">${driverName || "Driver"}</div>`);
      }

      if (passengerLocation) {
        const passengerIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg border-2 border-white">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
              </svg>
            </div>
          `,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        L.marker([passengerLocation.lat, passengerLocation.lng], { icon: passengerIcon })
          .addTo(map.current)
          .bindPopup("<div class='text-sm font-bold'>Your Location</div>");
      }

      // Fit bounds if both locations exist
      if (driverLocation && passengerLocation) {
        const bounds = L.latLngBounds(
          [driverLocation.lat, driverLocation.lng],
          [passengerLocation.lat, passengerLocation.lng]
        );
        map.current.fitBounds(bounds, { padding: [50, 50] });
      }

      setIsMapLoaded(true);
    };

    loadLeaflet();
  }, []);

  // Update driver location on map
  useEffect(() => {
    if (!map.current || !isMapLoaded || !driverLocation) return;

    const L = (window as any).L;

    // Clear existing markers and redraw
    map.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.current.removeLayer(layer);
      }
    });

    // Re-add markers with updated positions
    if (driverLocation) {
      const driverIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg border-2 border-white animate-pulse">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 11.894 1.789l-1.233.616 1.738 5.42a1 1 0 01-.471 1.106l-5.587 2.793a1 1 0 01-.894 0l-5.587-2.793a1 1 0 01-.471-1.106l1.738-5.42-1.233-.616a1 1 0 11.894-1.789l1.599.8L9 4.323V3a1 1 0 011-1h0z"/>
            </svg>
          </div>
        `,
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
        .addTo(map.current)
        .bindPopup(`<div class="text-sm font-bold">${driverName || "Driver"}</div>`);
    }

    if (passengerLocation) {
      const passengerIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg border-2 border-white">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
            </svg>
          </div>
        `,
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([passengerLocation.lat, passengerLocation.lng], { icon: passengerIcon })
        .addTo(map.current)
        .bindPopup("<div class='text-sm font-bold'>Your Location</div>");
    }
  }, [driverLocation, passengerLocation, isMapLoaded]);

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-[2.5rem] overflow-hidden shadow-2xl">
      {/* Map Container */}
      <div ref={mapContainer} className="flex-1 w-full h-96 md:h-full relative" />

      {/* Info Panel */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white"
      >
        <div className="space-y-4">
          {/* Driver Info */}
          {driverName && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-widest font-bold">Driver</p>
                <p className="text-lg font-bold">{driverName}</p>
              </div>
              {vehicleInfo && (
                <div className="text-right">
                  <p className="text-xs text-gray-300 uppercase tracking-widest font-bold">Vehicle</p>
                  <p className="text-sm font-bold">{vehicleInfo.plate}</p>
                </div>
              )}
            </div>
          )}

          {/* ETA */}
          {eta !== undefined && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-400/50 rounded-xl p-3"
            >
              <Navigation className="w-5 h-5 text-emerald-400 animate-bounce" />
              <div>
                <p className="text-xs text-emerald-200 uppercase tracking-widest font-bold">ETA</p>
                <p className="text-lg font-black text-emerald-300">{eta} minutes away</p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors">
              <Phone className="w-4 h-4" />
              Call
            </button>
            <button className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 transition-colors">
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
