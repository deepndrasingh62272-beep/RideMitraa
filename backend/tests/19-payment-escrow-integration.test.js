const request = require('supertest');
const crypto = require('crypto');
const app = require('./app');

const Wallet = require('../src/models/Wallet');
const BookingRequest = require('../src/models/BookingRequest');
const Transaction = require('../src/models/Transaction');

const { registerUser, approveDriverKYC, ridePayload, auth } = require('./helpers');

const pickup = {
  name: 'Connaught Place',
  coordinates: [77.2195, 28.6315],
};

const dropoff = {
  name: 'Cyber City',
  coordinates: [77.0878, 28.4949],
};

const createRideAndBooking = async ({
  passengerPhone,
  driverPhone,
  paymentMethod,
}) => {
  const passenger = await registerUser(passengerPhone, 'PASSENGER', 'Escrow Passenger');
  const driver = await registerUser(driverPhone, 'DRIVER', 'Escrow Driver');
  await approveDriverKYC(driver.userId);

  const publishRes = await request(app)
    .post('/api/rides')
    .set(auth(driver.token))
    .send(ridePayload());
  expect(publishRes.status).toBe(201);

  const rideId = publishRes.body.ride._id;

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set(auth(passenger.token))
    .send({
      rideId,
      passengersCount: 1,
      paymentMethod,
      pickup,
      dropoff,
    });

  expect(bookingRes.status).toBe(201);

  return {
    passenger,
    driver,
    rideId,
    bookingId: bookingRes.body.booking._id,
  };
};

describe('19. PAYMENT ESCROW INTEGRATION', () => {
  test('POST /api/payments/init moves wallet funds into escrow', async () => {
    const ctx = await createRideAndBooking({
      passengerPhone: '9191000001',
      driverPhone: '9191000002',
      paymentMethod: 'WALLET',
    });

    const topupRes = await request(app)
      .post('/api/payments/topup')
      .set(auth(ctx.passenger.token))
      .send({ amount: 1000, paymentMethod: 'UPI' });

    expect(topupRes.status).toBe(201);

    const walletBefore = await Wallet.findOne({ userId: ctx.passenger.userId }).lean();
    expect(walletBefore).toBeTruthy();

    const initRes = await request(app)
      .post('/api/payments/init')
      .set(auth(ctx.passenger.token))
      .set('Idempotency-Key', 'init-escrow-wallet-1')
      .send({ bookingId: ctx.bookingId, paymentMethod: 'WALLET' });

    expect(initRes.status).toBe(201);
    expect(initRes.body.paymentStatus).toBe('ESCROWED');

    const booking = await BookingRequest.findById(ctx.bookingId).lean();
    expect(booking.paymentStatus).toBe('ESCROWED');

    const walletAfter = await Wallet.findOne({ userId: ctx.passenger.userId }).lean();
    expect(walletAfter.reserved).toBeGreaterThan(0);
    expect(walletAfter.balance).toBeLessThan(walletBefore.balance);

    const holdTxn = await Transaction.findOne({
      bookingId: ctx.bookingId,
      type: 'ESCROW_HOLD',
    }).lean();

    expect(holdTxn).toBeTruthy();
    expect(holdTxn.status).toBe('SUCCESS');
    expect(holdTxn.idempotencyKey).toBe('init-escrow-wallet-1');
  });

  test('POST /api/payments/webhook captures payment into escrow and deduplicates events', async () => {
    const ctx = await createRideAndBooking({
      passengerPhone: '9191000003',
      driverPhone: '9191000004',
      paymentMethod: 'UPI',
    });

    const initRes = await request(app)
      .post('/api/payments/init')
      .set(auth(ctx.passenger.token))
      .send({ bookingId: ctx.bookingId, paymentMethod: 'UPI' });

    expect(initRes.status).toBe(201);

    const bookingAfterInit = await BookingRequest.findById(ctx.bookingId).lean();
    expect(bookingAfterInit.paymentGatewayOrderId).toBeTruthy();

    const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

    try {
      const paymentId = 'pay_test_escrow_capture_1';
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: bookingAfterInit.paymentGatewayOrderId,
              amount: Math.round(Number(bookingAfterInit.totalAmount) * 100),
              currency: 'INR',
            },
          },
        },
      };

      const rawPayload = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const webhookRes = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .send(rawPayload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.received).toBe(true);

      const duplicateRes = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .send(rawPayload);

      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.duplicate).toBe(true);

      const bookingAfterWebhook = await BookingRequest.findById(ctx.bookingId).lean();
      expect(bookingAfterWebhook.paymentStatus).toBe('ESCROWED');
      expect(bookingAfterWebhook.paymentGatewayPaymentId).toBe(paymentId);

      const chargeTxn = await Transaction.findOne({
        bookingId: ctx.bookingId,
        type: 'CHARGE',
        gatewayPaymentId: paymentId,
      }).lean();

      expect(chargeTxn).toBeTruthy();
      expect(chargeTxn.status).toBe('SUCCESS');
    } finally {
      process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret;
    }
  });

  test('POST /api/payments/refund is idempotent with same idempotency key', async () => {
    const ctx = await createRideAndBooking({
      passengerPhone: '9191000005',
      driverPhone: '9191000006',
      paymentMethod: 'WALLET',
    });

    const topupRes = await request(app)
      .post('/api/payments/topup')
      .set(auth(ctx.passenger.token))
      .send({ amount: 1200, paymentMethod: 'UPI' });

    expect(topupRes.status).toBe(201);

    const walletBeforeInit = await Wallet.findOne({ userId: ctx.passenger.userId }).lean();

    const initRes = await request(app)
      .post('/api/payments/init')
      .set(auth(ctx.passenger.token))
      .send({ bookingId: ctx.bookingId, paymentMethod: 'WALLET' });

    expect(initRes.status).toBe(201);

    const idemKey = 'refund-idempotency-escrow-1';

    const firstRefund = await request(app)
      .post('/api/payments/refund')
      .set(auth(ctx.passenger.token))
      .set('Idempotency-Key', idemKey)
      .send({ bookingId: ctx.bookingId, reason: 'test_refund' });

    expect(firstRefund.status).toBe(200);
    expect(firstRefund.body.transaction).toBeTruthy();

    const secondRefund = await request(app)
      .post('/api/payments/refund')
      .set(auth(ctx.passenger.token))
      .set('Idempotency-Key', idemKey)
      .send({ bookingId: ctx.bookingId, reason: 'test_refund_repeat' });

    expect(secondRefund.status).toBe(200);
    expect(secondRefund.body.message).toBe('Idempotent replay');

    const refundCount = await Transaction.countDocuments({
      bookingId: ctx.bookingId,
      type: 'REFUND',
    });
    expect(refundCount).toBe(1);

    const bookingAfterRefund = await BookingRequest.findById(ctx.bookingId).lean();
    expect(bookingAfterRefund.paymentStatus).toBe('REFUNDED');

    const walletAfterRefund = await Wallet.findOne({ userId: ctx.passenger.userId }).lean();
    expect(walletAfterRefund.reserved).toBe(0);
    expect(walletAfterRefund.balance).toBeCloseTo(walletBeforeInit.balance, 2);
  });
});
