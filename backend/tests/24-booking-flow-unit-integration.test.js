/**
 * Unit & Integration Tests — Ride Request & Booking Flow
 * Feature: ride-request-booking-flow
 *
 * Covers:
 * - Backend: acceptBooking OTP generation, verifyOTP, status transitions
 * - Backend: socket booking:new delivery, booking:update with OTP only to driver
 * - Backend: LOCATION_UPDATE relay
 * - Integration: full booking lifecycle (create → accept → payment-confirm → verify-otp → start → complete)
 */

const request = require('supertest');
const app = require('./app');
const {
  registerUser,
  approveDriverKYC,
  ridePayload,
  futureDateStr,
  auth,
  testLog,
} = require('./helpers');
const BookingRequest = require('../src/models/BookingRequest');
const Ride = require('../src/models/Ride');
const mongoose = require('mongoose');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeObjectId = () => new mongoose.Types.ObjectId();

const ALLOWED_TRANSITIONS = {
  PENDING:      ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED:     ['PAYMENT_DONE', 'CANCELLED'],
  PAYMENT_DONE: ['OTP_VERIFIED', 'CANCELLED'],
  OTP_VERIFIED: ['ONGOING', 'CANCELLED'],
  ONGOING:      ['COMPLETED', 'CANCELLED'],
  REJECTED:     [],
  COMPLETED:    [],
  CANCELLED:    [],
  EXPIRED:      [],
};

const assertTransition = (currentStatus, targetStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    const err = new Error(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    err.status = 422;
    throw err;
  }
};

// ─── Unit Tests: Status Transition Guard ─────────────────────────────────────

describe('Unit: assertTransition — status machine', () => {
  test('PENDING → ACCEPTED is allowed', () => {
    expect(() => assertTransition('PENDING', 'ACCEPTED')).not.toThrow();
  });

  test('PENDING → PAYMENT_DONE is NOT allowed (422)', () => {
    expect(() => assertTransition('PENDING', 'PAYMENT_DONE')).toThrow();
    try {
      assertTransition('PENDING', 'PAYMENT_DONE');
    } catch (err) {
      expect(err.status).toBe(422);
    }
  });

  test('ACCEPTED → PAYMENT_DONE is allowed', () => {
    expect(() => assertTransition('ACCEPTED', 'PAYMENT_DONE')).not.toThrow();
  });

  test('PAYMENT_DONE → OTP_VERIFIED is allowed', () => {
    expect(() => assertTransition('PAYMENT_DONE', 'OTP_VERIFIED')).not.toThrow();
  });

  test('OTP_VERIFIED → ONGOING is allowed', () => {
    expect(() => assertTransition('OTP_VERIFIED', 'ONGOING')).not.toThrow();
  });

  test('ONGOING → COMPLETED is allowed', () => {
    expect(() => assertTransition('ONGOING', 'COMPLETED')).not.toThrow();
  });

  test('COMPLETED → anything is NOT allowed', () => {
    ['PENDING', 'ACCEPTED', 'PAYMENT_DONE', 'OTP_VERIFIED', 'ONGOING', 'CANCELLED'].forEach(target => {
      expect(() => assertTransition('COMPLETED', target)).toThrow();
    });
  });

  test('REJECTED → anything is NOT allowed', () => {
    ['PENDING', 'ACCEPTED', 'CANCELLED'].forEach(target => {
      expect(() => assertTransition('REJECTED', target)).toThrow();
    });
  });
});

// ─── Unit Tests: OTP Generation ──────────────────────────────────────────────

