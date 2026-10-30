'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { SOCKET_URL } from '../apiConstants';

interface Message {
  id: string;
  conversationId: string;
  sender: { id: string; name: string; avatar: string };
  content: string;
  type: 'text' | 'image' | 'location';
  createdAt: string;
  read: boolean;
}

interface Conversation {
  id: string;
  participant: { id: string; name: string; avatar: string };
  lastMessage?: Message;
  unreadCount: number;
}

interface RideLocation {
  rideId: string;
  driverId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface BookingUpdate {
  bookingId: string;
  status: string;
  message?: string;
  rideId?: string;
  updatedAt?: string;
  autoMatch?: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  rideLocations: Map<string, RideLocation>;
  lastBookingUpdate: BookingUpdate | null;
  connect: (token: string) => void;
  disconnect: () => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  sendMessage: (conversationId: string, content: string, type?: string) => void;
  joinRideRoom: (rideId: string) => void;
  leaveRideRoom: (rideId: string) => void;
  joinChatRoom: (rideId: string) => void;
  leaveChatRoom: (rideId: string) => void;
  onBookingUpdate: (callback: (data: BookingUpdate) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rideLocations, setRideLocations] = useState<Map<string, RideLocation>>(new Map());
  const [lastBookingUpdate, setLastBookingUpdate] = useState<BookingUpdate | null>(null);
  const bookingCallbacksRef = useRef<Set<(data: BookingUpdate) => void>>(new Set());

  const connect = useCallback((token: string) => {
    // Prevent duplicate connections
    if (socketRef.current?.connected) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    // ── Chat Events (match backend event names) ──────────────────────
    newSocket.on('message:new', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      toast.success(`New message from ${message.sender?.name || 'Unknown'}`);
    });

    // Also listen for legacy event name
    newSocket.on('new_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // ── Tracking Events ─────────────────────────────────────────────
    newSocket.on('driver_location', (location: RideLocation) => {
      setRideLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(location.driverId || location.rideId, location);
        return newMap;
      });
    });

    newSocket.on('driver_location_update', (location: any) => {
      setRideLocations((prev) => {
        const newMap = new Map(prev);
        const key = location.userId || location.driverId;
        if (key) {
          newMap.set(key, {
            rideId: location.rideId || '',
            driverId: key,
            lat: location.coordinates?.[1] || location.lat,
            lng: location.coordinates?.[0] || location.lng,
            timestamp: location.updatedAt || new Date().toISOString(),
          });
        }
        return newMap;
      });
    });

    newSocket.on('location:update', (location: RideLocation) => {
      setRideLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(location.rideId, location);
        return newMap;
      });
    });

    // ── Booking Events (match backend: 'booking:update') ─────────────
    newSocket.on('booking:update', (data: BookingUpdate) => {
      setLastBookingUpdate(data);
      // Notify all registered callbacks
      bookingCallbacksRef.current.forEach(cb => {
        try { cb(data); } catch(e) { console.error('[Socket] booking callback error:', e); }
      });
      
      // Show appropriate toast
      const statusMessages: Record<string, string> = {
        PENDING: '📨 Booking request sent!',
        ACCEPTED: '✅ Your booking has been accepted!',
        REJECTED: '❌ Booking was rejected',
        CANCELLED: '🚫 Booking was cancelled',
        ONGOING: '🚗 Your ride has started!',
        COMPLETED: '🏁 Ride completed!',
      };
      const msg = statusMessages[data.status] || `Booking status: ${data.status}`;
      if (['ACCEPTED', 'COMPLETED'].includes(data.status)) {
        toast.success(msg);
      } else if (['REJECTED', 'CANCELLED'].includes(data.status)) {
        toast.error(msg);
      } else {
        toast.info(msg);
      }
    });

    // Driver receives a new incoming booking request
    newSocket.on('booking:new', (data: any) => {
      console.log('[Socket] booking:new received:', data);
      toast.info('📨 New booking request!', { description: 'A passenger wants to book your ride.' });
    });

    // Also listen for legacy event name
    newSocket.on('booking_update', (data: BookingUpdate) => {
      newSocket.emit('booking:update', data); // Re-emit to unified handler
    });

    // ── Ride Status Events ──────────────────────────────────────────
    newSocket.on('ride_status_update', (data: { rideId: string; status: string }) => {
      toast.info(`Ride status updated to: ${data.status}`);
    });

    // ── Notification Events ─────────────────────────────────────────
    newSocket.on('notification:new', (data: { title: string; body: string }) => {
      toast.info(data.title, { description: data.body });
    });

    // ── SOS Events ──────────────────────────────────────────────────
    newSocket.on('sos:triggered', (data: any) => {
      toast.error('🚨 SOS Alert Triggered!', { description: data.message });
    });

    // ── Error Events ────────────────────────────────────────────────
    newSocket.on('error', (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []); // stable — no deps, uses socketRef to guard duplicate connections

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []); // stable — no deps, uses socketRef

  const sendMessage = useCallback((conversationId: string, content: string, type = 'text') => {
    if (socketRef.current) {
      socketRef.current.emit('send_message', { conversationId, content, type });
    }
  }, []);

  const joinRideRoom = useCallback((rideId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join_ride_room', { rideId });
    }
  }, []);

  const leaveRideRoom = useCallback((rideId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_ride_room', { rideId });
    }
  }, []);

  const joinChatRoom = useCallback((rideId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join_chat', { rideId });
    }
  }, []);

  const leaveChatRoom = useCallback((rideId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_chat', { rideId });
    }
  }, []);

  const onBookingUpdate = useCallback((callback: (data: BookingUpdate) => void) => {
    bookingCallbacksRef.current.add(callback);
    return () => {
      bookingCallbacksRef.current.delete(callback);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // stable — runs only on unmount

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      conversations,
      activeConversation,
      messages,
      rideLocations,
      lastBookingUpdate,
      connect,
      disconnect,
      setActiveConversation,
      sendMessage,
      joinRideRoom,
      leaveRideRoom,
      joinChatRoom,
      leaveChatRoom,
      onBookingUpdate,
    }}>
      {children}
    </SocketContext.Provider>
  );
};
