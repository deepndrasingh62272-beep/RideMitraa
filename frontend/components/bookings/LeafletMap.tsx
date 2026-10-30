"use client";

/**
 * LeafletMap — browser-only map component.
 *
 * This file is ONLY ever loaded on the client via next/dynamic with ssr:false
 * in TrackRide.tsx. Never import it directly — doing so will crash SSR.
 */

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon broken by webpack/Next.js asset handling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/** Imperatively pans the map when the driver's coordinates change. */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface LeafletMapProps {
  lat: number;
  lng: number;
  driverName: string;
}

export default function LeafletMap({ lat, lng, driverName }: LeafletMapProps) {
  const center: [number, number] = [lat, lng];

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={center}>
        <Popup>
          <div className="text-center">
            <p className="font-semibold">{driverName}</p>
            <p className="text-xs text-gray-500">Current Location</p>
          </div>
        </Popup>
      </Marker>
      <MapUpdater center={center} />
    </MapContainer>
  );
}
