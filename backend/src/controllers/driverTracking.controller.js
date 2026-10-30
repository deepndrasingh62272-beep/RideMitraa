const driverTrackingService = require('../services/driverTrackingService');

/**
 * POST /api/tracking/go-online
 * Mark driver as online
 */
exports.goOnline = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { platform, appVersion, osVersion } = req.body;

    const result = await driverTrackingService.goOnline(driverId, {
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      platform,
      appVersion,
      osVersion,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: result.tracking,
      message: result.message,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in goOnline controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * POST /api/tracking/go-offline
 * Mark driver as offline
 */
exports.goOffline = async (req, res) => {
  try {
    const driverId = req.user._id;

    const result = await driverTrackingService.goOffline(driverId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: result.tracking,
      message: result.message,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in goOffline controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * POST /api/tracking/:rideId/location
 * Update driver location with speed and heading
 */
exports.updateLocation = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { rideId } = req.params;
    const { latitude, longitude, speed, heading, accuracy, altitude } = req.body;

    // Validation
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_COORDINATES',
        message: 'Latitude and longitude are required',
      });
    }

    const result = await driverTrackingService.updateLocation(
      driverId,
      rideId,
      {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseFloat(speed) || 0,
        heading: parseFloat(heading) || 0,
        accuracy: accuracy ? parseFloat(accuracy) : null,
        altitude: altitude ? parseFloat(altitude) : null,
      }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.tracking,
      message: result.message,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in updateLocation controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * POST /api/tracking/heartbeat
 * Record driver heartbeat
 */
exports.recordHeartbeat = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { batteryLevel, isCharging, networkType } = req.body;

    const result = await driverTrackingService.recordHeartbeat(driverId, {
      batteryLevel: batteryLevel ? parseInt(batteryLevel) : null,
      isCharging: isCharging || false,
      networkType,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.tracking,
      message: 'Heartbeat recorded',
    });
  } catch (err) {
    console.error('[DriverTracking] Error in recordHeartbeat controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/driver/:driverId
 * Get driver's current tracking info
 */
exports.getDriverTracking = async (req, res) => {
  try {
    const { driverId } = req.params;

    const result = await driverTrackingService.getDriverTracking(driverId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result.tracking,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getDriverTracking controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/nearby?latitude=&longitude=&radius=5
 * Get nearby online drivers
 */
exports.getNearbyDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_COORDINATES',
        message: 'Latitude and longitude are required',
      });
    }

    const result = await driverTrackingService.getNearbyDrivers(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    res.json({
      success: true,
      data: result.drivers,
      count: result.count,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getNearbyDrivers controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/online-drivers
 * Get all online drivers
 */
exports.getOnlineDrivers = async (req, res) => {
  try {
    const result = await driverTrackingService.getOnlineDrivers();

    res.json({
      success: true,
      data: result.drivers,
      count: result.count,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getOnlineDrivers controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/driver/:driverId/last-location
 * Get driver's last known location
 */
exports.getLastKnownLocation = async (req, res) => {
  try {
    const { driverId } = req.params;

    const result = await driverTrackingService.getLastKnownLocation(driverId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result.location,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getLastKnownLocation controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/driver/:driverId/stats
 * Get driver statistics
 */
exports.getDriverStats = async (req, res) => {
  try {
    const { driverId } = req.params;

    const result = await driverTrackingService.getDriverStats(driverId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result.stats,
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getDriverStats controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/tracking/my-status
 * Get current user's tracking status
 */
exports.getMyStatus = async (req, res) => {
  try {
    const driverId = req.user._id;

    const result = await driverTrackingService.getDriverTracking(driverId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: {
        status: result.tracking.status,
        lastSeenAt: result.tracking.lastSeenAt,
        lastHeartbeatAt: result.tracking.lastHeartbeatAt,
        currentLocation: {
          latitude: result.tracking.latitude,
          longitude: result.tracking.longitude,
          speed: result.tracking.speed,
          heading: result.tracking.heading,
        },
        rideId: result.tracking.rideId,
      },
    });
  } catch (err) {
    console.error('[DriverTracking] Error in getMyStatus controller:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
