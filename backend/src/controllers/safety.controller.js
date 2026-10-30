const safetyService = require('../services/safetyService');

class SafetyController {
  /**
   * POST /api/safety/sos
   * Trigger SOS alert
   */
  async triggerSOS(req, res) {
    try {
      const { rideId } = req.body;
      const passengerId = req.user.id; // From auth middleware

      if (!rideId) {
        return res.status(400).json({
          success: false,
          message: 'rideId is required',
        });
      }

      const result = await safetyService.triggerSOS(rideId, passengerId);

      res.status(200).json({
        success: true,
        message: 'SOS triggered successfully',
        data: result,
      });
    } catch (error) {
      console.error('SOS trigger error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger SOS',
      });
    }
  }

  /**
   * POST /api/safety/location
   * Update live location during SOS
   */
  async updateLiveLocation(req, res) {
    try {
      const { rideId, location } = req.body;

      if (!rideId || !location || location.lat === undefined || location.lng === undefined) {
        return res.status(400).json({
          success: false,
          message: 'rideId and location (lat, lng) are required',
        });
      }

      const result = await safetyService.updateLiveLocation(rideId, location);

      res.status(200).json({
        success: true,
        message: 'Location updated',
        data: result,
      });
    } catch (error) {
      console.error('Location update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
      });
    }
  }

  /**
   * POST /api/safety/sos/cancel
   * Cancel SOS alert
   */
  async cancelSOS(req, res) {
    try {
      const { rideId } = req.body;

      if (!rideId) {
        return res.status(400).json({
          success: false,
          message: 'rideId is required',
        });
      }

      const result = await safetyService.cancelSOS(rideId);

      res.status(200).json({
        success: true,
        message: 'SOS cancelled',
        data: result,
      });
    } catch (error) {
      console.error('SOS cancel error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel SOS',
      });
    }
  }

  /**
   * POST /api/safety/emergency-services
   * Alert emergency services
   */
  async alertEmergencyServices(req, res) {
    try {
      const { rideId, serviceType, location } = req.body;

      if (!rideId || !serviceType || !location) {
        return res.status(400).json({
          success: false,
          message: 'rideId, serviceType, and location are required',
        });
      }

      if (!['police', 'ambulance'].includes(serviceType)) {
        return res.status(400).json({
          success: false,
          message: 'serviceType must be "police" or "ambulance"',
        });
      }

      const result = await safetyService.alertEmergencyServices(rideId, serviceType, location);

      res.status(200).json({
        success: true,
        message: `${serviceType} alerted successfully`,
        data: result,
      });
    } catch (error) {
      console.error('Emergency alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to alert emergency services',
      });
    }
  }

  /**
   * POST /api/safety/notify-contacts
   * Notify emergency contacts
   */
  async notifyEmergencyContacts(req, res) {
    try {
      const { rideId } = req.body;
      const passengerId = req.user.id;

      if (!rideId) {
        return res.status(400).json({
          success: false,
          message: 'rideId is required',
        });
      }

      const result = await safetyService.notifyEmergencyContacts(rideId, passengerId);

      res.status(200).json({
        success: true,
        message: 'Emergency contacts notified',
        data: result,
      });
    } catch (error) {
      console.error('Emergency contact notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to notify emergency contacts',
      });
    }
  }

  /**
   * GET /api/safety/record/:rideId
   * Get safety record for a ride
   */
  async getSafetyRecord(req, res) {
    try {
      const { rideId } = req.params;

      const safety = await safetyService.getSafetyRecord(rideId);

      if (!safety) {
        return res.status(404).json({
          success: false,
          message: 'Safety record not found',
        });
      }

      res.status(200).json({
        success: true,
        data: safety,
      });
    } catch (error) {
      console.error('Get safety record error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch safety record',
      });
    }
  }

  /**
   * POST /api/safety/resolve
   * Resolve SOS incident
   */
  async resolveSOS(req, res) {
    try {
      const { rideId, resolutionNotes } = req.body;

      if (!rideId) {
        return res.status(400).json({
          success: false,
          message: 'rideId is required',
        });
      }

      const result = await safetyService.resolveSOS(rideId, resolutionNotes);

      res.status(200).json({
        success: true,
        message: 'SOS resolved',
        data: result,
      });
    } catch (error) {
      console.error('SOS resolve error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve SOS',
      });
    }
  }

  /**
   * GET /api/safety/history
   * Get safety history for current user
   */
  async getSafetyHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const history = await safetyService.getSafetyHistory(userId, limit);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Get safety history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch safety history',
      });
    }
  }

  /**
   * GET /api/safety/active-sos (Admin only)
   * Get all active SOS incidents
   */
  async getActiveSOS(req, res) {
    try {
      // Check if user is admin (implement based on your auth system)
      // if (req.user.role !== 'admin') {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Unauthorized',
      //   });
      // }

      const activeSOS = await safetyService.getActiveSOS();

      res.status(200).json({
        success: true,
        data: activeSOS,
      });
    } catch (error) {
      console.error('Get active SOS error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active SOS incidents',
      });
    }
  }
}

module.exports = new SafetyController();
