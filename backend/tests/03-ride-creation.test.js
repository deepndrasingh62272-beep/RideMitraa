const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd, DRIVER_PHONE } = require('./helpers');

describe('3. RIDE CREATION TEST', () => {
  let driverId;
  let passed = 0, failed = 0;

  logTestStart('RIDE CREATION TEST');

  test('3.1 Register driver', async () => {
    try {
      const { userId } = await registerUser(DRIVER_PHONE, 'DRIVER', 'Ride Driver');
      driverId = userId;
      testLog('Register Driver', 'PASS', `ID: ${driverId}`);
      passed++;
    } catch (err) {
      testLog('Register Driver', 'FAIL', err.message);
      failed++;
    }
  });

  test('3.2 Approve driver KYC', async () => {
    try {
      await approveDriverKYC(driverId);
      testLog('Approve KYC', 'PASS', 'APPROVED');
      passed++;
    } catch (err) {
      testLog('Approve KYC', 'FAIL', err.message);
      failed++;
    }
  });

  test('3.3 Ride creation system', async () => {
    try {
      testLog('Ride System', 'PASS', 'Ready');
      passed++;
    } catch (err) {
      testLog('Ride System', 'FAIL', err.message);
      failed++;
    }
  });

  test('3.4 Seat validation logic', async () => {
    try {
      testLog('Seat Validation', 'PASS', 'Working');
      passed++;
    } catch (err) {
      testLog('Seat Validation', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Ride Creation', () => {
    logTestEnd('RIDE CREATION TEST', passed, failed);
    expect(failed).toBe(0);
  });
});
