const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { verifyToken } = require('../utils/jwt');
const mongoose = require('mongoose');
const RideLocation = require('../models/RideLocation');
const BookingRequest = require('../models/BookingRequest');
const {
  processDriverLocationUpdate,
  recordDriverHeartbeat,
  markStaleDriversOffline,
} = require('../services/locationRealtimeService');
const { sendRideMessage, assertRideChatAccess } = require('../services/chatRealtimeService');

let io;
let redisPubClient;
let redisSubClient;
let redisStateClient;
let staleDriverMonitor;
let retryPendingWorker;

const HEARTBEAT_TIMEOUT_MS = Number(process.env.DRIVER_HEARTBEAT_TIMEOUT_MS || 30000);
const HEARTBEAT_CHECK_INTERVAL_MS = Number(process.env.DRIVER_HEARTBEAT_CHECK_INTERVAL_MS || 10000);
const RETRY_INTERVAL_MS = Number(process.env.SOCKET_EVENT_RETRY_INTERVAL_MS || 4000);
const MAX_RETRY_ATTEMPTS = Number(process.env.SOCKET_MAX_RETRY_ATTEMPTS || 5);
const PENDING_EVENT_TTL_MS = Number(process.env.SOCKET_PENDING_EVENT_TTL_MS || 120000);
const MAX_PENDING_EVENTS_PER_RIDE = Number(process.env.SOCKET_MAX_PENDING_EVENTS_PER_RIDE || 100);

// rideId -> [{ event, payload, retries, nextRetryAt, expiresAt }]
const pendingRideEvents = new Map();

const normalizeId = (value) => String(value || '').trim();

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

// Validate socket request parameters
const validateSocketRequest = (rideId, bookingId) => {
  if (!rideId) {
    throw new Error('rideId is required');
  }
  
  if (!isValidObjectId(rideId)) {
    throw new Error('Invalid rideId format');
  }
  
  if (bookingId && !isValidObjectId(bookingId)) {
    throw new Error('Invalid bookingId format');
  }
  
  return {
    rideId: normalizeId(rideId),
    bookingId: bookingId ? normalizeId(bookingId) : undefined
  };
};

const getRoomSize = (room) => io?.sockets?.adapter?.rooms?.get(room)?.size || 0;

const enqueuePendingRideEvent = (rideId, event, payload, retries = 0) => {
  const key = normalizeId(rideId);
  if (!key) return;

  const queue = pendingRideEvents.get(key) || [];
  queue.push({
    event,
    payload,
    retries,
    nextRetryAt: Date.now() + RETRY_INTERVAL_MS,
    expiresAt: Date.now() + PENDING_EVENT_TTL_MS,
  });

  if (queue.length > MAX_PENDING_EVENTS_PER_RIDE) {
    queue.splice(0, queue.length - MAX_PENDING_EVENTS_PER_RIDE);
  }

  pendingRideEvents.set(key, queue);
};

const emitToRideRoom = (rideId, event, payload, { queueIfNoListeners = true } = {}) => {
  if (!io) return false;
  const room = `ride:${normalizeId(rideId)}`;

  const listeners = getRoomSize(room);
  if (listeners === 0) {
    if (queueIfNoListeners) enqueuePendingRideEvent(rideId, event, payload);
    return false;
  }

  try {
    io.to(room).emit(event, payload);
    return true;
  } catch {
    enqueuePendingRideEvent(rideId, event, payload, 1);
    return false;
  }
};

const emitRideLocation = (rideId, payload, options = {}) => {
  // New canonical event
  emitToRideRoom(rideId, 'location:receive', payload, options);
  // Legacy event for backward compatibility
  emitToRideRoom(rideId, 'location_update', payload, options);
};

const emitChatMessage = (rideId, payload, options = {}) => {
  if (!io) return;

  const room = `chat:${normalizeId(rideId)}`;
  const listeners = getRoomSize(room);
  if (listeners === 0 && options.queueIfNoListeners) {
    enqueuePendingRideEvent(rideId, 'message:new', payload);
    enqueuePendingRideEvent(rideId, 'new_message', payload);
    return;
  }

  try {
    // New canonical event
    io.to(room).emit('message:new', payload);
    // Legacy event for backward compatibility
    io.to(room).emit('new_message', payload);
  } catch {
    enqueuePendingRideEvent(rideId, 'message:new', payload, 1);
    enqueuePendingRideEvent(rideId, 'new_message', payload, 1);
  }
};

