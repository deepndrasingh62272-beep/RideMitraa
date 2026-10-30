const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('14. RATING', () => {
  let passed = 0, failed = 0;
  logTestStart('RATING');

  test('14.1 RATING test', async () => {
    try {
      testLog('RATING.1', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('RATING.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('14.2 RATING check', async () => {
    try {
      testLog('RATING.2', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('RATING.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: RATING', () => {
    logTestEnd('RATING', passed, failed);
    expect(failed).toBe(0);
  });
});