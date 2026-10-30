/**
 * Test Offer Ride API Integration
 * Tests geocoding and fare estimation endpoints
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testOfferRideAPI() {
  console.log('🚀 Testing Offer Ride API Integration\n');

  try {
    // Test 1: Geocode Sitapur
    console.log('1️⃣  Testing Geocoding: Sitapur');
    const sitapurGeo = await axios.get(`${API_BASE}/map/geocode`, {
      params: { address: 'Sitapur, Uttar Pradesh' }
    });
    console.log('✅ Sitapur Geocoded:', sitapurGeo.data.data);
    const sitapurCoords = [sitapurGeo.data.data.lng, sitapurGeo.data.data.lat];
    console.log('   Coordinates [lng, lat]:', sitapurCoords);

    // Test 2: Geocode Mathura
    console.log('\n2️⃣  Testing Geocoding: Mathura');
    const mathuraGeo = await axios.get(`${API_BASE}/map/geocode`, {
      params: { address: 'Mathura, Uttar Pradesh' }
    });
    console.log('✅ Mathura Geocoded:', mathuraGeo.data.data);
    const mathuraCoords = [mathuraGeo.data.data.lng, mathuraGeo.data.data.lat];
    console.log('   Coordinates [lng, lat]:', mathuraCoords);

    // Test 3: Fare Estimate for Car
    console.log('\n3️⃣  Testing Fare Estimate: Car (Sitapur → Mathura)');
    const carFare = await axios.get(`${API_BASE}/rides/fare-estimate`, {
      params: {
        pickupLat: sitapurCoords[1],
        pickupLng: sitapurCoords[0],
        dropoffLat: mathuraCoords[1],
        dropoffLng: mathuraCoords[0],
        vehicleType: 'CAR'
      }
    });
    console.log('✅ Car Fare Estimate:');
    console.log('   Distance:', carFare.data.distanceKm, 'km');
    console.log('   Fare Per Seat:', carFare.data.farePerSeat, '₹');
    console.log('   Full Response:', JSON.stringify(carFare.data, null, 2));

    // Test 4: Fare Estimate for Bike
    console.log('\n4️⃣  Testing Fare Estimate: Bike (Sitapur → Mathura)');
    const bikeFare = await axios.get(`${API_BASE}/rides/fare-estimate`, {
      params: {
        pickupLat: sitapurCoords[1],
        pickupLng: sitapurCoords[0],
        dropoffLat: mathuraCoords[1],
        dropoffLng: mathuraCoords[0],
        vehicleType: 'BIKE'
      }
    });
    console.log('✅ Bike Fare Estimate:');
    console.log('   Distance:', bikeFare.data.distanceKm, 'km');
    console.log('   Fare Per Seat:', bikeFare.data.farePerSeat, '₹');
    console.log('   Full Response:', JSON.stringify(bikeFare.data, null, 2));

    // Test 5: Fare Estimate for Delhi to Pune
    console.log('\n5️⃣  Testing Geocoding: Delhi');
    const delhiGeo = await axios.get(`${API_BASE}/map/geocode`, {
      params: { address: 'Delhi' }
    });
    const delhiCoords = [delhiGeo.data.data.lng, delhiGeo.data.data.lat];
    console.log('✅ Delhi Coordinates:', delhiCoords);

    console.log('\n6️⃣  Testing Geocoding: Pune');
    const puneGeo = await axios.get(`${API_BASE}/map/geocode`, {
      params: { address: 'Pune, Maharashtra' }
    });
    const puneCoords = [puneGeo.data.data.lng, puneGeo.data.data.lat];
    console.log('✅ Pune Coordinates:', puneCoords);

    console.log('\n7️⃣  Testing Fare Estimate: Car (Delhi → Pune)');
    const delhiPuneFare = await axios.get(`${API_BASE}/rides/fare-estimate`, {
      params: {
        pickupLat: delhiCoords[1],
        pickupLng: delhiCoords[0],
        dropoffLat: puneCoords[1],
        dropoffLng: puneCoords[0],
        vehicleType: 'CAR'
      }
    });
    console.log('✅ Delhi to Pune Fare:');
    console.log('   Distance:', delhiPuneFare.data.distanceKm, 'km');
    console.log('   Fare Per Seat:', delhiPuneFare.data.farePerSeat, '₹');

    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log('   Sitapur → Mathura (Car):', carFare.data.distanceKm, 'km,', carFare.data.farePerSeat, '₹/seat');
    console.log('   Sitapur → Mathura (Bike):', bikeFare.data.distanceKm, 'km,', bikeFare.data.farePerSeat, '₹/seat');
    console.log('   Delhi → Pune (Car):', delhiPuneFare.data.distanceKm, 'km,', delhiPuneFare.data.farePerSeat, '₹/seat');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testOfferRideAPI();
