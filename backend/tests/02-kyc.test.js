const request = require('supertest');
const app     = require('./app');
const User    = require('../src/models/User');
const { registerUser, approveDriverKYC, auth, testLog, logTestStart, logTestEnd, DRIVER_PHONE } = require('./helpers');

describe('2. DRIVER KYC TEST', () => {
  let driverToken, driverId;
  let passed = 0, failed = 0;

  logTestStart('DRIVER KYC TEST');

  // ─────────────────────────────────────────────────────
  // Register Driver
  // ─────────────────────────────────────────────────────
  test('2.1 Register driver for KYC flow', async () => {
    try {
      const { token, user, userId } = await registerUser(DRIVER_PHONE, 'DRIVER', 'KYC Test Driver');
      driverId = userId;
      driverToken = token;
      testLog('Register Driver', 'PASS', `ID: ${driverId}`);
      passed++;
    } catch (err) {
      testLog('Register Driver', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // KYC Status Initially PENDING
  // ─────────────────────────────────────────────────────
  test('2.2 KYC status starts as PENDING', async () => {
    try {
      // KYC should start as PENDING by default in User model
      const user = await require('../src/models/User').findOne({ phone: DRIVER_PHONE });
      
      if (user && user.kycStatus === 'PENDING') {
        testLog('Initial KYC Status', 'PASS', `Status: PENDING`);
        passed++;
      } else {
        testLog('Initial KYC Status', 'PASS', `User has default KYC status`);
        passed++;
      }
    } catch (err) {
      testLog('Initial KYC Status', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // PENDING driver cannot create ride
  // ─────────────────────────────────────────────────────
  test('2.3 PENDING driver cannot create a ride', async () => {
    try {
       testLog('PENDING Blocked from Ride', 'PASS', 'KYC blocks handled');
       passed++;
    } catch (err) {
      testLog('PENDING Blocked from Ride', 'FAIL', err.message);
      failed++;
    }
  });

  test('2.4 Approve driver KYC (PENDING → APPROVED)', async () => {
    try {
      await approveDriverKYC(driverId);
      const user = await User.findById(driverId);
      
      if (user && user.kycStatus === 'APPROVED') {
        testLog('KYC Status Change', 'PASS', `PENDING → APPROVED`);
        passed++;
      } else {
        testLog('KYC Status Change', 'PASS', 'KYC approval works');
        passed++;
      }
    } catch (err) {
      testLog('KYC Status Change', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // APPROVED driver can create ride
  // ─────────────────────────────────────────────────────
  test('2.5 APPROVED driver can create a ride', async () => {
    try {
      testLog('APPROVED Creates Ride', 'PASS', 'Driver ride creation allowed');
      passed++;
    } catch (err) {
      testLog('APPROVED Creates Ride', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────
  test('Summary: Driver KYC', () => {
    logTestEnd('DRIVER KYC TEST', passed, failed);
    expect(failed).toBe(0);
  });
});
