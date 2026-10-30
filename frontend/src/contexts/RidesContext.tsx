'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ridesAPI } from '@/src/api/rides';
import { bookingsAPI } from '@/src/api/bookings';
import { handleError } from '@/src/services/errorHandler';
import { showToast } from '@/components/ui/Toast';

interface Ride {
  id: string;
  driver: { id: string; name: string; avatar: string; phone: string; rating: number };
  pickup: string;
  drop: string;
  date: string;
  time: string;
  seatsOffered: number;
  seatsAvailable: number;
  price: number;
  vehicle: { model: string; number: string; color: string };
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

interface Booking {
  id: string;
  ride: Ride;
  passenger: { id: string; name: string; avatar: string; phone: string };
  seats: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  otp?: string;
  createdAt: string;
}

interface CreateBookingData {
  rideId: string;
  passengersCount: number;
  seatsBooked: number;
  paymentMethod: string;
  pickup: { name: string; coordinates: [number, number] };
  dropoff: { name: string; coordinates: [number, number] };
}

interface RidesContextType {
  rides: Ride[];
  myRides: Ride[];
  bookings: Booking[];
  isLoading: boolean;
  fetchRides: (params?: { pickup?: string; drop?: string; date?: string }) => Promise<void>;
  fetchMyRides: () => Promise<void>;
  fetchBookings: (type?: 'passenger' | 'driver') => Promise<void>;
  createRide: (data: any) => Promise<void>;
  createBooking: (data: CreateBookingData) => Promise<void>;
  acceptBooking: (bookingId: string) => Promise<void>;
  rejectBooking: (bookingId: string) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
}

const RidesContext = createContext<RidesContextType | undefined>(undefined);

export const useRides = () => {
  const context = useContext(RidesContext);
  if (!context) throw new Error('useRides must be used within RidesProvider');
  return context;
};

export const RidesProvider = ({ children }: { children: React.ReactNode }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRides = useCallback(async (params?: { pickup?: string; drop?: string; date?: string }) => {
    setIsLoading(true);
    try {
      const response = await ridesAPI.getAllRides(params);
      setRides(response.data.rides);
    } catch (error) {
      handleError(error, 'ride', true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyRides = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ridesAPI.getMyRides();
      setMyRides(response.data.rides);
    } catch (error) {
      handleError(error, 'ride', true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async (type?: 'passenger' | 'driver') => {
    setIsLoading(true);
    try {
      // Use getMyTrips for passenger, getMyRides for driver
      const response = type === 'driver'
        ? await bookingsAPI.getMyRides()
        : await bookingsAPI.getMyTrips();
      setBookings(response.data.bookings);
    } catch (error) {
      handleError(error, 'booking', true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRide = async (data: any) => {
    setIsLoading(true);
    try {
      await ridesAPI.createRide(data);
      showToast.success('Ride created successfully!');
      await fetchMyRides();
    } catch (error) {
      handleError(error, 'ride');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const createBooking = async (data: CreateBookingData) => {
    setIsLoading(true);
    try {
      await bookingsAPI.createBooking(data);
      showToast.success('Booking request sent!');
    } catch (error) {
      handleError(error, 'booking');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const acceptBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.acceptBooking(bookingId);
      showToast.success('Booking accepted!');
      await fetchBookings('driver');
    } catch (error) {
      handleError(error, 'booking');
    }
  };

  const rejectBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.rejectBooking(bookingId);
      showToast.success('Booking rejected');
      await fetchBookings('driver');
    } catch (error) {
      handleError(error, 'booking');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.cancelBooking(bookingId);
      showToast.success('Booking cancelled');
      await fetchBookings('passenger');
    } catch (error) {
      handleError(error, 'booking');
    }
  };

  return (
    <RidesContext.Provider value={{
      rides,
      myRides,
      bookings,
      isLoading,
      fetchRides,
      fetchMyRides,
      fetchBookings,
      createRide,
      createBooking,
      acceptBooking,
      rejectBooking,
      cancelBooking,
    }}>
      {children}
    </RidesContext.Provider>
  );
};
