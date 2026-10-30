const request = require('supertest');
const app = require('./app');
const {
  registerUser,
  approveDriverKYC,
  ridePayload,
  auth,
  testLog,
  logTestStart,
  logTestEnd,
} = require('./helpers');

describe('22. DYNAMIC RIDE-LEVEL ROLE SYSTEM', () => {
  logTestStart('DYNAMIC RIDE-LEVEL ROLE SYSTEM');

  test('22.1 Same account can drive one ride and book another ride', async () => {
    let passed = 0;
    let failed = 0;

    try {
      const userA = await registerUser('9197000021', 'PASSENGER', 'Dynamic User A');
      const userB = await registerUser('9197000022', 'PASSENGER', 'Dynamic User B');

      const kycStatusBeforeRide = await request(app)
        .get('/api/driver/kyc/status')
        .set(auth(userA.token));
      expect(kycStatusBeforeRide.status).toBe(403);

      const walletBeforeRide = await request(app)
        .get('/api/driver/wallet')
        .set(auth(userA.token));
      expect(walletBeforeRide.status).toBe(403);

      testLog('Dynamic Driver Access (Before Ride)', 'PASS', 'Driver-only routes blocked without ride ownership/earnings');
      passed++;

      // Dynamic model proof: account role can remain PASSENGER while user offers rides after KYC.
      await approveDriverKYC(userA.userId);
      await approveDriverKYC(userB.userId);

      const rideARes = await request(app)
        .post('/api/rides')
        .set(auth(userA.token))
        .send(
          ridePayload({
            vehicle: {
              type: 'SEDAN',
              name: 'Dynamic Sedan A',
              registrationNumber: 'DL01AB4321',
              seatingCapacity: 5,
            },
          })
        );

      expect(rideARes.status).toBe(201);
      const rideAId = String(rideARes.body.ride._id);
      expect(String(rideARes.body.ride.driverId)).toBe(String(userA.userId));
      testLog('Offer Ride A', 'PASS', 'PASSENGER account successfully became ride-level driver');
      passed++;

      const rideBRes = await request(app)
        .post('/api/rides')
        .set(auth(userB.token))
        .send(
          ridePayload({
            vehicle: {
              type: 'SEDAN',
              name: 'Dynamic Sedan B',
              registrationNumber: 'DL01AB9876',
              seatingCapacity: 5,
            },
          })
        );

      expect(rideBRes.status).toBe(201);
      const rideBId = String(rideBRes.body.ride._id);
      testLog('Offer Ride B', 'PASS', 'Second user created another ride');
      passed++;

      const kycStatusAfterRide = await request(app)
        .get('/api/driver/kyc/status')
        .set(auth(userA.token));
      expect(kycStatusAfterRide.status).toBe(200);

      const walletAfterRide = await request(app)
        .get('/api/driver/wallet')
        .set(auth(userA.token));
      expect(walletAfterRide.status).toBe(200);

      const withdrawAfterRide = await request(app)
        .post('/api/driver/withdraw')
        .set(auth(userA.token))
        .send({
          amount: 100,
          accountDetails: {
            method: 'UPI',
            upiId: 'dynamic.user@upi',
          },
        });
      expect(withdrawAfterRide.status).not.toBe(403);

      testLog('Dynamic Driver Access (After Ride)', 'PASS', 'Driver routes unlocked by ride ownership');
      passed++;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set(auth(userA.token))
        .send({
          rideId: rideBId,
          seatsBooked: 1,
          paymentMethod: 'CASH',
          pickup: {
            name: 'Pickup A',
            coordinates: [77.2195, 28.6315],
          },
          dropoff: {
            name: 'Drop A',
            coordinates: [77.0878, 28.4949],
          },
        });

      expect(bookingRes.status).toBe(201);
      expect(String(bookingRes.body.booking.passengerId)).toBe(String(userA.userId));
      testLog('Book Ride', 'PASS', 'Same user became ride-level passenger on another ride');
      passed++;

      const ownBookingAttempt = await request(app)
        .post('/api/bookings')
        .set(auth(userA.token))
        .send({
          rideId: rideAId,
          seatsBooked: 1,
          paymentMethod: 'CASH',
          pickup: {
            name: 'Own Pickup',
            coordinates: [77.2195, 28.6315],
          },
          dropoff: {
            name: 'Own Drop',
            coordinates: [77.0878, 28.4949],
          },
        });

      expect(ownBookingAttempt.status).toBe(403);
      testLog('Prevent Own Booking', 'PASS', 'User cannot book their own ride');
      passed++;

      const bookingId = String(bookingRes.body.booking._id);

      const acceptByPassenger = await request(app)
        .post(`/api/bookings/${bookingId}/accept`)
        .set(auth(userA.token))
        .send({});
      expect(acceptByPassenger.status).toBe(403);

      const acceptByRideOwner = await request(app)
        .post(`/api/bookings/${bookingId}/accept`)
        .set(auth(userB.token))
        .send({});
      expect(acceptByRideOwner.status).toBe(200);

      testLog('Accept Ownership', 'PASS', 'Only ride owner can accept booking');
      passed++;

      logTestEnd('DYNAMIC RIDE-LEVEL ROLE SYSTEM', passed, failed);
      expect(failed).toBe(0);
    } catch (err) {
      failed++;
      testLog('Dynamic Role Flow', 'FAIL', err.message);
      logTestEnd('DYNAMIC RIDE-LEVEL ROLE SYSTEM', passed, failed);
      throw err;
    }
  }, 60000);
});
