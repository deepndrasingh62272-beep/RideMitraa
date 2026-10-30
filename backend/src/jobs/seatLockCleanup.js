const seatLockService = require('../services/seatLockService');

/**
 * Background job to cleanup expired seat locks
 * Runs every 1 minute
 */
const startSeatLockCleanup = () => {
  console.log('[SeatLockCleanup] Starting seat lock cleanup job...');

  // Run cleanup every 1 minute
  setInterval(async () => {
    try {
      const result = await seatLockService.releaseExpiredLocks();
      if (result.success && result.releasedCount > 0) {
        console.log(`[SeatLockCleanup] Cleaned up ${result.releasedCount} expired locks`);
      }
    } catch (err) {
      console.error('[SeatLockCleanup] Error in cleanup job:', err.message);
    }
  }, 60 * 1000); // 1 minute
};

module.exports = {
  startSeatLockCleanup,
};