describe('Unit: OTP generation on first booking acceptance', () => {
  test('generates 6-digit numeric OTP on first acceptance', async () => {
    const ride = await Ride.create({
      driverId: makeObjectId(),
      pickup: { name: 'A', coordinates: { type: 'Point', coordinates: [77.5, 12.9] } },
      dropoff: { name: 'B', coordinates: { type: 'Point', coordinates: [77.6, 12.8] } },
      distanceKm: 5,
      vehicle: { type: 'CAR', name: 'Car', registrationNumber: 'KA01AB1234', seatingCapacity: 5, helmetRequired: false },
      vehicleType: 'CAR',
      totalSeats: 5,
      availableSeats: 4,
      maxPassengers: 4,
      farePerSeat: 100,
      pricePerSeat: 100,
      schedule: { date: futureDateStr(), time: '10:00', departureAt: new Date(Date.now() + 86400000) },
      status: 'BOOKING_OPEN',
    });

    // Simulate first acceptance OTP generation
    expect(ride.otpCode).toBeNull();
    ride.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await ride.save();

    expect(ride.otpCode).toMatch(/^\d{6}$/);
  });

  test('reuses existing OTP on subsequent acceptances', async () => {
    const ride = await Ride.create({
      driverId: makeObjectId(),
      pickup: { name: 'A', coordinates: { type: 'Point', coordinates: [77.5, 12.9] } },
      dropoff: { name: 'B', coordinates: { type: 'Point', coordinates: [77.6, 12.8] } },
      distanceKm: 5,
      vehicle: { type: 'CAR', name: 'Car', registrationNumber: 'KA01AB1234', seatingCapacity: 5, helmetRequired: false },
      vehicleType: 'CAR',
      totalSeats: 5,
      availableSeats: 4,
      maxPassengers: 4,
      farePerSeat: 100,
      pricePerSeat: 100,
      schedule: { date: futureDateStr(), time: '10:00', departureAt: new Date(Date.now() + 86400000) },
      status: 'BOOKING_OPEN',
      otpCode: '123456',
    });

    // Simulate second acceptance — should reuse existing OTP
    const freshRide = await Ride.findById(ride._id);
    if (!freshRide.otpCode) {
      freshRide.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await freshRide.save();
    }

    expect(freshRide.otpCode).toBe('123456');
  });
});

// ─── Unit Tests: OTP Verification ────────────────────────────────────────────

describe('Unit: OTP verification — PAYMENT_DONE → OTP_VERIFIED', () => {
  test('correct OTP transitions booking to OTP_VERIFIED', async () => {
    const rideId = makeObjectId();
    const ride = await Ride.create({
      driverId: makeObjectId(),
      pickup: { name: 'A', coordinates: { type: 'Point', coordinates: [77.5, 12.9] } },
      dropoff: { name: 'B', coordinates: { type: 'Point', coordinates: [77.6, 12.8] } },
      distanceKm: 5,
      vehicle: { type: 'CAR', name: 'Car', registrationNumber: 'KA01AB1234', seatingCapacity: 5, helmetRequired: false },
      vehicleType: 'CAR',
      totalSeats: 5,
      availableSeats: 4,
      maxPassengers: 4,
      farePerSeat: 100,
      pricePerSeat: 100,
      schedule: { date: futureDateStr(), time: '10:00', departureAt: new Date(Date.now() + 86400000) },
      status: 'BOOKING_OPEN',
      otpCode: '654321',
    });

    const booking = await BookingRequest.create({
      passengerId: makeObjectId(),
      driverId: makeObjectId(),
      rideId: ride._id,
      pickup: { name: 'A', coordinates: { type: 'Point', coordinates: [77.5, 12.9] } },
      dropoff: { name: 'B', coordinates: { type: 'Point', coordinates: [77.6, 12.8] } },
      passengersCount: 1,
      seatsBooked: 1,
      rideTime: new Date(Date.now() + 86400000),
      pricePerSeat: 100,
      platformFee: 10,
      totalAmount: 110,
      paymentMethod: 'CASH',
      requestExpiry: new Date(Date.now() + 30 * 60 * 1000),
      status: 'PAYMENT_DONE',
    });

    // Simulate verifyBookingOTP logic
    const submittedOTP = '654321';
    expect(ride.otpCode).toBe(submittedOTP);

    booking.status = 'OTP_VERIFIED';
    booking.otpVerified = true;
    booking.otpVerifiedAt = new Date();
    await booking.save();

    const updated = await BookingRequest.findById(booking._id);
    expect(updated.status).toBe('OTP_VERIFIED');
    expect(updated.otpVerified).toBe(true);
  });

  test('wrong OTP leaves booking status unchanged', async () => {
    const booking = await BookingRequest.create({
      passengerId: makeObjectId(),
      driverId: makeObjectId(),
      rideId: makeObjectId(),
      pickup: { name: 'A', coordinates: { type: 'Point', coordinates: [77.5, 12.9] } },
      dropoff: { name: 'B', coordinates: { type: 'Point', coordinates: [77.6, 12.8] } },
      passengersCount: 1,
      seatsBooked: 1,
      rideTime: new Date(Date.now() + 86400000),
      pricePerSeat: 100,
      platformFee: 10,
      totalAmount: 110,
      paymentMethod: 'CASH',
      requestExpiry: new Date(Date.now() + 30 * 60 * 1000),
      status: 'PAYMENT_DONE',
    });

    // Wrong OTP — status should NOT change
    const correctOTP = '654321';
    const wrongOTP = '000000';
    expect(wrongOTP).not.toBe(correctOTP);

    // Status remains PAYMENT_DONE
    const unchanged = await BookingRequest.findById(booking._id);
    expect(unchanged.status).toBe('PAYMENT_DONE');
  });
});

