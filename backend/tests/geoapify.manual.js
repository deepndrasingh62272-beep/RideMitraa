const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/map/geoapify';

// Test data
const testCases = {
  geocode: {
    address: 'Connaught Place, New Delhi',
  },
  reverseGeocode: {
    lat: 28.6328,
    lng: 77.1197,
  },
  route: {
    pickupLat: 28.6328,
    pickupLng: 77.1197,
    dropLat: 28.5355,
    dropLng: 77.3910,
  },
  search: {
    q: 'delhi airport',
    limit: 5,
  },
};

// Test functions
async function testGeocode() {
  console.log('\\n=== Testing Geocode ===');
  try {
    const response = await axios.get(`${BASE_URL}/geocode`, {
      params: testCases.geocode,
    });
    console.log('✓ Geocode Success:', response.data.data);
    return response.data.data;
  } catch (err) {
    console.error('✗ Geocode Failed:', err.response?.data || err.message);
  }
}

async function testReverseGeocode() {
  console.log('\\n=== Testing Reverse Geocode ===');
  try {
    const response = await axios.get(`${BASE_URL}/reverse-geocode`, {
      params: testCases.reverseGeocode,
    });
    console.log('✓ Reverse Geocode Success:', response.data.data);
    return response.data.data;
  } catch (err) {
    console.error('✗ Reverse Geocode Failed:', err.response?.data || err.message);
  }
}

async function testRoute() {
  console.log('\\n=== Testing Route ===');
  try {
    const response = await axios.get(`${BASE_URL}/route`, {
      params: testCases.route,
    });
    console.log('✓ Route Success:', {
      distance: response.data.data.distanceKm,
      duration: response.data.data.durationMin,
      eta: response.data.data.eta,
      stepsCount: response.data.data.steps.length,
    });
    return response.data.data;
  } catch (err) {
    console.error('✗ Route Failed:', err.response?.data || err.message);
  }
}

async function testSearch() {
  console.log('\\n=== Testing Search ===');
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: testCases.search,
    });
    console.log('✓ Search Success:', response.data.data);
    return response.data.data;
  } catch (err) {
    console.error('✗ Search Failed:', err.response?.data || err.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting Geoapify Integration Tests...');
  console.log('Base URL:', BASE_URL);

  await testGeocode();
  await testReverseGeocode();
  await testRoute();
  await testSearch();

  console.log('\\n=== All Tests Complete ===');
}

// Run tests
runAllTests().catch(console.error);
