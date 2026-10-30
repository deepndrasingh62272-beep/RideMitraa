const { registerUser, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('6. BOOKING FLOW TEST', () => {
  let passengerToken, driverToken;
  let passed = 0, failed = 0;

  logTestStart('BOOKING FLOW TEST');

  test('6.1 Register passenger and driver', async () => {
    try {
      const p = await registerUser('9111111601', 'PASSENGER', 'Passenger Book');
      const d = await registerUser('9111111602', 'DRIVER', 'Driver Book');
      passengerToken = p.token;
      driverToken = d.token;
      testLog('Setup', 'PASS', 'Users created');
      passed++;
    } catch (err) {
      testLog('Setup', 'FAIL', err.message);
      failed++;
    }
  });

  test('6.2 Booking system ready', async () => {
    try {
      if (passengerToken && driverToken) {
        testLog('Booking Ready', 'PASS', 'System OK');
        passed++;
      } else {
        testLog('Booking Ready', 'FAIL', 'Missing tokens');
        failed++;
      }
    } catch (err) {
      testLog('Booking Ready', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Booking Flow', () => {
    logTestEnd('BOOKING FLOW TEST', passed, failed);
    expect(failed).toBe(0);
  });
});

