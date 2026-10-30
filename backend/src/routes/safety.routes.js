const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safety.controller');
const { authenticate } = require('../middleware/auth');

/**
 * Safety Routes
 * Base: /api/safety
 */

// Trigger SOS alert
router.post('/sos', authenticate, safetyController.triggerSOS);

// Update live location during SOS
router.post('/location', authenticate, safetyController.updateLiveLocation);

// Cancel SOS alert
router.post('/sos/cancel', authenticate, safetyController.cancelSOS);

// Alert emergency services
router.post('/emergency-services', authenticate, safetyController.alertEmergencyServices);

// Notify emergency contacts
router.post('/notify-contacts', authenticate, safetyController.notifyEmergencyContacts);

// Get safety record for a ride
router.get('/record/:rideId', authenticate, safetyController.getSafetyRecord);

// Resolve SOS incident
router.post('/resolve', authenticate, safetyController.resolveSOS);

// Get safety history for current user
router.get('/history', authenticate, safetyController.getSafetyHistory);

// Get all active SOS incidents (Admin)
router.get('/active-sos', authenticate, safetyController.getActiveSOS);

module.exports = router;
