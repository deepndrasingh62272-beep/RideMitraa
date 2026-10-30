const DriverTracking = require('../models/DriverTracking');
const Ride = require('../models/Ride');
const { getIO } = require('../config/socket');

const HEARTBEAT_TIMEOUT_MS = 30 * 1000; // 30 seconds
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize driver tracking when they go online
 *
 * @param {string} driverId - Driver ID
 * @param {object} metadata - Device and session info
 * @returns {object} Tracking record
 */
const goOnline = async (driverId, metadata = {}) => {
  try {
    console.log(`[DriverTracking] Driver ${driverId} going online`);

    const tracking = await DriverTracking.findOneAndUpdate(
      { driverId },
      {
        $set: {
          status: 'ONLINE',
          goOnlineAt: new Date(),
          goOfflineAt: null,
          lastSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
          missedHeartbeats: 0,
          inactiveAt: null,
          inactivityReason: null,
          sessionId: metadata.sessionId || `session_${Date.now()}`,
          'metadata.ipAddress': metadata.ipAddress,
          'metadata.userAgent': metadata.userAgent,
          'metadata.platform': metadata.platform,
          'metadata.appVersion': metadata.appVersion,
          'metadata.osVersion': metadata.osVersion,
        },
      },
      { upsert: true, new: true }
    );

    // Emit to all connected clients
    const io = getIO();
    io.emit('driver_online', {
      driverId,
      status: 'ONLINE',
      timestamp: new Date(),
    });

    return {
      success: true,
      tracking,
      message: 'Driver is now online',
    };
  } catch (err) {
    console.error('[DriverTracking] Error in goOnline:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Mark driver as offline
 *
 * @param {string} driverId - Driver ID
 * @returns {object} Result
 */
const goOffline = async (driverId) => {
  try {
    console.log(`[DriverTracking] Driver ${driverId} going offline`);

    const tracking = await DriverTracking.findOneAndUpdate(
      { driverId },
      {
        $set: {
          status: 'OFFLINE',
          goOfflineAt: new Date(),
          rideId: null,
        },
      },
      { new: true }
    );

    // Emit to all connected clients
    const io = getIO();
    io.emit('driver_offline', {
      driverId,
      status: 'OFFLINE',
      timestamp: new Date(),
    });

    return {
      success: true,
      tracking,
      message: 'Driver is now offline',
    };
  } catch (err) {
    console.error('[DriverTracking] Error in goOffline:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Update driver location with speed and heading
 *
 * @param {string} driverId - Driver ID
 * @param {string} rideId - Current ride ID
 * @param {object} locationData - { latitude, longitude, speed, heading, accuracy, altitude }
 * @returns {object} Updated tracking record
 */
const updateLocation = async (driverId, rideId, locationData) => {
  try {
    const {
      latitude,
      longitude,
      speed = 0,
      heading = 0,
      accuracy = null,
      altitude = null,
    } = locationData;

    if (!latitude || !longitude) {
      return {
        success: false,
        error: 'INVALID_COORDINATES',
        message: 'Latitude and longitude are required',
      };
    }

    // Validate coordinates
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return {
        success: false,
        error: 'INVALID_COORDINATES',
        message: 'Coordinates out of valid range',
      };
    }

    console.log(
      `[DriverTracking] Updating location for driver ${driverId}: (${latitude}, ${longitude}), speed: ${speed}km/h`
    );

    const tracking = await DriverTracking.findOneAndUpdate(
      { driverId },
      {
        $set: {
          latitude,
          longitude,
          speed: Math.max(0, speed),
          heading: (heading % 360 + 360) % 360, // Normalize to 0-360
          accuracy,
          altitude,
          lastLocationUpdateAt: new Date(),
          lastSeenAt: new Date(),
          'currentLocation.coordinates': [longitude, latitude],
          rideId: rideId || null,
          status: speed > 0 ? 'BUSY' : 'ONLINE',
        },
      },
      { new: true }
    );

    if (!tracking) {
      return {
        success: false,
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver tracking record not found',
      };
    }

    // Emit real-time location to passengers on this ride
    if (rideId) {
      const io = getIO();
      io.to(`ride:${rideId}`).emit('driver_location_update', {
        driverId,
        rideId,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      tracking,
      message: 'Location updated successfully',
    };
  } catch (err) {
    console.error('[DriverTracking] Error in updateLocation:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Record heartbeat from driver
 * Used to detect inactive drivers
 *
 * @param {string} driverId - Driver ID
 * @param {object} metadata - Device metadata
 * @returns {object} Result
 */
const recordHeartbeat = async (driverId, metadata = {}) => {
  try {
    const tracking = await DriverTracking.findOneAndUpdate(
      { driverId },
      {
        $set: {
          lastHeartbeatAt: new Date(),
          lastSeenAt: new Date(),
          missedHeartbeats: 0,
          inactiveAt: null,
          inactivityReason: null,
          'metadata.batteryLevel': metadata.batteryLevel,
          'metadata.isCharging': metadata.isCharging,
          'metadata.networkType': metadata.networkType,
        },
        $inc: {
          heartbeatCount: 1,
        },
      },
      { new: true }
    );

    if (!tracking) {
      return {
        success: false,
        error: 'DRIVER_NOT_FOUND',
      };
    }

    return {
      success: true,
      tracking,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in recordHeartbeat:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Detect and mark inactive drivers
 * Should be called periodically by background job
 *
 * @returns {object} Result with count of inactive drivers
 */
const detectInactiveDrivers = async () => {
  try {
    console.log('[DriverTracking] Detecting inactive drivers...');

    const inactivityThreshold = new Date(Date.now() - INACTIVITY_TIMEOUT_MS);

    const result = await DriverTracking.updateMany(
      {
        status: { $in: ['ONLINE', 'BUSY'] },
        lastHeartbeatAt: { $lt: inactivityThreshold },
      },
      {
        $set: {
          status: 'INACTIVE',
          inactiveAt: new Date(),
          inactivityReason: 'NO_HEARTBEAT',
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[DriverTracking] Marked ${result.modifiedCount} drivers as inactive`);

      // Emit event for inactive drivers
      const io = getIO();
      io.emit('drivers_marked_inactive', {
        count: result.modifiedCount,
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      inactiveCount: result.modifiedCount,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in detectInactiveDrivers:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Get driver's current tracking info
 *
 * @param {string} driverId - Driver ID
 * @returns {object} Tracking record
 */
const getDriverTracking = async (driverId) => {
  try {
    const tracking = await DriverTracking.findOne({ driverId }).lean();

    if (!tracking) {
      return {
        success: false,
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver tracking record not found',
      };
    }

    return {
      success: true,
      tracking,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in getDriverTracking:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Get nearby online drivers
 *
 * @param {number} latitude - Reference latitude
 * @param {number} longitude - Reference longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {array} Array of nearby drivers
 */
const getNearbyDrivers = async (latitude, longitude, radiusKm = 5) => {
  try {
    const radiusMeters = radiusKm * 1000;

    const drivers = await DriverTracking.find({
      status: { $in: ['ONLINE', 'BUSY'] },
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select('driverId latitude longitude speed heading lastSeenAt status')
      .lean();

    return {
      success: true,
      drivers,
      count: drivers.length,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in getNearbyDrivers:', err.message);
    return {
      success: false,
      error: err.message,
      drivers: [],
    };
  }
};

/**
 * Get all online drivers
 *
 * @returns {array} Array of online drivers
 */
const getOnlineDrivers = async () => {
  try {
    const drivers = await DriverTracking.find({
      status: { $in: ['ONLINE', 'BUSY'] },
    })
      .select('driverId latitude longitude speed heading lastSeenAt status rideId')
      .lean();

    return {
      success: true,
      drivers,
      count: drivers.length,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in getOnlineDrivers:', err.message);
    return {
      success: false,
      error: err.message,
      drivers: [],
    };
  }
};

/**
 * Get driver's last known location
 *
 * @param {string} driverId - Driver ID
 * @returns {object} Last known location
 */
const getLastKnownLocation = async (driverId) => {
  try {
    const tracking = await DriverTracking.findOne({ driverId })
      .select('latitude longitude accuracy altitude lastLocationUpdateAt')
      .lean();

    if (!tracking) {
      return {
        success: false,
        error: 'DRIVER_NOT_FOUND',
      };
    }

    return {
      success: true,
      location: {
        latitude: tracking.latitude,
        longitude: tracking.longitude,
        accuracy: tracking.accuracy,
        altitude: tracking.altitude,
        lastUpdateAt: tracking.lastLocationUpdateAt,
      },
    };
  } catch (err) {
    console.error('[DriverTracking] Error in getLastKnownLocation:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Get driver statistics
 *
 * @param {string} driverId - Driver ID
 * @returns {object} Driver statistics
 */
const getDriverStats = async (driverId) => {
  try {
    const tracking = await DriverTracking.findOne({ driverId })
      .select('totalDistance totalRides averageSpeed heartbeatCount lastSeenAt')
      .lean();

    if (!tracking) {
      return {
        success: false,
        error: 'DRIVER_NOT_FOUND',
      };
    }

    return {
      success: true,
      stats: {
        totalDistance: tracking.totalDistance,
        totalRides: tracking.totalRides,
        averageSpeed: tracking.averageSpeed,
        heartbeatCount: tracking.heartbeatCount,
        lastSeenAt: tracking.lastSeenAt,
      },
    };
  } catch (err) {
    console.error('[DriverTracking] Error in getDriverStats:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Update driver status for a ride
 *
 * @param {string} driverId - Driver ID
 * @param {string} rideId - Ride ID
 * @param {string} status - New status
 * @returns {object} Result
 */
const updateRideStatus = async (driverId, rideId, status) => {
  try {
    const tracking = await DriverTracking.findOneAndUpdate(
      { driverId },
      {
        $set: {
          rideId,
          status: status || 'BUSY',
        },
      },
      { new: true }
    );

    return {
      success: true,
      tracking,
    };
  } catch (err) {
    console.error('[DriverTracking] Error in updateRideStatus:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  goOnline,
  goOffline,
  updateLocation,
  recordHeartbeat,
  detectInactiveDrivers,
  getDriverTracking,
  getNearbyDrivers,
  getOnlineDrivers,
  getLastKnownLocation,
  getDriverStats,
  updateRideStatus,
  HEARTBEAT_TIMEOUT_MS,
  INACTIVITY_TIMEOUT_MS,
};
