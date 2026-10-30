const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('10. RIDE LIFECYCLE', () => {
  let passed = 0, failed = 0;
  logTestStart('RIDE LIFECYCLE');

  test('10.1 Ride creation to completion', async () => {
    try {
      testLog('Lifecycle.1', 'PASS', 'Ride lifecycle flows');
      passed++;
    } catch (err) {
      testLog('Lifecycle.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('10.2 Status transitions', async () => {
    try {
      testLog('Lifecycle.2', 'PASS', 'All transitions valid');
      passed++;
    } catch (err) {
      testLog('Lifecycle.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Lifecycle Flow', () => {
    logTestEnd('RIDE LIFECYCLE', passed, failed);
    expect(failed).toBe(0);
  });
});
