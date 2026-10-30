const MapService = require('./map.service');

class MapController {
  // Geocode: Address to Coordinates
  static async geocodeLocation(req, res) {
    try {
      const { text } = req.query;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text parameter is required',
        });
      }

      const result = await MapService.geocodeLocation(text);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[Map Controller] Geocode error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Reverse Geocode: Coordinates to Address
  static async reverseGeocode(req, res) {
    try {
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required',
        });
      }

      const result = await MapService.reverseGeocode(lat, lon);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[Map Controller] Reverse geocode error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Autocomplete: Location suggestions
  static async autocompleteLocation(req, res) {
    try {
      const { text } = req.query;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text parameter is required',
        });
      }

      const results = await MapService.autocompleteLocation(text);

      res.json({
        success: true,
        data: results,
        count: results.length,
      });
    } catch (error) {
      console.error('[Map Controller] Autocomplete error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get Route: Distance, Duration, Polyline
  static async getRoute(req, res) {
    try {
      const { pickupLat, pickupLng, dropLat, dropLng } = req.query;

      if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
        return res.status(400).json({
          success: false,
          error: 'All coordinates (pickupLat, pickupLng, dropLat, dropLng) are required',
        });
      }

      const result = await MapService.getRoute(pickupLat, pickupLng, dropLat, dropLng);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[Map Controller] Route error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = MapController;