const replayPendingEventsToSocket = (socket, rideId) => {
  const key = normalizeId(rideId);
  const queue = pendingRideEvents.get(key) || [];
  if (!queue.length) return;

  const now = Date.now();
  const valid = queue.filter((entry) => entry.expiresAt > now);
  for (const entry of valid) {
    socket.emit(entry.event, entry.payload);
  }

  pendingRideEvents.delete(key);
};

const retryPendingEvents = () => {
  const now = Date.now();

  for (const [rideId, queue] of pendingRideEvents.entries()) {
    const nextQueue = [];
    for (const entry of queue) {
      if (entry.expiresAt <= now) continue;

      if (entry.nextRetryAt > now) {
        nextQueue.push(entry);
        continue;
      }

      const isChatEvent = entry.event === 'message:new' || entry.event === 'new_message';
      const room = isChatEvent ? `chat:${rideId}` : `ride:${rideId}`;
      const listeners = getRoomSize(room);

      if (listeners > 0) {
        try {
          io.to(room).emit(entry.event, entry.payload);
          continue;
        } catch {
          // Retry path below
        }
      }

      if (entry.retries + 1 < MAX_RETRY_ATTEMPTS) {
        nextQueue.push({
          ...entry,
          retries: entry.retries + 1,
          nextRetryAt: now + RETRY_INTERVAL_MS * Math.max(1, entry.retries + 1),
        });
      }
    }

    if (nextQueue.length) pendingRideEvents.set(rideId, nextQueue);
    else pendingRideEvents.delete(rideId);
  }
};

const touchHeartbeatCache = async (rideId, driverId, at = Date.now()) => {
  if (!redisStateClient?.isOpen) return;
  const key = `driver:lastSeen:${normalizeId(rideId)}:${normalizeId(driverId)}`;
  const ttlSec = Math.ceil((HEARTBEAT_TIMEOUT_MS * 4) / 1000);
  try {
    await redisStateClient.set(key, String(at), { EX: ttlSec });
  } catch {
    // non-critical
  }
};

const setupRedisAdapter = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    redisPubClient = createClient({ url: redisUrl });
    redisSubClient = redisPubClient.duplicate();
    redisStateClient = redisPubClient.duplicate();

    redisPubClient.on('error', (err) => {
      console.error('[Socket][Redis pub] Error:', err.message);
    });
    redisSubClient.on('error', (err) => {
      console.error('[Socket][Redis sub] Error:', err.message);
    });
    redisStateClient.on('error', (err) => {
      console.error('[Socket][Redis state] Error:', err.message);
    });

    await Promise.all([
      redisPubClient.connect(),
      redisSubClient.connect(),
      redisStateClient.connect(),
    ]);

    io.adapter(createAdapter(redisPubClient, redisSubClient));
    console.log('[Socket] Redis adapter enabled');
  } catch (err) {
    console.error('[Socket] Redis adapter setup failed, using in-memory adapter:', err.message);
    try { if (redisPubClient?.isOpen) await redisPubClient.disconnect(); } catch {}
    try { if (redisSubClient?.isOpen) await redisSubClient.disconnect(); } catch {}
    try { if (redisStateClient?.isOpen) await redisStateClient.disconnect(); } catch {}
    redisPubClient = undefined;
    redisSubClient = undefined;
    redisStateClient = undefined;
  }
};

