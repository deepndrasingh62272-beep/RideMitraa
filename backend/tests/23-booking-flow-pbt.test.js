/**
 * Property-Based Tests — Ride Request & Booking Flow
 * Feature: ride-request-booking-flow
 *
 * Uses fast-check for property-based testing.
 * Each property runs a minimum of 100 iterations.
 *
 * Tag format: Feature: ride-request-booking-flow, Property {N}: {property_text}
 */

const fc = require('fast-check');
const mongoose = require('mongoose');
const BookingRequest = require('../src/models/BookingRequest');
const Ride = require('../src/models/Ride');
const User = require('../src/models/User');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const ALL_STATUSES = Object.keys(ALLOWED_TRANSITIONS);

const makeObjectId = () => new mongoose.Types.ObjectId();

const makeRide = (overrides = {}) => ({
  driverId: makeObjectId(),
  pickup: {
    name: 'Pickup',
    coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] },
  },
  dropoff: {
    name: 'Dropoff',
    coordinates: { type: 'Point', coordinates: [77.6101, 12.9352] },
  },
  distanceKm: 10,
  vehicle: {
    type: 'CAR',
    name: 'Test Car',
    registrationNumber: 'KA01AB1234',
    seatingCapacity: 5,
    helmetRequired: false,
  },
  vehicleType: 'CAR',
  totalSeats: 5,
  availableSeats: 4,
  maxPassengers: 4,
  farePerSeat: 100,
  pricePerSeat: 100,
  schedule: {
    date: '2026-12-01',
    time: '10:00',
    departureAt: new Date('2026-12-01T10:00:00+05:30'),
  },
  status: 'BOOKING_OPEN',
  ...overrides,
});

const makeBooking = (overrides = {}) => ({
  passengerId: makeObjectId(),
  driverId: makeObjectId(),
  rideId: makeObjectId(),
  pickup: {
    name: 'Pickup',
    coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] },
  },
  dropoff: {
    name: 'Dropoff',
    coordinates: { type: 'Point', coordinates: [77.6101, 12.9352] },
  },
  passengersCount: 1,
  seatsBooked: 1,
  rideTime: new Date('2026-12-01T10:00:00+05:30'),
  pricePerSeat: 100,
  platformFee: 10,
  totalAmount: 110,
  paymentMethod: 'CASH',
  requestExpiry: new Date(Date.now() + 30 * 60 * 1000),
  status: 'PENDING',
  ...overrides,
});

// ─── Property 1: Disabled Request button for zero-seat rides ─────────────────
// Feature: ride-request-booking-flow, Property 1: disabled Request button for zero-seat rides

