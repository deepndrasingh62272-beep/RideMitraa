/**
 * Utility functions for real-time tracking
 */

/**
 * Decode Google Maps polyline string to coordinates array
 * @param polyline - Encoded polyline string
 * @returns Array of [lat, lng] coordinates
 */
export function decodePolyline(polyline: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polyline.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 - [lat, lng] coordinates
 * @param coord2 - [lat, lng] coordinates
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lat1, lng1] = coord1;
  const [lat2, lng2] = coord2;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate ETA based on distance and speed
 * @param distanceKm - Distance in kilometers
 * @param speedKmh - Speed in km/h
 * @returns Estimated time in minutes
 */
export function calculateETA(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  const etaHours = distanceKm / speedKmh;
  return Math.max(1, Math.round(etaHours * 60));
}

/**
 * Calculate progress along route
 * @param currentPosition - Current [lat, lng] coordinates
 * @param routePolyline - Array of [lat, lng] coordinates representing the route
 * @returns Progress percentage (0-100)
 */
export function calculateRouteProgress(
  currentPosition: [number, number],
  routePolyline: [number, number][]
): number {
  if (routePolyline.length < 2) return 0;

  // Find the closest point on the route
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routePolyline.length; i++) {
    const distance = calculateDistance(currentPosition, routePolyline[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  // Calculate progress based on position along route
  const progress = (closestIndex / (routePolyline.length - 1)) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Smooth coordinates for better tracking display
 * @param coordinates - Array of [lat, lng] coordinates
 * @param smoothingFactor - Smoothing factor (0-1, higher = more smoothing)
 * @returns Smoothed coordinates array
 */
export function smoothCoordinates(
  coordinates: [number, number][],
  smoothingFactor: number = 0.5
): [number, number][] {
  if (coordinates.length <= 1) return coordinates;

  const smoothed: [number, number][] = [coordinates[0]];

  for (let i = 1; i < coordinates.length; i++) {
    const prev = smoothed[i - 1];
    const current = coordinates[i];
    
    const smoothedLat = prev[0] * (1 - smoothingFactor) + current[0] * smoothingFactor;
    const smoothedLng = prev[1] * (1 - smoothingFactor) + current[1] * smoothingFactor;
    
    smoothed.push([smoothedLat, smoothedLng]);
  }

  return smoothed;
}

/**
 * Calculate bearing (direction) between two coordinates
 * @param start - Starting [lat, lng] coordinates
 * @param end - Ending [lat, lng] coordinates
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  start: [number, number],
  end: [number, number]
): number {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);

  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
           Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Format distance for display
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format speed for display
 * @param speedKmh - Speed in km/h
 * @returns Formatted speed string
 */
export function formatSpeed(speedKmh: number): string {
  return `${speedKmh.toFixed(0)} km/h`;
}

/**
 * Format time for display
 * @param minutes - Time in minutes
 * @returns Formatted time string
 */
export function formatTime(minutes: number): string {
  if (minutes < 1) return 'Arriving now';
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Validate coordinates
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns True if coordinates are valid
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Convert [lng, lat] to [lat, lng]
 * @param coordinates - [lng, lat] coordinates
 * @returns [lat, lng] coordinates
 */
export function lngLatToLatLng(coordinates: [number, number]): [number, number] {
  return [coordinates[1], coordinates[0]];
}

/**
 * Convert [lat, lng] to [lng, lat]
 * @param coordinates - [lat, lng] coordinates
 * @returns [lng, lat] coordinates
 */
export function latLngToLngLat(coordinates: [number, number]): [number, number] {
  return [coordinates[1], coordinates[0]];
}

export default {
  decodePolyline,
  calculateDistance,
  calculateETA,
  calculateRouteProgress,
  smoothCoordinates,
  calculateBearing,
  formatDistance,
  formatSpeed,
  formatTime,
  isValidCoordinates,
  lngLatToLatLng,
  latLngToLngLat
};