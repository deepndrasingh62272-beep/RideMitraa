const request = require('supertest');
const app     = require('./app');
const User    = require('../src/models/User');
const Ride    = require('../src/models/Ride');
const { registerUser, approveDriverKYC, ridePayload, futureDateStr, auth } = require('./helpers');

describe('5. RIDE SEARCH', () => {
  let driverToken;

  beforeEach(async () => {
    const { token } = await registerUser('9111111501', 'DRIVER', 'Search Driver');
    driverToken = token;
    const driver = await User.findOne({ phone: '9111111501' });
    await approveDriverKYC(driver._id);

    // Publish two rides
    await request(app).post('/api/rides').set(auth(driverToken)).send(ridePayload());
    await request(app).post('/api/rides').set(auth(driverToken)).send(
      ridePayload({ farePerSeat: 80 })
    );
  });

  test('GET /api/rides — returns only BOOKING_OPEN rides', async () => {
    const res = await request(app).get('/api/rides');
    expect(res.status).toBe(200);
    res.body.rides.forEach((r) => expect(r.status).toBe('BOOKING_OPEN'));
  });

  test('All returned rides have availableSeats > 0', async () => {
    const res = await request(app).get('/api/rides');
    res.body.rides.forEach((r) => expect(r.availableSeats).toBeGreaterThan(0));
  });

  test('Sort by price — cheapest first', async () => {
    const res = await request(app).get('/api/rides').query({ sortBy: 'price' });
    const fares = res.body.rides.map((r) => r.farePerSeat);
    for (let i = 1; i < fares.length; i++) {
      expect(fares[i]).toBeGreaterThanOrEqual(fares[i - 1]);
    }
  });

  test('Geo search with pickup + dropoff filters does not return server error', async () => {
    const res = await request(app).get('/api/rides').query({
      pickupLng: 77.2195,
      pickupLat: 28.6315,
      dropoffLng: 77.0878,
      dropoffLat: 28.4949,
      radiusKm: 10,
      dropoffRadiusKm: 10,
      time: '21:28',
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.rides)).toBe(true);
  });

  test('Smart match — GET /api/rides/match returns scored results', async () => {
    const res = await request(app).get('/api/rides/match').query({
      pickupLng:  77.2195,
      pickupLat:  28.6315,
      dropoffLng: 77.0878,
      dropoffLat: 28.4949,
      date:       futureDateStr(),
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rides)).toBe(true);
    if (res.body.rides.length > 0) {
      expect(res.body.rides[0].meta.matchScore).toBeDefined();
    }
  });

  test('Match without required params — returns 400', async () => {
    const res = await request(app).get('/api/rides/match');
    expect(res.status).toBe(400);
  });
});
