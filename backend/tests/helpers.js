const request = require('supertest');
const app     = require('./app');
const OTP     = require('../src/models/OTP');
const User    = require('../src/models/User');
const Ride    = require('../src/models/Ride');
const BookingRequest = require('../src/models/BookingRequest');
const Wallet  = require('../src/models/Wallet');

const PASSENGER_PHONE = '9000000001';
const DRIVER_PHONE    = '9000000002';
const ADMIN_PHONE     = '9000000003';

const testLog = (step, status, details = '') => {
  const emoji = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '→';
  console.log(`  ${emoji} ${step} ${status} ${details ? `| ${details}` : ''}`);
};

/**
 * Register + verify a user, bypassing real OTP by inserting the hash directly.
 * Returns { token, user, userId }
 */
const registerUser = async (phone, role, name = 'Test User') => {
  // Seed OTP directly — avoids SMS gateway
  const otp = '1234';
  await OTP.create({
    phone,
    otpHash:   OTP.hashOTP(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    type:      'PHONE',
  });

  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ phone, otp, role, name });

  if (res.status !== 200) throw new Error(`registerUser failed: ${JSON.stringify(res.body)}`);
  testLog(`Register ${role}`, 'PASS', `Phone: ${phone}`);
  
  // Fetch full user from DB
  const fullUser = await User.findOne({ phone });
  
  return { 
    token: res.body.token, 
    user: res.body.user,
    userId: fullUser._id,
  };
};

/**
 * Approve a driver's KYC directly in DB (skips Cloudinary upload).
 */
const approveDriverKYC = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    kycStatus: 'APPROVED',
    kycDocuments: {
      govtIdType: 'AADHAR',
      govtId:     'https://fake.cloudinary.com/govtid.jpg',
      selfie:     'https://fake.cloudinary.com/selfie.jpg',
    },
    faceVerified: true,
    faceVerificationMeta: {
      similarity: 0.99,
      verifiedAt: new Date(),
    },
  });
  testLog('Approve Driver KYC', 'PASS', `User ID: ${userId}`);
};

/**
 * Build a standard ride payload for publishRide.
 */
const ridePayload = (overrides = {}) => ({
  pickup: {
    name:        'Connaught Place',
    address:     'CP, New Delhi',
    coordinates: [77.2195, 28.6315],
  },
  dropoff: {
    name:        'Cyber City',
    address:     'Gurugram, Haryana',
    coordinates: [77.0878, 28.4949],
  },
  vehicle: {
    type:               'SEDAN',
    name:               'Honda City',
    registrationNumber: 'DL01AB1234',
    seatingCapacity:    5,
  },
  schedule: {
    date: futureDateStr(),
    time: '10:00',
  },
  farePerSeat: 150,
  ...overrides,
});

/**
 * Returns a YYYY-MM-DD string for tomorrow (IST).
 */
const futureDateStr = (daysAhead = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

/**
 * Auth header helper.
 */
const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Create a wallet for a user
 */
const createWallet = async (userId, balance = 1000) => {
  return await Wallet.create({
    userId,
    balance,
    transactionHistory: [],
  });
};

/**
 * Get wallet by user ID
 */
const getWallet = async (userId) => {
  return await Wallet.findOne({ userId });
};

/**
 * Detailed logging for test flows
 */
const logTestStart = (testName) => {
  console.log(`\n📋 ${testName}`);
  console.log('─'.repeat(60));
};

const logTestEnd = (testName, passed, failed) => {
  const total = passed + failed;
  const status = failed === 0 ? '✅ PASS' : '❌ FAIL';
  console.log(`─`.repeat(60));
  console.log(`${status} | ${testName}: ${passed}/${total} passed\n`);
};

module.exports = {
  registerUser,
  approveDriverKYC,
  ridePayload,
  futureDateStr,
  auth,
  testLog,
  createWallet,
  getWallet,
  logTestStart,
  logTestEnd,
  PASSENGER_PHONE,
  DRIVER_PHONE,
  ADMIN_PHONE,
};
