const { registerUser, approveDriverKYC, testLog, logTestStart, logTestEnd } = require('./helpers');

describe('7. DRIVER ACTION TEST', () => {
  let userId;
  let passed = 0, failed = 0;

  logTestStart('DRIVER ACTION TEST');

  test('7.1 Register and approve driver', async () => {
    try {
      const user = await registerUser('9111111701', 'DRIVER', 'Driver');
      userId = user.userId;
      await approveDriverKYC(userId);
      testLog('Driver Setup', 'PASS', 'Approved');
      passed++;
    } catch (err) {
      testLog('Driver Setup', 'FAIL', err.message);
      failed++;
    }
  });

  test('7.2 Driver ready for actions', async () => {
    try {
      if (userId) {
        testLog('Driver Ready', 'PASS', 'Can publish');
        passed++;
      } else {
        testLog('Driver Ready', 'FAIL', 'No user');
        failed++;
      }
    } catch (err) {
      testLog('Driver Ready', 'FAIL', err.message);
      failed++;
    }
  });

  test('Summary: Driver Actions', () => {
    logTestEnd('DRIVER ACTION TEST', passed, failed);
    expect(failed).toBe(0);
  });
});
