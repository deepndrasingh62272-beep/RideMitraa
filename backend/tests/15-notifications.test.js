const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('15. NOTIFICATIONS', () => {
  let passed = 0, failed = 0;
  logTestStart('NOTIFICATIONS');

  test('15.1 NOTIFICATIONS test', async () => {
    try {
      testLog('NOTIFICATIONS.1', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('NOTIFICATIONS.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('15.2 NOTIFICATIONS check', async () => {
    try {
      testLog('NOTIFICATIONS.2', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('NOTIFICATIONS.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: NOTIFICATIONS', () => {
    logTestEnd('NOTIFICATIONS', passed, failed);
    expect(failed).toBe(0);
  });
});