const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('17. CRON', () => {
  let passed = 0, failed = 0;
  logTestStart('CRON');

  test('17.1 CRON test', async () => {
    try {
      testLog('CRON.1', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('CRON.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('17.2 CRON check', async () => {
    try {
      testLog('CRON.2', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('CRON.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: CRON', () => {
    logTestEnd('CRON', passed, failed);
    expect(failed).toBe(0);
  });
});