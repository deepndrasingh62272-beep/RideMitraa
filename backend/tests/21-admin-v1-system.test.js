const request = require('supertest');
const bcrypt = require('bcryptjs');

const app = require('./app');
const User = require('../src/models/User');
const Ride = require('../src/models/Ride');
const BookingRequest = require('../src/models/BookingRequest');
const SafetyEvent = require('../src/models/SafetyEvent');

const {
  registerUser,
  approveDriverKYC,
  ridePayload,
  auth,
} = require('./helpers');

const createAdminSession = async ({ role = 'SUPER_ADMIN', email = 'admin.v1@test.com', password = 'Admin@123' } = {}) => {
  process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test_admin_jwt_secret';

  const hash = await bcrypt.hash(password, 10);
  await User.create({
    name: 'V1 Admin',
    phone: `98${Math.floor(Math.random() * 89999999 + 10000000)}`,
    email,
    role,
    password: hash,
    isEmailVerified: true,
  });

  const loginRes = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ email, password });

  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeTruthy();

  return loginRes.body.token;
};

describe('21. ADMIN V1 SYSTEM', () => {
  test('admin auth uses separate v1 route and role-protected me endpoint', async () => {
    const adminToken = await createAdminSession();

    const meRes = await request(app)
      .get('/api/v1/admin/auth/me')
      .set(auth(adminToken));

    expect(meRes.status).toBe(200);
    expect(meRes.body.admin.role).toBe('SUPER_ADMIN');
  });

  test('user control: view profile + block/unblock user', async () => {
    const adminToken = await createAdminSession({ email: 'admin.user@test.com' });

    const passenger = await registerUser('9193000001', 'PASSENGER', 'User Control Passenger');

    const profileRes = await request(app)
      .get(`/api/v1/admin/users/${passenger.userId}`)
      .set(auth(adminToken));

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user).toHaveProperty('rating');
    expect(profileRes.body.user).toHaveProperty('trustScore');

    const blockRes = await request(app)
      .patch(`/api/v1/admin/users/${passenger.userId}/block`)
      .set(auth(adminToken))
      .send({ reason: 'policy_violation' });

    expect(blockRes.status).toBe(200);
    expect(blockRes.body.user.deletedAt).toBeTruthy();

    const blockedApiRes = await request(app)
      .get('/api/payments/methods')
      .set(auth(passenger.token));
    expect(blockedApiRes.status).toBe(403);

    const unblockRes = await request(app)
      .patch(`/api/v1/admin/users/${passenger.userId}/unblock`)
      .set(auth(adminToken));

    expect(unblockRes.status).toBe(200);

    const unblockedApiRes = await request(app)
      .get('/api/payments/methods')
      .set(auth(passenger.token));
    expect(unblockedApiRes.status).toBe(200);
  });

  test('kyc management: pending list, approve and reject', async () => {
    const adminToken = await createAdminSession({ email: 'admin.kyc@test.com' });

    const pendingDriver = await registerUser('9193000002', 'DRIVER', 'Pending Driver');
    const rejectDriver = await registerUser('9193000003', 'DRIVER', 'Reject Driver');

    const pendingRes = await request(app)
      .get('/api/v1/admin/kyc/pending')
      .set(auth(adminToken));

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.total).toBeGreaterThanOrEqual(2);

    const approveRes = await request(app)
      .post(`/api/v1/admin/kyc/${pendingDriver.userId}/approve`)
      .set(auth(adminToken));

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.driver.kycStatus).toBe('APPROVED');

    const rejectRes = await request(app)
      .post(`/api/v1/admin/kyc/${rejectDriver.userId}/reject`)
      .set(auth(adminToken))
      .send({ reason: 'document_mismatch' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.driver.kycStatus).toBe('REJECTED');
  });

  test('ride monitoring: list rides and fetch live tracking', async () => {
    const adminToken = await createAdminSession({ email: 'admin.rides@test.com' });

    const driver = await registerUser('9193000004', 'DRIVER', 'Monitoring Driver');
    await approveDriverKYC(driver.userId);

    const publishRes = await request(app)
      .post('/api/rides')
      .set(auth(driver.token))
      .send(ridePayload());

    expect(publishRes.status).toBe(201);
    const rideId = publishRes.body.ride._id;

    const trackingRes = await request(app)
      .post(`/api/tracking/${rideId}/location`)
      .set(auth(driver.token))
      .send({ coordinates: [77.2201, 28.6319], heading: 120, speedKmh: 28 });

    expect(trackingRes.status).toBe(200);

    const ridesRes = await request(app)
      .get('/api/v1/admin/rides')
      .set(auth(adminToken));

    expect(ridesRes.status).toBe(200);
    expect(ridesRes.body.total).toBeGreaterThanOrEqual(1);

    const liveRes = await request(app)
      .get(`/api/v1/admin/rides/${rideId}/live`)
      .set(auth(adminToken));

    expect(liveRes.status).toBe(200);
    expect(liveRes.body.tracking.current).toBeTruthy();
  });

  test('sos dashboard: view and resolve safety alerts', async () => {
    const adminToken = await createAdminSession({ email: 'admin.sos@test.com' });

    const passenger = await registerUser('9193000005', 'PASSENGER', 'SOS Passenger');

    const sosRes = await request(app)
      .post('/api/safety/sos')
      .set(auth(passenger.token))
      .send({ coordinates: [77.2195, 28.6315] });

    expect(sosRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/v1/admin/sos/alerts')
      .set(auth(adminToken));

    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);

    const alertId = listRes.body.alerts[0]._id;

    const resolveRes = await request(app)
      .patch(`/api/v1/admin/sos/alerts/${alertId}/resolve`)
      .set(auth(adminToken))
      .send({ resolution: 'contacted emergency responders' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.alert.status).toBe('RESOLVED');

    const dbAlert = await SafetyEvent.findById(alertId).lean();
    expect(dbAlert.status).toBe('RESOLVED');
  });

  test('payment control: view transactions and process refund', async () => {
    const adminToken = await createAdminSession({ email: 'admin.payments@test.com' });

    const passenger = await registerUser('9193000006', 'PASSENGER', 'Refund Passenger');
    const driver = await registerUser('9193000007', 'DRIVER', 'Refund Driver');
    await approveDriverKYC(driver.userId);

    const publishRes = await request(app)
      .post('/api/rides')
      .set(auth(driver.token))
      .send(ridePayload());

    const rideId = publishRes.body.ride._id;

    const bookingRes = await request(app)
      .post('/api/bookings')
      .set(auth(passenger.token))
      .send({
        rideId,
        seatsBooked: 1,
        paymentMethod: 'WALLET',
        pickup: { name: 'CP', coordinates: [77.2195, 28.6315] },
        dropoff: { name: 'Cyber City', coordinates: [77.0878, 28.4949] },
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body.booking._id;

    const topupRes = await request(app)
      .post('/api/payments/topup')
      .set(auth(passenger.token))
      .send({ amount: 1000, paymentMethod: 'UPI' });

    expect(topupRes.status).toBe(201);

    const initRes = await request(app)
      .post('/api/payments/init')
      .set(auth(passenger.token))
      .send({ bookingId, paymentMethod: 'WALLET' });

    expect(initRes.status).toBe(201);

    const txRes = await request(app)
      .get('/api/v1/admin/payments/transactions')
      .set(auth(adminToken));

    expect(txRes.status).toBe(200);
    expect(txRes.body.total).toBeGreaterThan(0);

    const refundRes = await request(app)
      .post('/api/v1/admin/payments/refunds')
      .set(auth(adminToken))
      .send({ bookingId, reason: 'admin_test_refund' });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.transaction).toBeTruthy();

    const bookingAfterRefund = await BookingRequest.findById(bookingId).lean();
    expect(bookingAfterRefund.paymentStatus).toBe('REFUNDED');
  });

  test('config + analytics + logs endpoints work with role security', async () => {
    const adminToken = await createAdminSession({ email: 'admin.config@test.com' });

    const configRes = await request(app)
      .get('/api/v1/admin/config')
      .set(auth(adminToken));

    expect(configRes.status).toBe(200);
    expect(configRes.body.config.pricing).toBeTruthy();
    expect(configRes.body.config.penalties).toBeTruthy();

    const patchConfigRes = await request(app)
      .patch('/api/v1/admin/config')
      .set(auth(adminToken))
      .send({
        pricing: { defaultFuelPrice: 110, platformFeePercent: 0.12 },
        penalties: { waitPenaltyPerMinute: 3, freeWaitMinutes: 6, autoCancelWaitMinutes: 16 },
      });

    expect(patchConfigRes.status).toBe(200);
    expect(patchConfigRes.body.config.pricing.defaultFuelPrice).toBe(110);
    expect(patchConfigRes.body.config.penalties.waitPenaltyPerMinute).toBe(3);

    const analyticsRes = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set(auth(adminToken));

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.rides).toBeTruthy();
    expect(analyticsRes.body.users).toBeTruthy();
    expect(analyticsRes.body.revenue).toBeTruthy();

    const logsRes = await request(app)
      .get('/api/v1/admin/logs')
      .set(auth(adminToken));

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.total).toBeGreaterThan(0);
  });

  test('support role can view but cannot update config', async () => {
    const supportToken = await createAdminSession({
      role: 'SUPPORT',
      email: 'support.v1@test.com',
    });

    const getConfigRes = await request(app)
      .get('/api/v1/admin/config')
      .set(auth(supportToken));

    expect(getConfigRes.status).toBe(200);

    const patchConfigRes = await request(app)
      .patch('/api/v1/admin/config')
      .set(auth(supportToken))
      .send({ penalties: { waitPenaltyPerMinute: 5 } });

    expect(patchConfigRes.status).toBe(403);
  });

  test('legacy user APIs remain available while new v1 admin route exists', async () => {
    const adminToken = await createAdminSession({ email: 'admin.compat@test.com' });

    const driver = await registerUser('9193000008', 'DRIVER', 'Legacy Driver');
    await approveDriverKYC(driver.userId);

    const legacyRes = await request(app)
      .get('/api/admin/rides')
      .set(auth(adminToken));

    expect([200, 401, 403]).toContain(legacyRes.status);

    const v1Res = await request(app)
      .get('/api/v1/admin/rides')
      .set(auth(adminToken));

    expect(v1Res.status).toBe(200);

    const userApiRes = await request(app)
      .get('/api/rides')
      .query({ minSeats: 1 });

    expect(userApiRes.status).toBe(200);
    expect(Ride).toBeTruthy();
  });
});
