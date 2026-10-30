const request = require('supertest');
const app     = require('./app');
const { calculateFareByVehicle } = require('../src/utils/fare');
const { calculateAvailableSeats } = require('../src/utils/seatValidation');

describe('4. PRICING ENGINE', () => {
  test('calculateFareByVehicle — car, 30km, ₹100/L, 15kmpl, 3 passengers', () => {
    const result = calculateFareByVehicle(30, 100, 15, 3, 'car');
    // fuelCost = 30*100/15 = 200, overhead = 30*3.5 = 105, total = 305
    expect(result.totalRideCost).toBeCloseTo(305, 1);
    // perSeat = 305/4 = 76.25
    expect(result.perSeatCost).toBeCloseTo(76.25, 1);
    // platformFee = ₹10 fixed
    expect(result.platformFee).toBe(10);
    // pricePerPassenger = 76.25 + 10 = 86.25
    expect(result.pricePerPassenger).toBeCloseTo(86.25, 1);
    // totalAmount = 86.25 * 3 = 258.75
    expect(result.totalAmount).toBeCloseTo(258.75, 1);
    // driverEarns = 305 - 10*3 = 275
    expect(result.driverEarns).toBeCloseTo(275, 1);
  });

  test('calculateFareByVehicle — bike, 10km, ₹110/L, 50kmpl, 1 passenger', () => {
    const result = calculateFareByVehicle(10, 110, 50, 1, 'bike');
    // fuelCost = 10*110/50 = 22, overhead = 10*1.5 = 15, total = 37
    expect(result.totalRideCost).toBeCloseTo(37, 1);
    expect(result.platformFee).toBe(10);
    expect(result.driverEarns).toBeCloseTo(27, 1); // 37 - 10
  });

  test('Fare breakdown API — returns correct structure', async () => {
    const res = await request(app)
      .post('/api/rides/fare-breakdown')
      .send({ distance: 20, fuelPrice: 100, mileage: 15, passengersCount: 2, vehicleType: 'car' });
    expect(res.status).toBe(200);
    expect(res.body.totalRideCost).toBeDefined();
    expect(res.body.platformFee).toBe(10);
    expect(res.body.driverEarns).toBeDefined();
  });

  test('Fare estimate API — returns all vehicle types', async () => {
    const res = await request(app)
      .get('/api/rides/fare-estimate')
      .query({ pickupLng: 77.2195, pickupLat: 28.6315, dropoffLng: 77.0878, dropoffLat: 28.4949 });
    expect(res.status).toBe(200);
    expect(res.body.allEstimates.BIKE).toBeDefined();
    expect(res.body.allEstimates.SEDAN).toBeDefined();
    expect(res.body.distanceKm).toBeGreaterThan(0);
  });

  test('Invalid vehicleType throws error', () => {
    expect(() => calculateFareByVehicle(10, 100, 15, 1, 'truck')).toThrow();
  });

  test('Zero distance throws error', () => {
    expect(() => calculateFareByVehicle(0, 100, 15, 1, 'car')).toThrow();
  });
});