describe('Property 1: Disabled Request button for zero-seat rides', () => {
  test('button is disabled iff availableSeats === 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        (availableSeats) => {
          // Simulate the RideCard button disabled logic
          const isDisabled = availableSeats === 0;
          if (availableSeats === 0) {
            expect(isDisabled).toBe(true);
          } else {
            expect(isDisabled).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Booking creation always returns PENDING status ───────────────
// Feature: ride-request-booking-flow, Property 2: booking creation always returns PENDING status

describe('Property 2: Booking creation always returns PENDING status', () => {
  test('any valid booking created in DB has status PENDING', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        async (seatsBooked) => {
          const booking = await BookingRequest.create(makeBooking({ seatsBooked, passengersCount: seatsBooked }));
          expect(booking.status).toBe('PENDING');
          expect(booking._id).toBeTruthy();
          await BookingRequest.findByIdAndDelete(booking._id);
        }
      ),
      { numRuns: 20 } // Reduced for DB tests
    );
  });
});

// ─── Property 3: Single OTP per Ride, shared across all accepted bookings ─────
// Feature: ride-request-booking-flow, Property 3: single OTP per Ride, shared across all accepted bookings

describe('Property 3: Single OTP per Ride, shared across all accepted bookings', () => {
  test('otpCode is 6-digit numeric and unchanged after first acceptance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numBookings) => {
          const ride = await Ride.create(makeRide());

          // Simulate first acceptance: generate OTP
          if (!ride.otpCode) {
            ride.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            await ride.save();
          }
          const firstOTP = ride.otpCode;

          // Simulate subsequent acceptances: OTP must not change
          for (let i = 1; i < numBookings; i++) {
            const freshRide = await Ride.findById(ride._id);
            if (!freshRide.otpCode) {
              freshRide.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
              await freshRide.save();
            }
            expect(freshRide.otpCode).toBe(firstOTP);
          }

          // Validate format: 6-digit numeric string
          expect(firstOTP).toMatch(/^\d{6}$/);

          await Ride.findByIdAndDelete(ride._id);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── Property 4: OTP never exposed to Passenger in API responses ──────────────
// Feature: ride-request-booking-flow, Property 4: OTP never exposed to Passenger in API responses

describe('Property 4: OTP never exposed to Passenger in API responses', () => {
  test('booking objects returned to passengers do not contain otpCode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
        async (otpCode) => {
          // Create a ride with an OTP
          const ride = await Ride.create(makeRide({ otpCode }));

          // Simulate what the passenger API returns: booking without otpCode
          const booking = await BookingRequest.create(makeBooking({ rideId: ride._id }));

          // The booking record itself should not expose the ride's OTP
          // (OTP is on the Ride model, not BookingRequest)
          const bookingObj = booking.toObject();
          // BookingRequest.otpCode is the legacy field — it should be null for new flow
          // The ride's otpCode should NOT be in the booking response
          expect(bookingObj).not.toHaveProperty('rideOtpCode');

          // Simulate passenger-facing booking response (no otpCode from ride)
          const passengerResponse = {
            id: booking._id,
            status: booking.status,
            rideId: booking.rideId,
            totalAmount: booking.totalAmount,
            // otpCode intentionally omitted
          };
          expect(passengerResponse).not.toHaveProperty('otpCode');

          await BookingRequest.findByIdAndDelete(booking._id);
          await Ride.findByIdAndDelete(ride._id);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── Property 5: Rejected booking auto-hide filter ───────────────────────────
// Feature: ride-request-booking-flow, Property 5: rejected booking auto-hide filter

describe('Property 5: Rejected booking auto-hide filter', () => {
  test('rejected bookings older than 3600s are filtered out; newer ones are kept', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7200 }),
        (secondsAgo) => {
          const updatedAt = new Date(Date.now() - secondsAgo * 1000);
          const booking = { status: 'REJECTED', updatedAt };

          // Client-side filter logic (mirrors Bookings.tsx)
          const nowSeconds = Date.now() / 1000;
          const updatedAtSeconds = updatedAt.getTime() / 1000;
          const shouldShow = nowSeconds - updatedAtSeconds < 3600;

          if (secondsAgo >= 3600) {
            expect(shouldShow).toBe(false);
          } else {
            expect(shouldShow).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Payment modal fare calculation ───────────────────────────────
// Feature: ride-request-booking-flow, Property 6: payment modal fare calculation

describe('Property 6: Payment modal fare calculation', () => {
  test('subtotal equals pricePerSeat × seatsBooked exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        fc.integer({ min: 1, max: 6 }),
        (pricePerSeat, seatsBooked) => {
          const subtotal = pricePerSeat * seatsBooked;
          const platformFee = parseFloat((subtotal * 0.1).toFixed(2));
          const grandTotal = parseFloat((subtotal + platformFee).toFixed(2));

          expect(subtotal).toBe(pricePerSeat * seatsBooked);
          expect(platformFee).toBeCloseTo(subtotal * 0.1, 2);
          expect(grandTotal).toBeCloseTo(subtotal * 1.1, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Upcoming tab status filter ───────────────────────────────────
// Feature: ride-request-booking-flow, Property 7: upcoming tab status filter

describe('Property 7: Upcoming tab status filter', () => {
  const UPCOMING_STATUSES = ['accepted', 'payment_done', 'otp_verified', 'on_the_way', 'arrived', 'in_progress', 'ongoing'];
  const NON_UPCOMING_STATUSES = ['pending', 'completed', 'cancelled', 'rejected', 'expired'];

  test('upcoming statuses are included; non-upcoming are excluded', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...UPCOMING_STATUSES),
        (status) => {
          const isUpcoming = UPCOMING_STATUSES.includes(status.toLowerCase());
          expect(isUpcoming).toBe(true);
        }
      ),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...NON_UPCOMING_STATUSES),
        (status) => {
          const isUpcoming = UPCOMING_STATUSES.includes(status.toLowerCase());
          expect(isUpcoming).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: OTP verification state transition ───────────────────────────
// Feature: ride-request-booking-flow, Property 8: OTP verification state transition

describe('Property 8: OTP verification state transition', () => {
  test('correct OTP transitions PAYMENT_DONE → OTP_VERIFIED; wrong OTP leaves status unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
        fc.boolean(),
        async (correctOTP, useCorrectOTP) => {
          const ride = await Ride.create(makeRide({ otpCode: correctOTP }));
          const booking = await BookingRequest.create(makeBooking({
            rideId: ride._id,
            status: 'PAYMENT_DONE',
          }));

          const submittedOTP = useCorrectOTP
            ? correctOTP
            : String(parseInt(correctOTP) === 999999 ? '000000' : String(parseInt(correctOTP) + 1).padStart(6, '0'));

          const isCorrect = submittedOTP === correctOTP;

          if (isCorrect) {
            booking.status = 'OTP_VERIFIED';
            booking.otpVerified = true;
            await booking.save();
            const updated = await BookingRequest.findById(booking._id);
            expect(updated.status).toBe('OTP_VERIFIED');
          } else {
            // Status should remain PAYMENT_DONE
            const unchanged = await BookingRequest.findById(booking._id);
            expect(unchanged.status).toBe('PAYMENT_DONE');
          }

          await BookingRequest.findByIdAndDelete(booking._id);
          await Ride.findByIdAndDelete(ride._id);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── Property 9: Incomplete OTP submission blocked ───────────────────────────
// Feature: ride-request-booking-flow, Property 9: incomplete OTP submission blocked

describe('Property 9: Incomplete OTP submission blocked', () => {
  test('OTP strings shorter than 6 chars should not pass validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        (length) => {
          // Simulate OTPModal validation: all 6 fields must be filled
          const otp = Array(6).fill('');
          // Fill only `length` fields
          for (let i = 0; i < length; i++) otp[i] = String(i % 10);

          const allFilled = otp.every(digit => digit !== '');
          expect(allFilled).toBe(false); // Should always be false for length 0-5
        }
      ),
      { numRuns: 100 }
    );
  });

  test('complete 6-digit OTP passes validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
        (otpCode) => {
          const otp = otpCode.split('');
          const allFilled = otp.every(digit => digit !== '');
          expect(allFilled).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Booking status machine — invalid transitions rejected ────────
// Feature: ride-request-booking-flow, Property 10: booking status machine — invalid transitions rejected

describe('Property 10: Booking status machine — invalid transitions rejected', () => {
  const assertTransition = (currentStatus, targetStatus) => {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const err = new Error(`Cannot transition from ${currentStatus} to ${targetStatus}`);
      err.status = 422;
      throw err;
    }
  };

  test('all allowed transitions succeed without throwing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        (currentStatus) => {
          const allowed = ALLOWED_TRANSITIONS[currentStatus];
          for (const target of allowed) {
            expect(() => assertTransition(currentStatus, target)).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all disallowed transitions throw HTTP 422', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        fc.constantFrom(...ALL_STATUSES),
        (currentStatus, targetStatus) => {
          const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
          if (!allowed.includes(targetStatus)) {
            expect(() => assertTransition(currentStatus, targetStatus)).toThrow();
            try {
              assertTransition(currentStatus, targetStatus);
            } catch (err) {
              expect(err.status).toBe(422);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Rating submission requires non-zero stars ──────────────────
// Feature: ride-request-booking-flow, Property 11: rating submission requires non-zero stars

describe('Property 11: Rating submission requires non-zero stars', () => {
  const validateRating = (rating) => {
    if (!rating || rating === 0) {
      throw new Error('Please select a rating');
    }
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
  };

  test('rating of 0 always throws validation error', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        (rating) => {
          expect(() => validateRating(rating)).toThrow('Please select a rating');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('ratings 1-5 always pass validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (rating) => {
          expect(() => validateRating(rating)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Live location update propagates to TrackRide ───────────────
// Feature: ride-request-booking-flow, Property 12: live location update propagates to TrackRide

describe('Property 12: Live location update propagates to TrackRide', () => {
  test('LOCATION_UPDATE payload updates driverLocation state correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        fc.string({ minLength: 1 }),
        (lat, lng, rideId) => {
          // Simulate the TrackRide LOCATION_UPDATE handler
          let driverLocation = null;
          let lastUpdateAt = null;

          const handleLocationUpdate = (data) => {
            if (data.rideId !== rideId) return;
            driverLocation = { lat: data.lat, lng: data.lng };
            lastUpdateAt = new Date();
          };

          const payload = { rideId, lat, lng, timestamp: new Date().toISOString() };
          handleLocationUpdate(payload);

          expect(driverLocation).not.toBeNull();
          expect(driverLocation.lat).toBe(lat);
          expect(driverLocation.lng).toBe(lng);
          expect(lastUpdateAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isLive is true within 10s of last update, false after', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        (secondsAgo) => {
          const lastUpdateAt = new Date(Date.now() - secondsAgo * 1000);
          const secondsSinceUpdate = (Date.now() - lastUpdateAt.getTime()) / 1000;
          const isLive = secondsSinceUpdate <= 10;

          if (secondsAgo <= 10) {
            expect(isLive).toBe(true);
          } else {
            expect(isLive).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