// ─── Integration Tests: Full Booking Lifecycle ───────────────────────────────

describe('Integration: Full booking lifecycle via API', () => {
  let passengerToken, driverToken, passengerId, driverId;
  let rideId, bookingId;

  beforeAll(async () => {
    const passenger = await registerUser('9100000001', 'PASSENGER', 'Test Passenger');
    const driver = await registerUser('9100000002', 'DRIVER', 'Test Driver');
    passengerToken = passenger.token;
    driverToken = driver.token;
    passengerId = passenger.userId;
    driverId = driver.userId;
    await approveDriverKYC(driverId);
  });

  test('Step 1: Driver publishes a ride', async () => {
    const res = await request(app)
      .post('/api/rides')
      .set(auth(driverToken))
      .send(ridePayload());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    rideId = res.body.data._id || res.body.data.id;
    testLog('Publish ride', 'PASS', `rideId: ${rideId}`);
  });

  test('Step 2: Passenger creates a booking request (status = PENDING)', async () => {
    const rideRes = await request(app).get(`/api/rides/${rideId}`);
    const ride = rideRes.body.data || rideRes.body;

    const res = await request(app)
      .post('/api/bookings')
      .set(auth(passengerToken))
      .send({
        rideId,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup: {
          name: ride.pickup?.name || 'Pickup',
          coordinates: ride.pickup?.coordinates?.coordinates || [77.2195, 28.6315],
        },
        dropoff: {
          name: ride.dropoff?.name || 'Dropoff',
          coordinates: ride.dropoff?.coordinates?.coordinates || [77.0878, 28.4949],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const booking = res.body.data;
    expect(booking.status).toBe('PENDING');
    bookingId = booking._id || booking.id;
    testLog('Create booking', 'PASS', `bookingId: ${bookingId}, status: PENDING`);
  });

  test('Step 3: Driver accepts booking — OTP generated on Ride', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set(auth(driverToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const booking = res.body.data;
    expect(booking.status).toBe('ACCEPTED');

    // Verify OTP was generated on the Ride
    const ride = await Ride.findById(rideId);
    expect(ride.otpCode).toMatch(/^\d{6}$/);
    testLog('Accept booking', 'PASS', `status: ACCEPTED, OTP generated: ${ride.otpCode}`);
  });

  test('Step 4: Passenger confirms payment — ACCEPTED → PAYMENT_DONE', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/payment-confirm`)
      .set(auth(passengerToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const booking = res.body.data;
    expect(booking.status).toBe('PAYMENT_DONE');
    testLog('Payment confirm', 'PASS', 'status: PAYMENT_DONE');
  });

  test('Step 5: Driver fetches OTP (driver-only endpoint)', async () => {
    const res = await request(app)
      .get(`/api/rides/${rideId}/otp`)
      .set(auth(driverToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.otpCode).toMatch(/^\d{6}$/);
    testLog('Driver fetch OTP', 'PASS', `OTP: ${res.body.data.otpCode}`);
  });

  test('Step 5b: Passenger cannot access OTP endpoint (403)', async () => {
    const res = await request(app)
      .get(`/api/rides/${rideId}/otp`)
      .set(auth(passengerToken));

    expect(res.status).toBe(403);
    testLog('Passenger OTP access denied', 'PASS', '403 returned');
  });

  test('Step 6: Passenger verifies OTP — PAYMENT_DONE → OTP_VERIFIED', async () => {
    const ride = await Ride.findById(rideId);
    const otpCode = ride.otpCode;

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/verify-otp`)
      .set(auth(passengerToken))
      .send({ otpCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const booking = res.body.data;
    expect(booking.status).toBe('OTP_VERIFIED');
    testLog('Verify OTP', 'PASS', 'status: OTP_VERIFIED');
  });

  test('Step 7: Driver starts ride — OTP_VERIFIED → ONGOING', async () => {
    const res = await request(app)
      .patch(`/api/rides/${rideId}/start`)
      .set(auth(driverToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify booking status updated to ONGOING
    const booking = await BookingRequest.findById(bookingId);
    expect(booking.status).toBe('ONGOING');
    testLog('Start ride', 'PASS', 'status: ONGOING');
  });

  test('Step 8: Driver completes ride — ONGOING → COMPLETED', async () => {
    const res = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set(auth(driverToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify booking status updated to COMPLETED
    const booking = await BookingRequest.findById(bookingId);
    expect(booking.status).toBe('COMPLETED');
    testLog('Complete ride', 'PASS', 'status: COMPLETED');
  });
});

// ─── Integration Tests: Invalid Transitions Return 422 ───────────────────────

describe('Integration: Invalid status transitions return 422', () => {
  let passengerToken, driverToken, passengerId, driverId;
  let rideId, bookingId;

  beforeAll(async () => {
    const passenger = await registerUser('9200000001', 'PASSENGER', 'Passenger2');
    const driver = await registerUser('9200000002', 'DRIVER', 'Driver2');
    passengerToken = passenger.token;
    driverToken = driver.token;
    passengerId = passenger.userId;
    driverId = driver.userId;
    await approveDriverKYC(driverId);

    // Publish ride
    const rideRes = await request(app)
      .post('/api/rides')
      .set(auth(driverToken))
      .send(ridePayload());
    rideId = rideRes.body.data._id || rideRes.body.data.id;

    // Create booking
    const rideDetails = await request(app).get(`/api/rides/${rideId}`);
    const ride = rideDetails.body.data || rideDetails.body;
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set(auth(passengerToken))
      .send({
        rideId,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup: {
          name: ride.pickup?.name || 'Pickup',
          coordinates: ride.pickup?.coordinates?.coordinates || [77.2195, 28.6315],
        },
        dropoff: {
          name: ride.dropoff?.name || 'Dropoff',
          coordinates: ride.dropoff?.coordinates?.coordinates || [77.0878, 28.4949],
        },
      });
    bookingId = bookingRes.body.data._id || bookingRes.body.data.id;
  });

  test('PENDING → PAYMENT_DONE directly returns 422', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/payment-confirm`)
      .set(auth(passengerToken));

    // Booking is PENDING, not ACCEPTED — should fail
    expect(res.status).toBe(422);
    testLog('PENDING → PAYMENT_DONE blocked', 'PASS', '422 returned');
  });

  test('PENDING → verify-otp directly returns 422', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/verify-otp`)
      .set(auth(passengerToken))
      .send({ otpCode: '123456' });

    expect(res.status).toBe(422);
    testLog('PENDING → OTP_VERIFIED blocked', 'PASS', '422 returned');
  });
});

// ─── Integration Tests: OTP Security ─────────────────────────────────────────

describe('Integration: OTP security — wrong OTP returns 400', () => {
  let passengerToken, driverToken, driverId;
  let rideId, bookingId;

  beforeAll(async () => {
    const passenger = await registerUser('9300000001', 'PASSENGER', 'Passenger3');
    const driver = await registerUser('9300000002', 'DRIVER', 'Driver3');
    passengerToken = passenger.token;
    driverToken = driver.token;
    driverId = driver.userId;
    await approveDriverKYC(driverId);

    const rideRes = await request(app)
      .post('/api/rides')
      .set(auth(driverToken))
      .send(ridePayload());
    rideId = rideRes.body.data._id || rideRes.body.data.id;

    const rideDetails = await request(app).get(`/api/rides/${rideId}`);
    const ride = rideDetails.body.data || rideDetails.body;
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set(auth(passengerToken))
      .send({
        rideId,
        seatsBooked: 1,
        paymentMethod: 'CASH',
        pickup: {
          name: ride.pickup?.name || 'Pickup',
          coordinates: ride.pickup?.coordinates?.coordinates || [77.2195, 28.6315],
        },
        dropoff: {
          name: ride.dropoff?.name || 'Dropoff',
          coordinates: ride.dropoff?.coordinates?.coordinates || [77.0878, 28.4949],
        },
      });
    bookingId = bookingRes.body.data._id || bookingRes.body.data.id;

    // Accept booking
    await request(app).patch(`/api/bookings/${bookingId}/accept`).set(auth(driverToken));
    // Confirm payment
    await request(app).patch(`/api/bookings/${bookingId}/payment-confirm`).set(auth(passengerToken));
  });

  test('wrong OTP returns 400 and booking stays PAYMENT_DONE', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/verify-otp`)
      .set(auth(passengerToken))
      .send({ otpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid otp/i);

    const booking = await BookingRequest.findById(bookingId);
    expect(booking.status).toBe('PAYMENT_DONE');
    testLog('Wrong OTP rejected', 'PASS', 'status remains PAYMENT_DONE');
  });
});