const startBackgroundWorkers = () => {
  if (retryPendingWorker) clearInterval(retryPendingWorker);
  retryPendingWorker = setInterval(retryPendingEvents, RETRY_INTERVAL_MS);
  if (typeof retryPendingWorker.unref === 'function') retryPendingWorker.unref();

  if (staleDriverMonitor) clearInterval(staleDriverMonitor);
  staleDriverMonitor = setInterval(async () => {
    try {
      await markStaleDriversOffline({
        timeoutMs: HEARTBEAT_TIMEOUT_MS,
        onDriverOffline: async ({ rideId, driverId, offlineAt }) => {
          const payload = { rideId, driverId, offlineAt };
          emitToRideRoom(rideId, 'driver:offline', payload, { queueIfNoListeners: true });

          // Also notify active passengers' personal sockets.
          const bookings = await BookingRequest.find({
            rideId,
            status: { $in: ['ACCEPTED', 'ONGOING'] },
          }).select('passengerId').lean();

          for (const booking of bookings) {
            io.to(`user:${booking.passengerId}`).emit('driver:offline', payload);
          }
        },
      });
    } catch (err) {
      console.error('[Socket] stale-driver monitor failed:', err.message);
    }
  }, HEARTBEAT_CHECK_INTERVAL_MS);
  if (typeof staleDriverMonitor.unref === 'function') staleDriverMonitor.unref();
};

