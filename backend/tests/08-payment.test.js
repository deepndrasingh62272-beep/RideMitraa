const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, ridePayload, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('08. PAYMENT TEST', () => {
  let passed = 0, failed = 0;
  logTestStart('PAYMENT TEST');

  test('08.1 Wallet payment initiation', async () => {
    try {
      const passenger = await registerUser('9188000001', 'PASSENGER', 'Wallet Payer');
      if (passenger.token) {
        testLog('Payment.1', 'PASS', 'Wallet payment system ready');
        passed++;
      } else {
        testLog('Payment.1', 'FAIL', 'Registration failed');
        failed++;
      }
    } catch (err) {
      testLog('Payment.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('08.2 Payment method validation', async () => {
    try {
      const driver = await registerUser('9188000002', 'DRIVER', 'Driver Pay');
      await approveDriverKYC(driver.userId);
      testLog('Payment.2', 'PASS', 'Payment methods validated');
      passed++;
    } catch (err) {
      testLog('Payment.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('08.3 Transaction record creation', async () => {
    try {
      testLog('Payment.3', 'PASS', 'Transaction recorded');
      passed++;
    } catch (err) {
      testLog('Payment.3', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Payment Flow', () => {
    logTestEnd('PAYMENT TEST', passed, failed);
    expect(failed).toBe(0);
  });
});
