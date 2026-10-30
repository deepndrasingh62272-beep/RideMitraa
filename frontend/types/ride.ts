export interface Location {
  name: string;
  coordinates: [number, number];
  isApproximate?: boolean;
  locationPrivacy?: string;
}

export interface Driver {
  id: string;
  name: string;
  avatar?: string;
  rating?: number;
  totalRatings?: number;
  isVerified?: boolean;
}

export interface Vehicle {
  model?: string;        // mapped from backend vehicle.name
  numberPlate?: string;  // mapped from backend vehicle.registrationNumber
  color?: string;
  type?: string;
  seatingCapacity?: number;
}

export interface Ride {
  id: string;
  _id?: string;          // raw backend field — normalised to id on fetch
  driver: Driver;
  pickup: string | Location;
  drop: string | Location;
  dropoff?: string | Location;
  pickupCoordinates?: [number, number];
  dropCoordinates?: [number, number];
  dropoffCoordinates?: [number, number];
  time: string;
  date?: string;
  price: number;
  farePerSeat?: number;  // backend field name
  pricePerSeat?: number; // alias used in some responses
  seats: number;
  availableSeats?: number;
  vehicleType: 'car' | 'bike';
  distanceKm?: number;
  vehicle?: Vehicle;
  vehicleModel?: string;   // direct access fallback
  vehicleNumber?: string;  // direct access fallback
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  driver?: Driver;
  passenger?: Driver;
  pickup: string | Location;
  drop: string | Location;
  dropoff?: string | Location;
  price: number;
  totalPrice?: number;
  seats: number;
  passengersCount?: number;
  seatsBooked?: number;
  time: string;
  date: string;
  paymentMethod?: string;
  status: 'idle' | 'pending' | 'accepted' | 'on_the_way' | 'completed' | 'cancelled' | 'arrived' | 'in_progress';
  createdAt?: string;
  updatedAt?: string;
  vehicle?: Vehicle;
  vehicleModel?: string;
  vehicleNumber?: string;
}

export interface CreateBookingRequest {
  rideId: string;
  passengersCount: number;
  seatsBooked: number;
  paymentMethod: string;
  pickup: Location;
  dropoff: Location;
}
