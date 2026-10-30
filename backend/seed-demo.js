/**
 * Demo Seed Script
 * Creates demo users, rides, bookings, wallets for testing
 * Run: node seed-demo.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ridesharing';

const DEMO_OTP = '1234';
const OTP_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

async function seedOtp(OTP, phone) {
  const otpHash = await bcrypt.hash(DEMO_OTP, 10);
  await OTP.deleteMany({ phone });
  await OTP.create({ phone, otpHash, expiresAt: OTP_EXPIRY, type: 'PHONE' });
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User     = require('./src/models/User');
  const OTP      = require('./src/models/OTP');
  const Ride     = require('./src/models/Ride');
  const Wallet   = require('./src/models/Wallet');
  const BookingRequest = require('./src/models/BookingRequest');
  const { generateReferralCode } = require('./src/utils/referral');

  // ── 1. Users ──────────────────────────────────────────────────────────────

  const usersData = [
    { phone: '9999999999', role: 'PASSENGER', name: 'Rahul Sharma',   kycStatus: 'APPROVED', faceVerified: true  },
    { phone: '8888888888', role: 'PASSENGER', name: 'Priya Singh',    kycStatus: 'APPROVED', faceVerified: true  },
    { phone: '7777777777', role: 'PASSENGER', name: 'Amit Kumar',     kycStatus: 'PENDING',  faceVerified: false },
    { phone: '9876543210', role: 'DRIVER',    name: 'Ravi Driver',    kycStatus: 'APPROVED', faceVerified: true  },
    { phone: '9123456789', role: 'DRIVER',    name: 'Suresh Driver',  kycStatus: 'APPROVED', faceVerified: true  },
    { phone: '8787214203', role: 'DRIVER',    name: 'Abhii Driver',   kycStatus: 'APPROVED', faceVerified: true  },
    { phone: '7307478416', role: 'PASSENGER', name: 'Abhii Passenger', kycStatus: 'APPROVED', faceVerified: true  },
  ];

  const users = {};
  for (const u of usersData) {
    let user = await User.findOneAndUpdate(
      { phone: u.phone },
      {
        $set: {
          name: u.name,
          role: u.role,
          kycStatus: u.kycStatus,
          faceVerified: u.faceVerified,
          isPhoneVerified: true,
          rating: 4.7,
          totalRatings: 20,
          trustScore: 85,
        },
        $setOnInsert: { referralCode: generateReferralCode() },
      },
      { upsert: true, new: true }
    );
    console.log(`✅ Upserted: ${u.name} (${u.phone}) — ${u.role}`);
    users[u.phone] = user;
    await seedOtp(OTP, u.phone);
  }

  // ── 2. Wallets ────────────────────────────────────────────────────────────

  for (const user of Object.values(users)) {
    const exists = await Wallet.findOne({ userId: user._id });
    if (!exists) {
      await Wallet.create({
        userId: user._id,
        balance: user.role === 'DRIVER' ? 1500 : 250,
        totalEarned: user.role === 'DRIVER' ? 8500 : 0,
      });
      console.log(`💰 Wallet created for ${user.name}`);
    }
  }

  // ── 3. Rides ──────────────────────────────────────────────────────────────

  const driver1 = users['9876543210'];
  const driver2 = users['9123456789'];

  // Clear old demo rides
  await Ride.deleteMany({ driverId: { $in: [driver1._id, driver2._id] } });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  const ridesData = [
    {
      driverId: driver1._id,
      pickup:  { name: 'Connaught Place', address: 'CP, New Delhi', coordinates: { type: 'Point', coordinates: [77.2195, 28.6315] } },
      dropoff: { name: 'Gurgaon Sector 29', address: 'Sector 29, Gurgaon', coordinates: { type: 'Point', coordinates: [77.0469, 28.4595] } },
      pickupText: 'connaught place',
      dropoffText: 'gurgaon sector 29',
      vehicle: { type: 'SEDAN', name: 'Honda City', registrationNumber: 'DL01AB1234', seatingCapacity: 5 },
      totalSeats: 5, availableSeats: 3, maxPassengers: 4,
      farePerSeat: 180, pricePerSeat: 180, distanceKm: 32, surgeMultiplier: 1.0,
      schedule: { date: dateStr, time: '08:00', departureAt: new Date(`${dateStr}T08:00:00+05:30`) },
      status: 'BOOKING_OPEN',
    },
    {
      driverId: driver1._id,
      pickup:  { name: 'Lajpat Nagar', address: 'Lajpat Nagar, Delhi', coordinates: { type: 'Point', coordinates: [77.2431, 28.5677] } },
      dropoff: { name: 'Noida Sector 62', address: 'Sector 62, Noida', coordinates: { type: 'Point', coordinates: [77.3710, 28.6270] } },
      pickupText: 'lajpat nagar',
      dropoffText: 'noida sector 62',
      vehicle: { type: 'SEDAN', name: 'Honda City', registrationNumber: 'DL01AB1234', seatingCapacity: 5 },
      totalSeats: 5, availableSeats: 4, maxPassengers: 4,
      farePerSeat: 120, pricePerSeat: 120, distanceKm: 18, surgeMultiplier: 1.0,
      schedule: { date: dateStr, time: '09:30', departureAt: new Date(`${dateStr}T09:30:00+05:30`) },
      status: 'BOOKING_OPEN',
    },
    {
      driverId: driver2._id,
      pickup:  { name: 'Dwarka Sector 10', address: 'Dwarka, Delhi', coordinates: { type: 'Point', coordinates: [77.0469, 28.5921] } },
      dropoff: { name: 'Cyber City Gurgaon', address: 'DLF Cyber City, Gurgaon', coordinates: { type: 'Point', coordinates: [77.0878, 28.4950] } },
      pickupText: 'dwarka sector 10',
      dropoffText: 'cyber city gurgaon',
      vehicle: { type: 'SUV', name: 'Toyota Innova', registrationNumber: 'HR26CD5678', seatingCapacity: 7 },
      totalSeats: 7, availableSeats: 5, maxPassengers: 6,
      farePerSeat: 150, pricePerSeat: 150, distanceKm: 22, surgeMultiplier: 1.0,
      schedule: { date: dateStr, time: '07:30', departureAt: new Date(`${dateStr}T07:30:00+05:30`) },
      status: 'BOOKING_OPEN',
    },
    {
      driverId: driver2._id,
      pickup:  { name: 'Rohini Sector 3', address: 'Rohini, Delhi', coordinates: { type: 'Point', coordinates: [77.1025, 28.7041] } },
      dropoff: { name: 'Karol Bagh', address: 'Karol Bagh, Delhi', coordinates: { type: 'Point', coordinates: [77.1908, 28.6514] } },
      pickupText: 'rohini sector 3',
      dropoffText: 'karol bagh',
      vehicle: { type: 'HATCHBACK', name: 'Maruti Swift', registrationNumber: 'DL04EF9012', seatingCapacity: 5 },
      totalSeats: 5, availableSeats: 3, maxPassengers: 4,
      farePerSeat: 80, pricePerSeat: 80, distanceKm: 14, surgeMultiplier: 1.0,
      schedule: { date: dateStr, time: '10:00', departureAt: new Date(`${dateStr}T10:00:00+05:30`) },
      status: 'BOOKING_OPEN',
    },
  ];

  const rides = [];
  for (const r of ridesData) {
    const ride = await Ride.create(r);
    rides.push(ride);
    console.log(`🚗 Ride created: ${r.pickup.name} → ${r.dropoff.name} (₹${r.farePerSeat}/seat)`);
  }

  // ── 4. Sample Booking ─────────────────────────────────────────────────────

  const passenger1 = users['9999999999'];
  await BookingRequest.deleteMany({ passengerId: passenger1._id });

  await BookingRequest.create({
    passengerId:     passenger1._id,
    driverId:        driver1._id,
    rideId:          rides[0]._id,
    pickup:          { name: 'Connaught Place', coordinates: { type: 'Point', coordinates: [77.2195, 28.6315] } },
    dropoff:         { name: 'Gurgaon Sector 29', coordinates: { type: 'Point', coordinates: [77.0469, 28.4595] } },
    passengersCount: 1,
    rideTime:        rides[0].schedule.departureAt,
    pricePerSeat:    180,
    platformFee:     18,
    totalAmount:     198,
    paymentMethod:   'CASH',
    status:          'ACCEPTED',
    requestExpiry:   new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  console.log(`📋 Sample booking created for ${passenger1.name}`);

  // ── Done ──────────────────────────────────────────────────────────────────

  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo Accounts (OTP: 1234 for all):');
  console.log('  Passenger 1: 9999999999  (Rahul Sharma)');
  console.log('  Passenger 2: 8888888888  (Priya Singh)');
  console.log('  Passenger 3: 7777777777  (Amit Kumar)');
  console.log('  Driver 1:    9876543210  (Ravi Driver)');
  console.log('  Driver 2:    9123456789  (Suresh Driver)');
  console.log('  Driver 3:    8787214203  (Abhii Driver)');
  console.log('  Passenger 4: 7307478416  (Abhii Passenger)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`4 rides seeded for ${dateStr}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
