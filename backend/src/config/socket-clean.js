const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { sendRideMessage, assertRideChatAccess } = require('../services/chatRealtimeService');

let io;

/**
 * Validate chat access for a user
 */
const validateChatAccess = async (rideId, userId, bookingId) => {
  if (!rideId || !userId) {
    throw new Error('rideId and userId are required');
  }

  // Find chat by rideId and bookingId (if provided)
  const query = { rideId };
  if (bookingId) {
    query.bookingId = bookingId;
  }

  const chat = await Chat.findOne(query);
  if (!chat) {
    throw new Error('Chat not found');
  }

  // Check if user is a participant
  const isParticipant = 
    chat.driverId.toString() === userId.toString() ||
    chat.passengerId.toString() === userId.toString();

  if (!isParticipant) {
    throw new Error('Access denied to chat');
  }

  return chat;
};

/**
 * Validate message before sending
 */
const validateMessage = (text, rideId, senderId) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Message text is required');
  }

  if (text.length > 1000) {
    throw new Error('Message too long (max 1000 characters)');
  }

  if (!rideId || !senderId) {
    throw new Error('rideId and senderId are required');
  }

  return text.trim();
};

/**
 * Initialize Socket.IO server
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { 
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true 
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.userId} (${socket.role})`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    /**
     * Join a chat room
     */
    socket.on('join_chat', async (data, ack) => {
      try {
        const rideId = typeof data === 'string' ? data : data?.rideId;
        const bookingId = typeof data === 'string' ? undefined : data?.bookingId;

        if (!rideId) {
          throw new Error('rideId is required');
        }

        // Validate chat access
        await validateChatAccess(rideId, socket.userId, bookingId);

        // Join the chat room
        socket.join(`chat:${rideId}`);
        console.log(`[Socket] ${socket.userId} joined chat:${rideId}`);

        // Send acknowledgment
        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (error) {
        console.error(`[Socket] join_chat error:`, error.message);
        if (typeof ack === 'function') {
          ack({ ok: false, error: error.message });
        }
      }
    });

    /**
     * Leave a chat room
     */
    socket.on('leave_chat', (data) => {
      const rideId = typeof data === 'string' ? data : data?.rideId;
      if (rideId) {
        socket.leave(`chat:${rideId}`);
        console.log(`[Socket] ${socket.userId} left chat:${rideId}`);
      }
    });

    /**
     * Send a new message
     */
    socket.on('message:new', async (payload = {}, ack) => {
      try {
        const { rideId, text, bookingId, eventId } = payload;

        // Validate input
        validateMessage(text, rideId, socket.userId);

        // Send message via service
        const sent = await sendRideMessage({
          rideId,
          senderId: socket.userId,
          text,
          bookingId,
          eventId,
        });

        // Broadcast to chat room
        io.to(`chat:${rideId}`).emit('message:new', {
          _id: sent.message._id,
          rideId,
          senderId: socket.userId,
          text,
          createdAt: sent.message.createdAt,
          updatedAt: sent.message.updatedAt,
          sender: sent.message.sender,
        });

        // Update chat's last message
        await Chat.findOneAndUpdate(
          { rideId, ...(bookingId && { bookingId }) },
          {
            lastMessage: {
              text,
              senderId: socket.userId,
              sentAt: sent.message.createdAt,
            },
            updatedAt: new Date(),
          }
        );

        // Send acknowledgment
        if (typeof ack === 'function') {
          ack({
            ok: true,
            eventId: eventId || null,
            messageId: String(sent.message._id),
            sentAt: sent.message.createdAt,
          });
        }
      } catch (error) {
        console.error(`[Socket] message:new error:`, error.message);
        
        const retry = !error.status || error.status >= 500;
        const response = {
          ok: false,
          eventId: payload.eventId || null,
          error: error.message,
          retry,
        };
        
        if (retry) {
          response.retryAfterMs = 2000;
        }
        
        if (typeof ack === 'function') {
          ack(response);
        }
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.userId} (${reason})`);
    });

    /**
     * Handle errors
     */
    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${socket.userId}:`, error.message);
    });
  });

  return io;
};

/**
 * Get the Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit a message to a chat room
 */
const emitChatMessage = (rideId, message) => {
  if (!io) return;
  
  io.to(`chat:${rideId}`).emit('message:new', message);
};

/**
 * Check if a user is in a chat room
 */
const isUserInChatRoom = (rideId, userId) => {
  if (!io) return false;
  
  const room = io.sockets.adapter.rooms.get(`chat:${rideId}`);
  if (!room) return false;
  
  // Check if any socket in the room belongs to the user
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId === userId) {
      return true;
    }
  }
  
  return false;
};

module.exports = {
  initSocket,
  getIO,
  emitChatMessage,
  isUserInChatRoom,
};