import api from './axios';
import { API_ENDPOINTS } from '../apiConstants';

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

export interface AutocompleteSuggestion {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteData {
  distance: number; // in km
  duration: number; // in minutes
  polyline: string; // polyline string for route
}

export const mapAPI = {
  // Geocode: Convert address to coordinates
  geocode: (address: string) => 
    api.get<LocationData>(API_ENDPOINTS.MAP.GEOCODE, { params: { address } }),
  
  // Reverse Geocode: Convert coordinates to address
  reverseGeocode: (lat: number, lng: number) =>
    api.get<LocationData>(API_ENDPOINTS.MAP.REVERSE_GEOCODE, { params: { lat, lng } }),
  
  // Autocomplete: Search for places with autocomplete
  getAutocomplete: (q: string, limit: number = 5) => 
    api.get<AutocompleteSuggestion[]>(API_ENDPOINTS.MAP.AUTOCOMPLETE, { 
      params: { q, limit } 
    }),
  
  // Get Route: Calculate route between two points
  getRoute: (pickupLat: number, pickupLng: number, dropLat: number, dropLng: number) =>
    api.get<RouteData>(API_ENDPOINTS.MAP.ROUTE, { 
      params: { pickupLat, pickupLng, dropLat, dropLng } 
    }),
  
  // Fare Estimate: Get fare estimate for a route
  fareEstimate: (originLat: number, originLng: number, destLat: number, destLng: number, vehicleType?: string) =>
    api.post(API_ENDPOINTS.MAP.FARE_ESTIMATE, {
      originLat, originLng, destLat, destLng, vehicleType
    }),
  
  // Update Live Location: Driver broadcasts live location
  updateLiveLocation: (lat: number, lng: number, heading?: number, speed?: number) =>
    api.post(API_ENDPOINTS.MAP.LIVE_LOCATION, { lat, lng, heading, speed }),
  
  // Get Driver Location: Get last known location of a driver
  getDriverLocation: (driverId: string) =>
    api.get(API_ENDPOINTS.MAP.DRIVER_LOCATION.replace(':driverId', driverId)),
};

export default mapAPI;
