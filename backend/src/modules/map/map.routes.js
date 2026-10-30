const express = require('express');
const router = express.Router();
const MapController = require('./map.controller');

// GET /api/map/geocode?text=Delhi
router.get('/geocode', MapController.geocodeLocation);

// GET /api/map/reverse?lat=28.6328&lon=77.1197
router.get('/reverse', MapController.reverseGeocode);

// GET /api/map/autocomplete?text=Delhi
router.get('/autocomplete', MapController.autocompleteLocation);

// GET /api/map/route?pickupLat=28.6328&pickupLng=77.1197&dropLat=28.5355&dropLng=77.3910
router.get('/route', MapController.getRoute);

module.exports = router;
