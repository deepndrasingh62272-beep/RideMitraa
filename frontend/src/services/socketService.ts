import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../apiConstants';

export interface SocketMessage {
  _id: string;
  rideId: string;
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  sender?: {
    _id: string;
    name: string;
    phone?: string;
  };
}

export interface DriverLocation {
  rideId: string;
  driverId: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number;
  speedKmh?: number;
  updatedAt: string;
  source: string;
  eventId?: string;
}

export interface SocketConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  error?: string;
}

export interface JoinChatResponse {
  ok: boolean;
  error?: string;
}

export interface SendMessageResponse {
  ok: boolean;
  eventId?: string;
  messageId?: string;
  sentAt?: Date;
  error?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private connectionState: SocketConnectionState = {
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  };

  // Event listeners
  private messageListeners: Set<(message: SocketMessage) => void> = new Set();
  private connectionStateListeners: Set<(state: SocketConnectionState) => void> = new Set();
  private eventListeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize socket connection with JWT token
   */
  connect(token: string): void {
    if (this.socket?.connected || this.connectionState.isConnecting) {
      return;
    }

    this.token = token;
    this.updateConnectionState({ isConnecting: true });

    try {
      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Socket connection failed:', error);
      this.updateConnectionState({ 
        isConnecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      });
      throw error;
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.updateConnectionState({
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        lastConnectedAt: new Date(),
        error: undefined,
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.updateConnectionState({
        isConnected: false,
        isConnecting: false,
        lastDisconnectedAt: new Date(),
        error: reason === 'io server disconnect' ? 'Disconnected by server' : undefined,
      });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.updateConnectionState({
        isConnected: false,
        isConnecting: false,
        error: error.message,
      });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      this.updateConnectionState({
        isConnected: true,
        isReconnecting: false,
        lastConnectedAt: new Date(),
        error: undefined,
      });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt:', attemptNumber);
      this.updateConnectionState({
        isReconnecting: true,
        error: `Reconnecting... (attempt ${attemptNumber})`,
      });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnection error:', error.message);
      this.updateConnectionState({
        error: `Reconnection failed: ${error.message}`,
      });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
      this.updateConnectionState({
        isReconnecting: false,
        error: 'Reconnection failed. Please refresh the page.',
      });
    });

    // Listen for new messages
    this.socket.on('message:new', (message: SocketMessage) => {
      console.log('[Socket] New message received:', message._id);
      this.messageListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('[Socket] Error in message listener:', error);
        }
      });
    });

    // Forward other events to registered listeners
    this.socket.onAny((eventName, ...args) => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error(`[Socket] Error in ${eventName} listener:`, error);
          }
        });
      }
    });
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(updates: Partial<SocketConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('[Socket] Error in connection state listener:', error);
      }
    });
  }

  /**
   * Validate MongoDB ObjectId format
   */
  private isValidObjectId(id: string): boolean {
    if (!id) return false;
    // MongoDB ObjectId is 24 hex characters
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Validate IDs before socket operations
   */
  private validateIds(rideId: string, bookingId?: string): { isValid: boolean; error?: string } {
    if (!rideId) {
      return { isValid: false, error: 'rideId is required' };
    }
    
    if (!this.isValidObjectId(rideId)) {
      return { isValid: false, error: 'Invalid rideId format. Must be 24 hex characters' };
    }
    
    if (bookingId && !this.isValidObjectId(bookingId)) {
      return { isValid: false, error: 'Invalid bookingId format. Must be 24 hex characters' };
    }
    
    return { isValid: true };
  }

  /**
   * Join a chat room
   */
  joinChat(rideId: string, bookingId?: string): Promise<JoinChatResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, error: 'Socket not connected' });
        return;
      }

      // Validate IDs before sending to server
      const validation = this.validateIds(rideId, bookingId);
      if (!validation.isValid) {
        resolve({ ok: false, error: validation.error });
        return;
      }

      const data = bookingId ? { rideId, bookingId } : rideId;
      this.socket.emit('join_chat', data, (response: any) => {
        resolve(response || { ok: false, error: 'No response from server' });
      });
    });
  }

  /**
   * Leave a chat room
   */
  leaveChat(rideId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('leave_chat', rideId);
  }

  /**
   * Join a ride room for location tracking
   */
  joinRide(rideId: string): Promise<JoinChatResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, error: 'Socket not connected' });
        return;
      }

      // Validate rideId
      const validation = this.validateIds(rideId, undefined);
      if (!validation.isValid) {
        resolve({ ok: false, error: validation.error });
        return;
      }

      this.socket.emit('join_ride', rideId, (response: any) => {
        resolve(response || { ok: false, error: 'No response from server' });
      });
    });
  }

  /**
   * Leave a ride room
   */
  leaveRide(rideId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('leave_ride', rideId);
  }

  /**
   * Send driver location update
   */
  sendLocationUpdate(payload: {
    rideId: string;
    coordinates: [number, number];
    heading?: number;
    speedKmh?: number;
    eventId?: string;
  }): Promise<SendMessageResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, error: 'Socket not connected' });
        return;
      }

      // Validate rideId
      const validation = this.validateIds(payload.rideId, undefined);
      if (!validation.isValid) {
        resolve({ ok: false, error: validation.error });
        return;
      }

      // Validate coordinates
      if (!payload.coordinates || !Array.isArray(payload.coordinates) || payload.coordinates.length !== 2) {
        resolve({ ok: false, error: 'Invalid coordinates format. Must be [lng, lat]' });
        return;
      }

      const [lng, lat] = payload.coordinates;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        resolve({ ok: false, error: 'Coordinates must be numbers' });
        return;
      }

      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        resolve({ ok: false, error: 'Coordinates out of range' });
        return;
      }

      // Validate heading if provided
      if (payload.heading !== undefined && (payload.heading < 0 || payload.heading > 360)) {
        resolve({ ok: false, error: 'Heading must be between 0 and 360 degrees' });
        return;
      }

      // Validate speed if provided
      if (payload.speedKmh !== undefined && payload.speedKmh < 0) {
        resolve({ ok: false, error: 'Speed must be non-negative' });
        return;
      }

      this.socket.emit('location:update', payload, (response: any) => {
        resolve(response || { ok: false, error: 'No response from server' });
      });
    });
  }

  /**
   * Send a message
   */
  sendMessage(rideId: string, text: string, bookingId?: string, eventId?: string): Promise<SendMessageResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, error: 'Socket not connected' });
        return;
      }

      // Validate IDs before sending to server
      const validation = this.validateIds(rideId, bookingId);
      if (!validation.isValid) {
        resolve({ ok: false, error: validation.error });
        return;
      }

      // Validate message text
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        resolve({ ok: false, error: 'Message text is required' });
        return;
      }

      if (text.length > 1000) {
        resolve({ ok: false, error: 'Message too long (max 1000 characters)' });
        return;
      }

      const payload = { rideId, text: text.trim(), bookingId, eventId };
      this.socket.emit('message:new', payload, (response: any) => {
        resolve(response || { ok: false, error: 'No response from server' });
      });
    });
  }

  /**
   * Listen for new messages
   */
  onMessage(callback: (message: SocketMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Listen for connection state changes
   */
  onConnectionStateChange(callback: (state: SocketConnectionState) => void): () => void {
    this.connectionStateListeners.add(callback);
    // Immediately call with current state
    callback(this.connectionState);
    return () => {
      this.connectionStateListeners.delete(callback);
    };
  }

  /**
   * Listen for any socket event
   */
  on(eventName: string, callback: Function): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(callback);

    return () => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventName);
        }
      }
    };
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.messageListeners.clear();
    this.connectionStateListeners.clear();
    this.eventListeners.clear();
    
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      error: undefined,
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): SocketConnectionState {
    return this.connectionState;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  /**
   * Get socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;