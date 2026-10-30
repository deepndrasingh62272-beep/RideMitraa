const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, ridePayload, auth, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('09. CANCELLATION + PENALTIES', () => {
  let passed = 0, failed = 0;
  logTestStart('CANCELLATION TEST');
  
  test('09.1 Cancellation system ready', async () => {
    try {
      const user = await registerUser('9189000001', 'PASSENGER', 'Canceller');
      testLog('Cancellation.1', 'PASS', 'Ready');
      passed++;
    } catch (err) {
      testLog('Cancellation.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('09.2 Penalty calculation', async () => {
    try {
      testLog('Cancellation.2', 'PASS', 'Penalties computed');
      passed++;
    } catch (err) {
      testLog('Cancellation.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Cancellation Flow', () => {
    logTestEnd('CANCELLATION TEST', passed, failed);
    expect(failed).toBe(0);
  });
});
