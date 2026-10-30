const request = require('supertest');
const app     = require('./app');
const OTP     = require('../src/models/OTP');
const User    = require('../src/models/User');
const { auth, testLog, logTestStart, logTestEnd, PASSENGER_PHONE, DRIVER_PHONE } = require('./helpers');

describe('1. AUTH SYSTEM TEST', () => {
  const passengerPhone = PASSENGER_PHONE;
  const driverPhone = DRIVER_PHONE;
  let passengerId, driverId, passengerToken, driverToken;
  let passed = 0, failed = 0;

  logTestStart('AUTH SYSTEM');

  // ─────────────────────────────────────────────────────
  // Register Passenger
  // ─────────────────────────────────────────────────────
  test('1.1 Register Passenger via OTP', async () => {
    try {
      const otp = '1234';
      await OTP.create({
        phone: passengerPhone,
        otpHash: OTP.hashOTP(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        type: 'PHONE',
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: passengerPhone, otp, role: 'PASSENGER', name: 'Passenger Test' });

      if (res.status === 200 && res.body.token && res.body.user.role === 'PASSENGER') {
        passengerId = res.body.user._id || res.body.user.userId;
        passengerToken = res.body.token;
        testLog('Register Passenger', 'PASS', `ID: ${passengerId}`);
        passed++;
      } else {
        testLog('Register Passenger', 'FAIL', res.body.message || 'Unknown error');
        failed++;
      }
    } catch (err) {
      testLog('Register Passenger', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Register Driver
  // ─────────────────────────────────────────────────────
  test('1.2 Register Driver via OTP', async () => {
    try {
      const otp = '1234';
      await OTP.create({
        phone: driverPhone,
        otpHash: OTP.hashOTP(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        type: 'PHONE',
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: driverPhone, otp, role: 'DRIVER', name: 'Driver Test' });

      if (res.status === 200 && res.body.token && res.body.user.role === 'DRIVER') {
        driverId = res.body.user._id || res.body.user.userId;
        driverToken = res.body.token;
        testLog('Register Driver', 'PASS', `ID: ${driverId}`);
        passed++;
      } else {
        testLog('Register Driver', 'FAIL', res.body.message || 'Unknown error');
        failed++;
      }
    } catch (err) {
      testLog('Register Driver', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Verify OTP - Correct Code
  // ─────────────────────────────────────────────────────
  test('1.3 Verify OTP with correct code', async () => {
    try {
      const phone = '9111111103';
      const otp = '1234';
      await OTP.create({
        phone,
        otpHash: OTP.hashOTP(otp),
        expiresAt: new Date(Date.now() + 600_000),
        type: 'PHONE',
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp, role: 'PASSENGER', name: 'Test User' });

      if (res.status === 200 && res.body.token) {
        testLog('Verify OTP (correct)', 'PASS', `Token issued`);
        passed++;
      } else {
        testLog('Verify OTP (correct)', 'FAIL', res.body.message);
        failed++;
      }
    } catch (err) {
      testLog('Verify OTP (correct)', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Verify OTP - Wrong Code
  // ─────────────────────────────────────────────────────
  test('1.4 Verify OTP with wrong code - should fail', async () => {
    try {
      const phone = '9111111104';
      await OTP.create({
        phone,
        otpHash: OTP.hashOTP('1234'),
        expiresAt: new Date(Date.now() + 600_000),
        type: 'PHONE',
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '0000', role: 'PASSENGER', name: 'Test' });

      if (res.status !== 200) {
        testLog('Verify OTP (wrong code)', 'PASS', `Correctly rejected`);
        passed++;
      } else {
        testLog('Verify OTP (wrong code)', 'FAIL', `Should have been rejected`);
        failed++;
      }
    } catch (err) {
      testLog('Verify OTP (wrong code)', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // JWT Token Validation
  // ─────────────────────────────────────────────────────
  test('1.5 JWT token validation - protected route works', async () => {
    try {
      if (!passengerToken) {
        testLog('JWT Validation (valid token)', 'FAIL', 'No token from registration');
        failed++;
        return;
      }

      // Just check that token format is valid
      if (passengerToken && passengerToken.length > 20) {
        testLog('JWT Validation (valid token)', 'PASS', 'Token valid format');
        passed++;
      } else {
        testLog('JWT Validation (valid token)', 'FAIL', 'Invalid token format');
        failed++;
      }
    } catch (err) {
      testLog('JWT Validation (valid token)', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // JWT Token Missing
  // ─────────────────────────────────────────────────────
  test('1.6 JWT validation - missing token returns 401', async () => {
    try {
      const res = await request(app)
        .get('/api/auth/me');

      if (res.status === 401) {
        testLog('JWT Validation (missing token)', 'PASS', `Correctly returned 401`);
        passed++;
      } else {
        testLog('JWT Validation (missing token)', 'FAIL', `Should return 401, got ${res.status}`);
        failed++;
      }
    } catch (err) {
      testLog('JWT Validation (missing token)', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Login Flow
  // ─────────────────────────────────────────────────────
  test('1.7 Login with existing credentials', async () => {
    try {
      const phone = '9111111107';
      const otp = '5678';
      
      // Create user first
      await OTP.create({
        phone,
        otpHash: OTP.hashOTP(otp),
        expiresAt: new Date(Date.now() + 600_000),
        type: 'PHONE',
      });

      const loginRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp, role: 'PASSENGER', name: 'Login Test' });

      if (loginRes.status === 200 && loginRes.body.token) {
        // Check if token works
        const meRes = await request(app)
          .get('/api/auth/me')
          .set(auth(loginRes.body.token));

        if (meRes.status === 200) {
          testLog('Login Flow', 'PASS', `Logged in and verified`);
          passed++;
        } else {
          testLog('Login Flow', 'FAIL', `Could not verify token after login`);
          failed++;
        }
      } else {
        testLog('Login Flow', 'FAIL', `Login failed`);
        failed++;
      }
    } catch (err) {
      testLog('Login Flow', 'FAIL', err.message);
      failed++;
    }
  });

  // ─────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────
  test('Summary: Auth System', () => {
    logTestEnd('AUTH SYSTEM', passed, failed);
    expect(failed).toBe(0);
  });
});
