const request = require('supertest');
const app = require('./app');

const User = require('../src/models/User');
const BookingRequest = require('../src/models/BookingRequest');
const { checkRouteDeviation } = require('../src/utils/safety');

const {
  registerUser,
  approveDriverKYC,
  ridePayload,
  auth,
} = require('./helpers');

const pickup = {
  name: 'Connaught Place',
  coordinates: [77.2195, 28.6315],
};

const dropoff = {
  name: 'Cyber City',
  coordinates: [77.0878, 28.4949],
};

const publishRide = async (driverToken, overrides = {}) => {
  const res = await request(app)
    .post('/api/rides')
    .set(auth(driverToken))
    .send(ridePayload(overrides));

  expect(res.status).toBe(201);
  return res.body.ride;
};

describe('20. SAFETY + VEHICLE FEATURES', () => {
  test('BIKE rides enforce max 1 passenger and helmetRequired', async () => {
    const driver = await registerUser('9192000001', 'DRIVER', 'Bike Driver');
    await approveDriverKYC(driver.userId);

    const ride = await publishRide(driver.token, {
      vehicle: {
        type: 'BIKE',
        name: 'Pulsar 150',
        registrationNumber: 'DL01AB2233',
        seatingCapacity: 2,
      },
      vehicleType: 'BIKE',
      pickupRadius: 350,
    });

    expect(ride.vehicleType).toBe('BIKE');
    expect(ride.maxPassengers).toBe(1);
    expect(ride.availableSeats).toBe(1);
    expect(ride.vehicle.helmetRequired).toBe(true);
  });

  test('BIKE booking rejects seatsBooked > 1', async () => {
    const driver = await registerUser('9192000002', 'DRIVER', 'Bike Driver 2');
    await approveDriverKYC(driver.userId);

    const passenger = await registerUser('9192000003', 'PASSENGER', 'Bike Passenger');

    const ride = await publishRide(driver.token, {
      vehicle: {
        type: 'BIKE',
        name: 'Activa',
        registrationNumber: 'DL01AB3344',
        seatingCapacity: 2,
      },
      vehicleType: 'BIKE',
    });

    const bookingRes = await request(app)
      .post('/api/bookings')
      .set(auth(passenger.token))
      .send({
        rideId: ride._id,
        seatsBooked: 2,
        paymentMethod: 'CASH',
        pickup,
        dropoff,
      });

    expect(bookingRes.status).toBe(400);
    expect(bookingRes.body.error).toMatch(/max 1 passenger|Only 1 seat/i);
  });

  test('genderPreference blocks mismatched passenger gender', async () => {
    const driver = await registerUser('9192000004', 'DRIVER', 'Pref Driver');
    await approveDriverKYC(driver.userId);

    const malePassenger = await registerUser('9192000005', 'PASSENGER', 'Male Passenger');
    await User.findByIdAndUpdate(malePassenger.userId, { $set: { gender: 'MALE' } });

    const femalePassenger = await registerUser('9192000006', 'PASSENGER', 'Female Passenger');
    await User.findByIdAndUpdate(femalePassenger.userId, { $set: { gender: 'FEMALE' } });

    const ride = await publishRide(driver.token, {
      vehicleType: 'CAR',
      genderPreference: 'FEMALE_ONLY',
    });

    const blockedRes = await request(app)
      .post('/api/bookings')
      .set(auth(malePassenger.token))
      .send({
        rideId: ride._id,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup,
        dropoff,
      });

    expect(blockedRes.status).toBe(403);

    const allowedRes = await request(app)
      .post('/api/bookings')
      .set(auth(femalePassenger.token))
      .send({
        rideId: ride._id,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup,
        dropoff,
      });

    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.booking.seatsBooked).toBe(1);
  });

  test('pickupRadius enforces flexible pickup boundary (300-500m)', async () => {
    const driver = await registerUser('9192000007', 'DRIVER', 'Radius Driver');
    await approveDriverKYC(driver.userId);

    const passenger = await registerUser('9192000008', 'PASSENGER', 'Radius Passenger');

    const ride = await publishRide(driver.token, {
      pickupRadius: 300,
    });

    const farPickupRes = await request(app)
      .post('/api/bookings')
      .set(auth(passenger.token))
      .send({
        rideId: ride._id,
        passengersCount: 1,
        paymentMethod: 'CASH',
        pickup: {
          name: 'Far Pickup',
          coordinates: [77.2500, 28.6600],
        },
        dropoff,
      });

    expect(farPickupRes.status).toBe(400);
    expect(farPickupRes.body.error).toMatch(/within 300m/i);
  });

  test('search hides exact pickup location with offset', async () => {
    const driver = await registerUser('9192000009', 'DRIVER', 'Privacy Driver');
    await approveDriverKYC(driver.userId);

    const ride = await publishRide(driver.token, {
      pickup: {
        name: 'Privacy Pickup',
        address: 'CP',
        coordinates: [77.2195, 28.6315],
      },
      dropoff: {
        name: 'Privacy Drop',
        address: 'Cyber City',
        coordinates: [77.0878, 28.4949],
      },
    });

    const searchRes = await request(app)
      .get('/api/rides')
      .query({ pickup: 'Privacy Pickup', minSeats: 1 });

    expect(searchRes.status).toBe(200);
    const matched = (searchRes.body.rides || []).find((r) => String(r._id) === String(ride._id));
    expect(matched).toBeTruthy();
    expect(matched.pickup.locationPrivacy?.exactHidden).toBe(true);
    expect(matched.pickup.coordinates.coordinates).not.toEqual(ride.pickup.coordinates.coordinates);
  });

  test('after 5 min wait, driver can cancel no-show with penalty', async () => {
    const driver = await registerUser('9192000010', 'DRIVER', 'Wait Driver');
    await approveDriverKYC(driver.userId);

    const passenger = await registerUser('9192000011', 'PASSENGER', 'Wait Passenger');

    const ride = await publishRide(driver.token, {});

    const bookingCreate = await request(app)
      .post('/api/bookings')
      .set(auth(passenger.token))
      .send({
        rideId: ride._id,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup,
        dropoff,
      });

    expect(bookingCreate.status).toBe(201);
    const bookingId = bookingCreate.body.booking._id;

    const acceptRes = await request(app)
      .post(`/api/bookings/${bookingId}/accept`)
      .set(auth(driver.token));
    expect(acceptRes.status).toBe(200);

    const startRes = await request(app)
      .post(`/api/rides/${ride._id}/start`)
      .set(auth(driver.token));
    expect(startRes.status).toBe(200);

    await BookingRequest.findByIdAndUpdate(bookingId, {
      $set: {
        waitingStartedAt: new Date(Date.now() - 12 * 60 * 1000),
        status: 'ONGOING',
      },
    });

    const cancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set(auth(driver.token))
      .send({ reason: 'no_show_after_wait' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.cancelledBy).toBe('PASSENGER');
    expect(cancelRes.body.penaltyApplied).toBe(true);
    expect(Number(cancelRes.body.penaltyAmount)).toBeGreaterThan(0);
    expect(cancelRes.body.waiting.waitedMinutes).toBeGreaterThanOrEqual(12);
  });

  test('route deviation compares live point with planned route polyline', () => {
    const planned = [
      [77.2195, 28.6315],
      [77.1500, 28.5600],
      [77.0878, 28.4949],
    ];

    const near = checkRouteDeviation(
      [77.1510, 28.5608],
      [77.2195, 28.6315],
      [77.0878, 28.4949],
      planned
    );
    expect(near.deviated).toBe(false);

    const far = checkRouteDeviation(
      [77.3000, 28.7200],
      [77.2195, 28.6315],
      [77.0878, 28.4949],
      planned
    );
    expect(far.deviated).toBe(true);
    expect(far.deviationKm).toBeGreaterThan(1.5);
  });
});
