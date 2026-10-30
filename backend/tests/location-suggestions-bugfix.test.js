/**
 * BUG CONDITION EXPLORATION TEST
 * 
 * This test encodes the expected behavior for the location suggestions bugfix.
 * It MUST FAIL on unfixed code - failure confirms the bugs exist.
 * 
 * Bug Conditions Being Tested:
 * 1. Location suggestions do not appear when typing in "Offer Ride" Step 1 fields
 * 2. Maps do not display when locations are populated
 * 3. Geocoding API returns 404 for addresses like "luckonw"
 * 4. Image loading returns 400 for ui-avatars.com URLs
 * 
 * Expected Behavior (after fix):
 * 1. Location suggestions SHOULD appear when typing in "Offer Ride" Step 1 fields
 * 2. Maps SHOULD display when locations are populated
 * 3. Geocoding API SHOULD return successful results for valid addresses
 * 4. Image loading SHOULD return 200 for ui-avatars.com URLs
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

const fc = require('fast-check');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

describe('BUG CONDITION EXPLORATION: Location Suggestions Bugfix', () => {
  // ─────────────────────────────────────────────────────
  // Property 1: Location Suggestions in "Offer Ride" Step 1
  // ─────────────────────────────────────────────────────
  describe('Property 1: Location Suggestions Display', () => {
    test('1.1 Location suggestions MUST appear when typing in pickup location field (Offer Ride Step 1)', async () => {
      /**
       * Bug Condition: User types in pickup location field in "Offer Ride" Step 1
       * Expected Behavior: System displays relevant location suggestions
       * Validates: Requirement 1.1 - WHEN a user types in the pickup location field in "Offer Ride" Step 1 THEN the system does not show location suggestions
       * Expected Behavior: 2.1 - WHEN a user types in the pickup location field in "Offer Ride" Step 1 THEN the system SHALL display relevant location suggestions
       */
      
      const testCases = [
        { input: 'Delhi', context: 'offer_ride_step1', type: 'pickup' },
        { input: 'Lucknow', context: 'offer_ride_step1', type: 'pickup' },
        { input: 'Mumbai', context: 'offer_ride_step1', type: 'pickup' },
        { input: 'Bangalore', context: 'offer_ride_step1', type: 'pickup' },
      ];

      for (const testCase of testCases) {
        try {
          const response = await axios.get(`${BASE_URL}/map/autocomplete`, {
            params: { q: testCase.input },
            timeout: 5000,
          });

          // Expected behavior: suggestions should be returned
          expect(response.status).toBe(200);
          expect(response.data.success).toBe(true);
          expect(Array.isArray(response.data.data)).toBe(true);
          expect(response.data.data.length).toBeGreaterThan(0);
          
          // Verify suggestion structure
          response.data.data.forEach(suggestion => {
            expect(suggestion).toHaveProperty('address');
            expect(suggestion).toHaveProperty('lat');
            expect(suggestion).toHaveProperty('lng');
          });
        } catch (error) {
          // This test MUST FAIL on unfixed code
          console.error(`❌ BUG DETECTED: Pickup location suggestions failed for "${testCase.input}":`, error.message);
          throw new Error(`Location suggestions failed for pickup location "${testCase.input}": ${error.message}`);
        }
      }
    });

    test('1.2 Location suggestions MUST appear when typing in drop location field (Offer Ride Step 1)', async () => {
      /**
       * Bug Condition: User types in drop location field in "Offer Ride" Step 1
       * Expected Behavior: System displays relevant location suggestions
       * Validates: Requirement 1.2 - WHEN a user types in the drop location field in "Offer Ride" Step 1 THEN the system does not show location suggestions
       * Expected Behavior: 2.2 - WHEN a user types in the drop location field in "Offer Ride" Step 1 THEN the system SHALL display relevant location suggestions
       */
      
      const testCases = [
        { input: 'Noida', context: 'offer_ride_step1', type: 'drop' },
        { input: 'Gurgaon', context: 'offer_ride_step1', type: 'drop' },
        { input: 'Pune', context: 'offer_ride_step1', type: 'drop' },
        { input: 'Hyderabad', context: 'offer_ride_step1', type: 'drop' },
      ];

      for (const testCase of testCases) {
        try {
          const response = await axios.get(`${BASE_URL}/map/autocomplete`, {
            params: { q: testCase.input },
            timeout: 5000,
          });

          // Expected behavior: suggestions should be returned
          expect(response.status).toBe(200);
          expect(response.data.success).toBe(true);
          expect(Array.isArray(response.data.data)).toBe(true);
          expect(response.data.data.length).toBeGreaterThan(0);
          
          // Verify suggestion structure
          response.data.data.forEach(suggestion => {
            expect(suggestion).toHaveProperty('address');
            expect(suggestion).toHaveProperty('lat');
            expect(suggestion).toHaveProperty('lng');
          });
        } catch (error) {
          // This test MUST FAIL on unfixed code
          console.error(`❌ BUG DETECTED: Drop location suggestions failed for "${testCase.input}":`, error.message);
          throw new Error(`Location suggestions failed for drop location "${testCase.input}": ${error.message}`);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // Property 2: Map Display When Locations Are Populated
  // ─────────────────────────────────────────────────────
  describe('Property 2: Map Display Integration', () => {
    test('1.3 Maps MUST display when locations are populated in Offer Ride Step 1', async () => {
      /**
       * Bug Condition: Location fields are populated in "Offer Ride" Step 1
       * Expected Behavior: System displays a map showing the selected locations
       * Validates: Requirement 1.3 - WHEN location fields are populated THEN the system does not display a map below the input box
       * Expected Behavior: 2.3 - WHEN location fields are populated THEN the system SHALL display a map showing the selected locations
       */
      
      const testCases = [
        { 
          pickup: 'Delhi', 
          drop: 'Noida',
          pickupCoords: { lat: 28.6139, lng: 77.2090 },
          dropCoords: { lat: 28.5355, lng: 77.3910 }
        },
        { 
          pickup: 'Mumbai', 
          drop: 'Pune',
          pickupCoords: { lat: 19.0760, lng: 72.8777 },
          dropCoords: { lat: 18.5204, lng: 73.8567 }
        },
      ];

      for (const testCase of testCases) {
        try {
          // First, geocode the pickup location
          const pickupResponse = await axios.get(`${BASE_URL}/map/geocode`, {
            params: { address: testCase.pickup },
            timeout: 5000,
          });

          expect(pickupResponse.status).toBe(200);
          expect(pickupResponse.data.success).toBe(true);
          expect(pickupResponse.data.data).toHaveProperty('lat');
          expect(pickupResponse.data.data).toHaveProperty('lng');

          // Then, geocode the drop location
          const dropResponse = await axios.get(`${BASE_URL}/map/geocode`, {
            params: { address: testCase.drop },
            timeout: 5000,
          });

          expect(dropResponse.status).toBe(200);
          expect(dropResponse.data.success).toBe(true);
          expect(dropResponse.data.data).toHaveProperty('lat');
          expect(dropResponse.data.data).toHaveProperty('lng');

          // Now verify that map data can be retrieved (route calculation)
          const routeResponse = await axios.get(`${BASE_URL}/map/route`, {
            params: {
              pickupLat: pickupResponse.data.data.lat,
              pickupLng: pickupResponse.data.data.lng,
              dropLat: dropResponse.data.data.lat,
              dropLng: dropResponse.data.data.lng,
            },
            timeout: 8000,
          });

          // Expected behavior: route should be returned (map data available)
          expect(routeResponse.status).toBe(200);
          expect(routeResponse.data.success).toBe(true);
          expect(routeResponse.data.data).toHaveProperty('distanceKm');
          expect(routeResponse.data.data).toHaveProperty('durationMin');
          expect(routeResponse.data.data).toHaveProperty('polyline');
        } catch (error) {
          // This test MUST FAIL on unfixed code
          console.error(`❌ BUG DETECTED: Map display failed for route ${testCase.pickup} → ${testCase.drop}:`, error.message);
          throw new Error(`Map display failed for route ${testCase.pickup} → ${testCase.drop}: ${error.message}`);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // Property 3: Geocoding API Error Handling
  // ─────────────────────────────────────────────────────
  describe('Property 3: Geocoding API Robustness', () => {
    test('1.4 Geocoding API MUST handle typos gracefully (e.g., "luckonw" should not return 404)', async () => {
      /**
       * Bug Condition: Geocoding API is called with addresses like "luckonw" (typo for "lucknow")
       * Expected Behavior: System returns successful geocoding results or graceful error handling
       * Validates: Requirement 1.4 - WHEN the geocoding API is called with addresses like "luckonw" THEN the system returns 404 Not Found errors
       * Expected Behavior: 2.4 - WHEN the geocoding API is called with valid addresses THEN the system SHALL return successful geocoding results
       */
      
      const testCases = [
        { input: 'luckonw', expectedCity: 'Lucknow' },  // Typo for Lucknow
        { input: 'deli', expectedCity: 'Delhi' },       // Typo for Delhi
        { input: 'mumbai', expectedCity: 'Mumbai' },    // Valid
        { input: 'bangalore', expectedCity: 'Bangalore' }, // Valid
      ];

      for (const testCase of testCases) {
        try {
          const response = await axios.get(`${BASE_URL}/map/geocode`, {
            params: { address: testCase.input },
            timeout: 5000,
          });

          // Expected behavior: should return 200 (not 404)
          expect(response.status).toBe(200);
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty('lat');
          expect(response.data.data).toHaveProperty('lng');
          expect(response.data.data).toHaveProperty('formattedAddress');
          
          // Verify coordinates are valid
          expect(typeof response.data.data.lat).toBe('number');
          expect(typeof response.data.data.lng).toBe('number');
          expect(response.data.data.lat).toBeGreaterThanOrEqual(-90);
          expect(response.data.data.lat).toBeLessThanOrEqual(90);
          expect(response.data.data.lng).toBeGreaterThanOrEqual(-180);
          expect(response.data.data.lng).toBeLessThanOrEqual(180);
        } catch (error) {
          // This test MUST FAIL on unfixed code
          console.error(`❌ BUG DETECTED: Geocoding failed for "${testCase.input}":`, error.message);
          throw new Error(`Geocoding failed for "${testCase.input}": ${error.message}`);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // Property 4: Image Loading from External Services
  // ─────────────────────────────────────────────────────
  describe('Property 4: Image Loading Robustness', () => {
    test('1.5 Image loading MUST succeed for ui-avatars.com URLs (should not return 400)', async () => {
      /**
       * Bug Condition: User avatar images are loaded from ui-avatars.com
       * Expected Behavior: System loads and displays the images correctly
       * Validates: Requirement 1.5 - WHEN user avatar images are loaded THEN the system returns 400 Bad Request errors
       * Expected Behavior: 2.5 - WHEN user avatar images are requested THEN the system SHALL load and display the images correctly
       */
      
      const testCases = [
        { name: 'John Doe', url: 'https://ui-avatars.com/api/?name=John+Doe' },
        { name: 'Jane Smith', url: 'https://ui-avatars.com/api/?name=Jane+Smith' },
        { name: 'Test User', url: 'https://ui-avatars.com/api/?name=Test+User' },
      ];

      for (const testCase of testCases) {
        try {
          // Test direct image loading
          const response = await axios.get(testCase.url, {
            timeout: 5000,
            responseType: 'arraybuffer',
          });

          // Expected behavior: should return 200 (not 400)
          expect(response.status).toBe(200);
          expect(response.headers['content-type']).toMatch(/image/);
          expect(response.data).toBeDefined();
          expect(response.data.length).toBeGreaterThan(0);
        } catch (error) {
          // This test MUST FAIL on unfixed code
          console.error(`❌ BUG DETECTED: Image loading failed for "${testCase.name}":`, error.message);
          throw new Error(`Image loading failed for "${testCase.name}": ${error.message}`);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // Property 5: Preservation - Non-Buggy Inputs
  // ─────────────────────────────────────────────────────
  describe('Property 5: Preservation of Non-Buggy Behavior', () => {
    test('1.6 Location suggestions in OTHER contexts MUST continue to work (preservation)', async () => {
      /**
       * Preservation Test: Location inputs in contexts OTHER than "offer_ride_step1"
       * Expected Behavior: These should continue to work as before
       * Validates: Requirement 3.1 - WHEN location suggestions are working THEN the system SHALL CONTINUE TO filter suggestions based on user input
       */
      
      const testCases = [
        { input: 'Delhi', context: 'search_ride' },
        { input: 'Mumbai', context: 'saved_locations' },
        { input: 'Bangalore', context: 'recent_locations' },
      ];

      for (const testCase of testCases) {
        try {
          const response = await axios.get(`${BASE_URL}/map/autocomplete`, {
            params: { q: testCase.input },
            timeout: 5000,
          });

          // Expected behavior: should work for non-buggy contexts
          expect(response.status).toBe(200);
          expect(response.data.success).toBe(true);
          expect(Array.isArray(response.data.data)).toBe(true);
        } catch (error) {
          console.error(`⚠️  Preservation issue: Location suggestions failed for context "${testCase.context}":`, error.message);
          throw new Error(`Preservation failed: Location suggestions in "${testCase.context}" context: ${error.message}`);
        }
      }
    });

    test('1.7 Geocoding for VALID addresses MUST continue to work (preservation)', async () => {
      /**
       * Preservation Test: Geocoding requests for valid addresses (not containing "luckonw")
       * Expected Behavior: These should continue to work as before
       * Validates: Requirement 3.4 - WHEN other parts of the application request geocoding THEN the system SHALL CONTINUE TO function correctly
       */
      
      const testCases = [
        { input: 'Connaught Place, Delhi' },
        { input: 'Gateway of India, Mumbai' },
        { input: 'Vidhana Soudha, Bangalore' },
      ];

      for (const testCase of testCases) {
        try {
          const response = await axios.get(`${BASE_URL}/map/geocode`, {
            params: { address: testCase.input },
            timeout: 5000,
          });

          // Expected behavior: should work for valid addresses
          expect(response.status).toBe(200);
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty('lat');
          expect(response.data.data).toHaveProperty('lng');
        } catch (error) {
          console.error(`⚠️  Preservation issue: Geocoding failed for valid address "${testCase.input}":`, error.message);
          throw new Error(`Preservation failed: Geocoding for valid address "${testCase.input}": ${error.message}`);
        }
      }
    });

    test('1.8 Image loading from OTHER sources MUST continue to work (preservation)', async () => {
      /**
       * Preservation Test: Image loading from sources OTHER than ui-avatars.com
       * Expected Behavior: These should continue to work as before
       * Validates: Requirement 3.5 - WHEN other image loading requests are made THEN the system SHALL CONTINUE TO load images correctly
       */
      
      const testCases = [
        { name: 'Gravatar', url: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=identicon' },
        { name: 'Placeholder', url: 'https://via.placeholder.com/150' },
      ];

      for (const testCase of testCases) {
        try {
          // Use the image proxy endpoint to load images
          const proxyUrl = `${BASE_URL}/map/image-proxy?url=${encodeURIComponent(testCase.url)}`;
          const response = await axios.get(proxyUrl, {
            timeout: 5000,
            responseType: 'arraybuffer',
          });

          // Expected behavior: should work for other image sources
          expect(response.status).toBe(200);
          expect(response.headers['content-type']).toMatch(/image/);
        } catch (error) {
          console.error(`⚠️  Preservation issue: Image loading failed for "${testCase.name}":`, error.message);
          throw new Error(`Preservation failed: Image loading from "${testCase.name}": ${error.message}`);
        }
      }
    });
  });
});
