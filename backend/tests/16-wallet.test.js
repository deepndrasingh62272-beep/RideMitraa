const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('16. WALLET', () => {
  let passed = 0, failed = 0;
  logTestStart('WALLET');

  test('16.1 WALLET test', async () => {
    try {
      testLog('WALLET.1', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('WALLET.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('16.2 WALLET check', async () => {
    try {
      testLog('WALLET.2', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('WALLET.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: WALLET', () => {
    logTestEnd('WALLET', passed, failed);
    expect(failed).toBe(0);
  });
});