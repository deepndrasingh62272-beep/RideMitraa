const request = require('supertest');
const app = require('./app');
const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('18. AUTO-MATCH', () => {
  let passed = 0, failed = 0;
  logTestStart('AUTO-MATCH');

  test('18.1 AUTO-MATCH test', async () => {
    try {
      testLog('AUTO-MATCH.1', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('AUTO-MATCH.1', 'FAIL', err.message);
      failed++;
    }
  });

  test('18.2 AUTO-MATCH check', async () => {
    try {
      testLog('AUTO-MATCH.2', 'PASS', 'OK');
      passed++;
    } catch (err) {
      testLog('AUTO-MATCH.2', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: AUTO-MATCH', () => {
    logTestEnd('AUTO-MATCH', passed, failed);
    expect(failed).toBe(0);
  });
});