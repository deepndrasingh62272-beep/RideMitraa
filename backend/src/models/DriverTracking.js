const mongoose = require('mongoose');

const driverTrackingSchema = new mongoose.Schema(
  {
    // Driver reference
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Current ride (if any)
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      default: null,
      index: true,
    },

    // Online/Offline status
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'INACTIVE', 'BUSY'],
      default: 'OFFLINE',
      index: true,
    },

    // Current location
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Location details
    latitude: Number,
    longitude: Number,
    accuracy: Number, // GPS accuracy in meters
    altitude: Number,

    // Movement data
    speed: {
      type: Number,
      default: 0, // km/h
    },
    heading: {
      type: Number,
      default: 0, // degrees (0-360)
    },

    // Timestamps
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastLocationUpdateAt: {
      type: Date,
      default: Date.now,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
    },
    goOnlineAt: Date,
    goOfflineAt: Date,

    // Heartbeat tracking
    heartbeatCount: {
      type: Number,
      default: 0,
    },
    missedHeartbeats: {
      type: Number,
      default: 0,
    },

    // Session info
    sessionId: String,
    deviceInfo: {
      platform: String, // iOS, Android, Web
      appVersion: String,
      osVersion: String,
    },

    // Inactivity detection
    inactiveAt: Date,
    inactivityReason: String, // NO_HEARTBEAT, MANUAL_OFFLINE, etc.

    // Statistics
    totalDistance: {
      type: Number,
      default: 0, // km
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    averageSpeed: {
      type: Number,
      default: 0, // km/h
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      batteryLevel: Number, // 0-100
      isCharging: Boolean,
      networkType: String, // WiFi, 4G, 5G, etc.
    },
  },
  {
    timestamps: true,
    collection: 'driverTracking',
  }
);

// Geospatial index for location queries
driverTrackingSchema.index({ 'currentLocation': '2dsphere' });

// Index for finding online drivers
driverTrackingSchema.index({ status: 1, lastSeenAt: 1 });

// Index for inactive driver detection
driverTrackingSchema.index({ lastHeartbeatAt: 1, status: 1 });

// Index for ride tracking
driverTrackingSchema.index({ rideId: 1, status: 1 });

module.exports = mongoose.model('DriverTracking', driverTrackingSchema);