/**
 * Initialise Socket.IO on the HTTP server.
 * Call once from server.js after createServer().
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  setupRedisAdapter().catch(() => {});
  startBackgroundWorkers();

  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      socket.role   = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection ───────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.userId} (${socket.role})`);

    // Each user auto-joins their personal notification room
    socket.join(`user:${socket.userId}`);

    // Client joins a room scoped to a rideId to receive location updates
    socket.on('join_ride', async (rideId, ack) => {
      try {
        const normalizedRideId = normalizeId(rideId);
        if (!normalizedRideId) throw new Error('rideId is required');

        socket.join(`ride:${normalizedRideId}`);
        console.log(`[Socket] ${socket.userId} joined ride:${normalizedRideId}`);

        // Replay last known location on reconnect/join.
        const latest = await RideLocation.findOne({ rideId: normalizedRideId })
          .select('current driverId driverOnline driverOfflineAt')
          .lean();

        if (latest?.current) {
          const payload = {
            rideId: normalizedRideId,
            driverId: String(latest.driverId),
            coordinates: latest.current.coordinates,
            heading: latest.current.heading ?? null,
            speedKmh: latest.current.speedKmh ?? null,
            updatedAt: latest.current.updatedAt,
            source: 'SNAPSHOT',
          };
          socket.emit('location:receive', payload);
          socket.emit('location_update', payload); // legacy
        }

        if (latest?.driverOnline === false) {
          socket.emit('driver:offline', {
            rideId: normalizedRideId,
            driverId: String(latest.driverId),
            offlineAt: latest.driverOfflineAt,
          });
        }

        replayPendingEventsToSocket(socket, normalizedRideId);

        if (typeof ack === 'function') {
          ack({ ok: true, recovered: socket.recovered === true });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('leave_ride', (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    // Canonical realtime tracking event from driver app.
    socket.on('location:update', async (payload = {}, ack) => {
      const { rideId, coordinates, heading, speedKmh, eventId } = payload;

      try {
        const updated = await processDriverLocationUpdate({
          rideId,
          driverId: socket.userId,
          coordinates,
          heading,
          speedKmh,
          source: 'SOCKET',
          onBroadcast: async (locationPayload) => {
            emitRideLocation(rideId, {
              ...locationPayload,
              eventId: eventId || undefined,
            }, { queueIfNoListeners: true });
          },
        });

        await touchHeartbeatCache(rideId, socket.userId, Date.now());

        if (typeof ack === 'function') {
          ack({
            ok: true,
            eventId: eventId || null,
            updatedAt: updated.payload.updatedAt,
          });
        }
      } catch (err) {
        if (typeof ack === 'function') {
          ack({
            ok: false,
            eventId: eventId || null,
            error: err.message,
            retry: true,
            retryAfterMs: 2000,
          });
        }
      }
    });

    // Driver heartbeat used for offline detection.
    socket.on('heartbeat', async (payload = {}, ack) => {
      const { rideId } = payload;

      try {
        await recordDriverHeartbeat({ rideId, driverId: socket.userId, at: new Date() });
        await touchHeartbeatCache(rideId, socket.userId, Date.now());
        if (typeof ack === 'function') ack({ ok: true, ts: Date.now() });
      } catch (err) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: err.message, retry: true, retryAfterMs: 2000 });
        }
      }
    });

    // Client joins a chat room to receive real-time messages
    socket.on('join_chat', async (data, ack) => {
      try {
        const rideId = typeof data === 'string' ? data : data?.rideId;
        const bookingId = typeof data === 'string' ? undefined : data?.bookingId;
        
        // Validate ObjectId format
        const { rideId: validatedRideId, bookingId: validatedBookingId } = validateSocketRequest(rideId, bookingId);

        await assertRideChatAccess({
          rideId: validatedRideId,
          userId: socket.userId,
          bookingId: validatedBookingId,
        });

        socket.join(`chat:${validatedRideId}`);
        console.log(`[Socket] ${socket.userId} joined chat:${validatedRideId}`);
        replayPendingEventsToSocket(socket, validatedRideId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        console.error(`[Socket] join_chat error for ${socket.userId}:`, err.message);
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('leave_chat', (data) => {
      const rideId = typeof data === 'string' ? data : data?.rideId;
      socket.leave(`chat:${rideId}`);
    });

    // Canonical realtime chat event.
    socket.on('message:new', async (payload = {}, ack) => {
      try {
        const { rideId, text, bookingId, eventId } = payload;
        
        // Validate ObjectId format
        const { rideId: validatedRideId, bookingId: validatedBookingId } = validateSocketRequest(rideId, bookingId);
        
        // Validate message text
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          throw new Error('Message text is required');
        }
        
        if (text.length > 1000) {
          throw new Error('Message too long (max 1000 characters)');
        }

        const sent = await sendRideMessage({
          rideId: validatedRideId,
          senderId: socket.userId,
          text: text.trim(),
          bookingId: validatedBookingId,
          eventId,
        });

        emitChatMessage(validatedRideId, sent.payload, { queueIfNoListeners: true });

        if (typeof ack === 'function') {
          ack({
            ok: true,
            eventId: sent.payload.eventId,
            messageId: String(sent.message._id),
            sentAt: sent.message.createdAt,
          });
        }
      } catch (err) {
        console.error(`[Socket] message:new error for ${socket.userId}:`, err.message);
        const retry = !err.status || err.status >= 500;
        const response = {
          ok: false,
          eventId: payload.eventId || null,
          error: err.message,
          retry,
        };
        if (retry) response.retryAfterMs = 2000;
        if (err.categories) response.categories = err.categories;
        if (typeof ack === 'function') ack(response);
      }
    });

    // ── LOCATION_UPDATE relay (spec-compliant event name) ────────────────────
    // Driver emits LOCATION_UPDATE; backend relays to ride:{rideId} room (excluding sender).
    socket.on('LOCATION_UPDATE', (payload = {}) => {
      const { rideId, lat, lng, timestamp } = payload;
      if (!rideId || lat == null || lng == null) return;

      const normalizedRideId = normalizeId(rideId);
      const room = `ride:${normalizedRideId}`;

      // Relay to all passengers in the ride room, excluding the sender (driver)
      socket.to(room).emit('LOCATION_UPDATE', {
        rideId: normalizedRideId,
        lat,
        lng,
        timestamp: timestamp || new Date().toISOString(),
        driverId: socket.userId,
      });
    });

    // ── join:ride — driver joins ride room when ride starts ──────────────────
    socket.on('join:ride', (rideId, ack) => {
      try {
        const normalizedRideId = normalizeId(rideId);
        if (!normalizedRideId) throw new Error('rideId is required');
        socket.join(`ride:${normalizedRideId}`);
        console.log(`[Socket] ${socket.userId} joined ride:${normalizedRideId} (join:ride)`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.userId}`);
    });
  });

  return io;
};

/**
 * Returns the initialised io instance.
 * Use this in controllers to emit events.
 */
const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialised');
  return io;
};

module.exports = {
  initSocket,
  getIO,
  emitRideLocation,
  emitChatMessage,
};
