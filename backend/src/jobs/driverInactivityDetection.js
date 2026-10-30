const driverTrackingService = require('../services/driverTrackingService');

/**
 * Background job to detect and mark inactive drivers
 * Runs every 1 minute
 */
const startInactivityDetection = () => {
  console.log('[DriverInactivity] Starting driver inactivity detection job...');

  // Run detection every 1 minute
  setInterval(async () => {
    try {
      const result = await driverTrackingService.detectInactiveDrivers();
      if (result.success && result.inactiveCount > 0) {
        console.log(`[DriverInactivity] Marked ${result.inactiveCount} drivers as inactive`);
      }
    } catch (err) {
      console.error('[DriverInactivity] Error in detection job:', err.message);
    }
  }, 60 * 1000); // 1 minute
};

module.exports = {
  startInactivityDetection,
};
