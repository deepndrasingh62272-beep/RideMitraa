const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const BookingRequest = require('../models/BookingRequest');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

const RAZORPAY_CURRENCY = 'INR';

// ─── Internal helpers ─────────────────────────────────────────────────────────

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const toPaise = (amount) => Math.round(Number(amount || 0) * 100);
const isDuplicateKeyError = (err) => err?.code === 11000;

const getIdempotencyKey = (req) => {
  const raw = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (!raw) return null;
  const key = String(raw).trim();
  if (!key) return null;
  return key.slice(0, 120);
};

const normalizeIdempotencyKey = (key) => (key ? String(key) : undefined);

const getOrCreateWallet = async (userId, session) => {
  let wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) {
    [wallet] = await Wallet.create([{ userId }], { session });
  }
  return wallet;
};

const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let razorpayClient;
const getRazorpayClient = () => {
  if (!isRazorpayConfigured()) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

const gatewayCreateOrder = async ({ bookingId, amount, receipt, method }) => {
  const client = getRazorpayClient();
  if (!client) {
    return {
      mock: true,
      id: `order_mock_${Date.now()}`,
      amount: toPaise(amount),
      currency: RAZORPAY_CURRENCY,
      receipt,
      notes: { bookingId: String(bookingId), method },
    };
  }

  return client.orders.create({
    amount: toPaise(amount),
    currency: RAZORPAY_CURRENCY,
    receipt,
    notes: { bookingId: String(bookingId), method },
  });
};

const gatewayRefund = async ({ paymentId, amount, bookingId }) => {
  const client = getRazorpayClient();
  if (!client || !paymentId) {
    return { mock: true, id: `rfnd_mock_${Date.now()}` };
  }

  return client.payments.refund(paymentId, {
    amount: toPaise(amount),
    notes: { bookingId: String(bookingId) },
  });
};

const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return true; // dev/test mode
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
};

const findIdempotentTransaction = async (idempotencyKey) => {
  if (!idempotencyKey) return null;
  return Transaction.findOne({ idempotencyKey }).lean();
};

const computeRefundPolicy = (booking) => {
  const total = round2(booking.totalAmount);
  if (total <= 0) {
    return { refundAmount: 0, retainedAmount: 0, policy: 'NO_CHARGE' };
  }

  if (booking.status === 'COMPLETED') {
    return { refundAmount: 0, retainedAmount: total, policy: 'NO_REFUND_AFTER_COMPLETION' };
  }

  if (booking.status === 'CANCELLED' && booking.cancelledBy === 'PASSENGER') {
    const penalty = Math.max(0, round2(booking.penaltyAmount || 0));
    const refundAmount = Math.max(0, round2(total - penalty));
    const retainedAmount = round2(total - refundAmount);
    return {
      refundAmount,
      retainedAmount,
      policy: penalty > 0 ? 'PASSENGER_CANCEL_WITH_PENALTY' : 'PASSENGER_CANCEL_FULL',
    };
  }

  return { refundAmount: total, retainedAmount: 0, policy: 'FULL_REFUND' };
};

const refundBookingInternal = async ({
  booking,
  session,
  idempotencyKey,
  reason,
  source = 'MANUAL',
}) => {
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  if (booking.paymentStatus === 'REFUNDED') {
    const existing = await Transaction.findOne({ bookingId: booking._id, type: 'REFUND' })
      .sort({ createdAt: -1 })
      .session(session);
    return {
      transaction: existing,
      policy: 'ALREADY_REFUNDED',
      refundAmount: existing?.amount ?? 0,
      retainedAmount: 0,
    };
  }

  if (booking.paymentStatus === 'UNPAID') {
    return { transaction: null, policy: 'NO_PAYMENT_TO_REFUND', refundAmount: 0, retainedAmount: 0 };
  }

  const { refundAmount, retainedAmount, policy } = computeRefundPolicy(booking);
  const now = new Date();

  let gatewayRefundId = null;
  let note = `Refund policy applied: ${policy}`;

  if (refundAmount > 0) {
    if (booking.paymentMethod === 'WALLET') {
      const wallet = await getOrCreateWallet(booking.passengerId, session);

      if (booking.paymentStatus === 'ESCROWED') {
        const release = Math.min(wallet.reserved, round2(booking.totalAmount));
        wallet.reserved = round2(wallet.reserved - release);
      }

      wallet.balance = round2(wallet.balance + refundAmount);
      await wallet.save({ session });

      note = `${note}; wallet refunded`;
    } else if (booking.paymentMethod === 'UPI' || booking.paymentMethod === 'CARD') {
      const paymentTxn = await Transaction.findOne({
        bookingId: booking._id,
        type: { $in: ['CHARGE', 'ESCROW_HOLD'] },
        paymentMethod: booking.paymentMethod,
      })
        .sort({ createdAt: -1 })
        .select('gatewayPaymentId gatewayRef')
        .session(session);

      const paymentId =
        booking.paymentGatewayPaymentId ||
        paymentTxn?.gatewayPaymentId ||
        paymentTxn?.gatewayRef;

      const refund = await gatewayRefund({
        paymentId,
        amount: refundAmount,
        bookingId: booking._id,
      });
      gatewayRefundId = refund.id;
      note = `${note}; gateway refund ${refund.mock ? 'mock' : 'processed'}`;
    }
  } else {
    note = `${note}; no refundable amount`;
  }

  let refundTxn;
  if (refundAmount > 0 || retainedAmount > 0) {
    [refundTxn] = await Transaction.create(
      [{
        userId: booking.passengerId,
        bookingId: booking._id,
        type: 'REFUND',
        amount: refundAmount,
        paymentMethod: booking.paymentMethod,
        status: 'SUCCESS',
        provider: booking.paymentProvider || (booking.paymentMethod === 'WALLET' ? 'INTERNAL' : 'RAZORPAY'),
        gatewayRefundId,
        idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
        note,
        metadata: {
          policy,
          retainedAmount,
          source,
          reason: reason || null,
        },
      }],
      { session }
    );
  }

  booking.paymentStatus = 'REFUNDED';
  booking.refundedAt = now;
  await booking.save({ session });

  return { transaction: refundTxn, policy, refundAmount, retainedAmount };
};

// ─── POST /api/payments/init and /api/payments/initiate ─────────────────────
/**
 * Escrow-first init flow:
 * - WALLET: move funds from wallet balance -> wallet reserved (escrow) immediately
 * - UPI/CARD: create Razorpay order, hold remains pending until webhook capture
 * - CASH: create trace record only (no escrow)
 */
exports.initiatePayment = async (req, res, next) => {
  const idempotencyKey = getIdempotencyKey(req);

  try {
    const existing = await findIdempotentTransaction(idempotencyKey);
    if (existing) {
      return res.status(200).json({
        message: 'Idempotent replay',
        transaction: existing,
      });
    }

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const { bookingId } = req.body;
      let { paymentMethod } = req.body;

      const booking = await BookingRequest.findById(bookingId).session(dbSession);
      if (!booking) {
        await dbSession.abortTransaction();
        return res.status(404).json({ error: 'Booking not found' });
      }
      if (String(booking.passengerId) !== String(req.user._id)) {
        await dbSession.abortTransaction();
        return res.status(403).json({ error: 'Access denied' });
      }

      if (['ESCROWED', 'PAID'].includes(booking.paymentStatus)) {
        await dbSession.commitTransaction();
        return res.status(200).json({
          message: 'Payment already initialized',
          paymentStatus: booking.paymentStatus,
          transactionId: booking.transactionId,
        });
      }

      if (booking.paymentStatus === 'REFUNDED') {
        await dbSession.abortTransaction();
        return res.status(400).json({ error: 'Booking is already refunded' });
      }

      paymentMethod = paymentMethod || booking.paymentMethod;
      if (!['WALLET', 'UPI', 'CARD', 'CASH'].includes(paymentMethod)) {
        await dbSession.abortTransaction();
        return res.status(400).json({ error: 'Unsupported payment method' });
      }

      const totalAmount = round2(booking.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        await dbSession.abortTransaction();
        return res.status(400).json({ error: 'Invalid booking amount' });
      }

      const now = new Date();
      const txPayload = {
        userId: booking.passengerId,
        bookingId: booking._id,
        amount: totalAmount,
        paymentMethod,
        idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
        metadata: {
          bookingStatus: booking.status,
          source: 'PAYMENT_INIT',
        },
      };

      let transaction;
      let order = null;

      if (paymentMethod === 'WALLET') {
        const wallet = await getOrCreateWallet(booking.passengerId, dbSession);
        if (wallet.balance < totalAmount) {
          await dbSession.abortTransaction();
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        wallet.balance = round2(wallet.balance - totalAmount);
        wallet.reserved = round2(wallet.reserved + totalAmount);
        await wallet.save({ session: dbSession });

        [transaction] = await Transaction.create(
          [{
            ...txPayload,
            type: 'ESCROW_HOLD',
            status: 'SUCCESS',
            provider: 'INTERNAL',
            note: 'Escrow hold created from wallet',
          }],
          { session: dbSession }
        );

        booking.paymentStatus = 'ESCROWED';
        booking.paymentProvider = 'INTERNAL';
        booking.escrowHeldAt = now;
      } else if (paymentMethod === 'UPI' || paymentMethod === 'CARD') {
        order = await gatewayCreateOrder({
          bookingId: booking._id,
          amount: totalAmount,
          receipt: `booking_${booking._id}_${Date.now()}`,
          method: paymentMethod,
        });

        [transaction] = await Transaction.create(
          [{
            ...txPayload,
            type: 'ESCROW_HOLD',
            status: 'PENDING',
            provider: 'RAZORPAY',
            gatewayOrderId: order.id,
            gatewayRef: order.id,
            note: 'Escrow hold pending gateway capture',
          }],
          { session: dbSession }
        );

        booking.paymentStatus = 'UNPAID';
        booking.paymentProvider = 'RAZORPAY';
        booking.paymentGatewayOrderId = order.id;
      } else {
        [transaction] = await Transaction.create(
          [{
            ...txPayload,
            type: 'CHARGE',
            status: 'PENDING',
            provider: 'INTERNAL',
            note: 'Cash payment intent recorded (no escrow hold)',
          }],
          { session: dbSession }
        );

        booking.paymentStatus = 'UNPAID';
        booking.paymentProvider = 'INTERNAL';
      }

      booking.paymentMethod = paymentMethod;
      booking.transactionId = transaction.transactionId;
      await booking.save({ session: dbSession });

      await dbSession.commitTransaction();

      const response = {
        message: 'Payment initialized',
        transaction,
        paymentStatus: booking.paymentStatus,
      };

      if (order) {
        response.gateway = {
          provider: 'RAZORPAY',
          order,
          keyId: process.env.RAZORPAY_KEY_ID || null,
          mock: Boolean(order.mock),
        };
      }

      return res.status(201).json(response);
    } catch (err) {
      await dbSession.abortTransaction();
      if (isDuplicateKeyError(err) && idempotencyKey) {
        const existingTx = await findIdempotentTransaction(idempotencyKey);
        if (existingTx) {
          return res.status(200).json({ message: 'Idempotent replay', transaction: existingTx });
        }
      }
      throw err;
    } finally {
      dbSession.endSession();
    }
  } catch (err) {
    next(err);
  }
};

// New endpoint alias requested by product spec.
exports.initPayment = exports.initiatePayment;

// ─── POST /api/payments/confirm (legacy compatibility) ───────────────────────
/**
 * Legacy endpoint retained for backward compatibility.
 * Escrow release now happens only on ride completion.
 */
exports.confirmPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await BookingRequest.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.paymentStatus === 'PAID') {
      return res.json({ message: 'Payment already settled', paymentStatus: booking.paymentStatus });
    }
    if (booking.paymentStatus === 'ESCROWED') {
      return res.json({ message: 'Payment already in escrow', paymentStatus: booking.paymentStatus });
    }

    if ((booking.paymentMethod === 'UPI' || booking.paymentMethod === 'CARD') && booking.paymentGatewayOrderId) {
      return res.status(202).json({
        message: 'Waiting for gateway webhook capture',
        paymentStatus: booking.paymentStatus,
        gatewayOrderId: booking.paymentGatewayOrderId,
      });
    }

    if (booking.paymentMethod === 'WALLET' && booking.paymentStatus === 'UNPAID') {
      return res.status(400).json({ error: 'Call /payments/init first for wallet escrow hold' });
    }

    return res.json({ message: 'No payment action required', paymentStatus: booking.paymentStatus });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
/**
 * Razorpay webhook handler.
 * Handles payment capture/failure and records idempotent event logs.
 */
exports.paymentWebhook = async (req, res, next) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const signature = req.headers['x-razorpay-signature'];

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body || {};
    const event = payload.event || 'unknown';

    const paymentEntity = payload?.payload?.payment?.entity;
    const refundEntity = payload?.payload?.refund?.entity;
    const gatewayEventId = [
      event,
      paymentEntity?.id || refundEntity?.id || payload?.created_at || Date.now(),
    ].join(':');

    const alreadyHandled = await Transaction.findOne({ gatewayEventId }).lean();
    if (alreadyHandled) return res.json({ received: true, duplicate: true });

    if (event === 'payment.captured' && paymentEntity?.order_id) {
      const dbSession = await mongoose.startSession();
      dbSession.startTransaction();
      try {
        const booking = await BookingRequest.findOne({
          paymentGatewayOrderId: paymentEntity.order_id,
        }).session(dbSession);

        if (booking) {
          const holdTxn = await Transaction.findOne({
            bookingId: booking._id,
            type: 'ESCROW_HOLD',
          })
            .sort({ createdAt: -1 })
            .session(dbSession);

          if (holdTxn) {
            holdTxn.status = 'SUCCESS';
            holdTxn.gatewayPaymentId = paymentEntity.id;
            holdTxn.gatewayRef = paymentEntity.id;
            holdTxn.gatewayEventId = `${gatewayEventId}:HOLD`;
            holdTxn.metadata = {
              ...(holdTxn.metadata || {}),
              amount: paymentEntity.amount,
              currency: paymentEntity.currency,
            };
            await holdTxn.save({ session: dbSession });
          }

          await Transaction.create(
            [{
              userId: booking.passengerId,
              bookingId: booking._id,
              type: 'CHARGE',
              amount: round2(booking.totalAmount),
              paymentMethod: booking.paymentMethod,
              status: 'SUCCESS',
              provider: 'RAZORPAY',
              gatewayPaymentId: paymentEntity.id,
              gatewayOrderId: paymentEntity.order_id,
              gatewayEventId,
              note: 'Gateway payment captured in escrow',
              relatedTransactionId: holdTxn?._id ?? null,
            }],
            { session: dbSession }
          );

          booking.paymentGatewayPaymentId = paymentEntity.id;
          booking.paymentStatus = 'ESCROWED';
          booking.escrowHeldAt = new Date();
          await booking.save({ session: dbSession });
        } else {
          console.warn('[Webhook] payment.captured received but booking not found for order', paymentEntity.order_id);
        }

        await dbSession.commitTransaction();
      } catch (err) {
        await dbSession.abortTransaction();
        throw err;
      } finally {
        dbSession.endSession();
      }
    } else if (event === 'payment.failed' && paymentEntity?.order_id) {
      const booking = await BookingRequest.findOne({ paymentGatewayOrderId: paymentEntity.order_id });
      if (booking) {
        booking.paymentStatus = 'UNPAID';
        await booking.save();

        await Transaction.create({
          userId: booking.passengerId,
          bookingId: booking._id,
          type: 'CHARGE',
          amount: round2(booking.totalAmount),
          paymentMethod: booking.paymentMethod || 'UPI',
          status: 'FAILED',
          provider: 'RAZORPAY',
          gatewayPaymentId: paymentEntity.id,
          gatewayOrderId: paymentEntity.order_id,
          gatewayEventId,
          note: 'Gateway payment failed',
        }).catch(() => {});
      } else {
        console.warn('[Webhook] payment.failed received but booking not found for order', paymentEntity.order_id);
      }
    } else if (event === 'refund.processed' && refundEntity?.payment_id) {
      const booking = await BookingRequest.findOne({ paymentGatewayPaymentId: refundEntity.payment_id });

      if (booking) {
        await Transaction.create({
          userId: booking.passengerId,
          bookingId: booking._id,
          type: 'REFUND',
          amount: round2((refundEntity.amount || 0) / 100),
          paymentMethod: booking.paymentMethod || 'UPI',
          status: 'SUCCESS',
          provider: 'RAZORPAY',
          gatewayPaymentId: refundEntity.payment_id,
          gatewayRefundId: refundEntity.id,
          gatewayEventId,
          note: 'Gateway refund processed via webhook',
        }).catch(() => {});

        if (booking.paymentStatus !== 'REFUNDED') {
          booking.paymentStatus = 'REFUNDED';
          booking.refundedAt = new Date();
          await booking.save();
        }
      } else {
        console.warn('[Webhook] refund.processed received but booking not found for payment', refundEntity.payment_id);
      }
    }

    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

exports.handleWebhook = exports.paymentWebhook;

// ─── Escrow settlement on ride completion ────────────────────────────────────
/**
 * Splits escrow at ride completion:
 * - release escrow
 * - credit driver share
 * - log platform fee
 */
exports.settleEscrowOnRideCompletion = async (rideId) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const bookings = await BookingRequest.find({
      rideId,
      status: 'COMPLETED',
      paymentStatus: 'ESCROWED',
    }).session(dbSession);

    const summary = {
      rideId: String(rideId),
      settledBookings: 0,
      skippedBookings: 0,
      totalDriverPayout: 0,
      totalPlatformFee: 0,
    };

    for (const booking of bookings) {
      const alreadyReleased = await Transaction.exists({
        bookingId: booking._id,
        type: 'ESCROW_RELEASE',
        status: 'SUCCESS',
      }).session(dbSession);
      if (alreadyReleased) {
        summary.skippedBookings += 1;
        continue;
      }

      const gross = round2(booking.totalAmount);
      const platformFee = round2(booking.platformFee || 0);
      const driverShare = Math.max(0, round2(gross - platformFee));

      if (booking.paymentMethod === 'WALLET') {
        const passengerWallet = await getOrCreateWallet(booking.passengerId, dbSession);
        const release = Math.min(passengerWallet.reserved, gross);
        passengerWallet.reserved = round2(passengerWallet.reserved - release);
        await passengerWallet.save({ session: dbSession });
      }

      const driverWallet = await getOrCreateWallet(booking.driverId, dbSession);
      driverWallet.balance = round2(driverWallet.balance + driverShare);
      driverWallet.totalEarned = round2(driverWallet.totalEarned + driverShare);
      await driverWallet.save({ session: dbSession });

      const [releaseTxn] = await Transaction.create(
        [{
          userId: booking.passengerId,
          bookingId: booking._id,
          type: 'ESCROW_RELEASE',
          amount: gross,
          paymentMethod: booking.paymentMethod,
          status: 'SUCCESS',
          provider: booking.paymentProvider || (booking.paymentMethod === 'WALLET' ? 'INTERNAL' : 'RAZORPAY'),
          gatewayOrderId: booking.paymentGatewayOrderId,
          gatewayPaymentId: booking.paymentGatewayPaymentId,
          note: 'Escrow released on ride completion',
        }],
        { session: dbSession }
      );

      await Transaction.create(
        [{
          userId: booking.driverId,
          bookingId: booking._id,
          type: 'EARNING',
          amount: driverShare,
          paymentMethod: booking.paymentMethod,
          status: 'SUCCESS',
          provider: booking.paymentProvider || (booking.paymentMethod === 'WALLET' ? 'INTERNAL' : 'RAZORPAY'),
          relatedTransactionId: releaseTxn._id,
          note: 'Driver earning settled from escrow',
        }],
        { session: dbSession }
      );

      await Transaction.create(
        [{
          userId: booking.passengerId,
          bookingId: booking._id,
          type: 'PLATFORM_FEE',
          amount: platformFee,
          paymentMethod: booking.paymentMethod,
          status: 'SUCCESS',
          provider: booking.paymentProvider || (booking.paymentMethod === 'WALLET' ? 'INTERNAL' : 'RAZORPAY'),
          relatedTransactionId: releaseTxn._id,
          note: 'Platform fee settled from escrow',
        }],
        { session: dbSession }
      );

      booking.paymentStatus = 'PAID';
      booking.settledAt = new Date();
      await booking.save({ session: dbSession });

      summary.settledBookings += 1;
      summary.totalDriverPayout = round2(summary.totalDriverPayout + driverShare);
      summary.totalPlatformFee = round2(summary.totalPlatformFee + platformFee);
    }

    await dbSession.commitTransaction();
    return summary;
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }
};

// ─── POST /api/payments/refund ───────────────────────────────────────────────
exports.refundPayment = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const { bookingId, reason } = req.body;
    const idempotencyKey = getIdempotencyKey(req);

    const existing = await findIdempotentTransaction(idempotencyKey);
    if (existing) {
      await dbSession.abortTransaction();
      return res.status(200).json({ message: 'Idempotent replay', transaction: existing });
    }

    const booking = await BookingRequest.findById(bookingId).session(dbSession);
    if (!booking) {
      await dbSession.abortTransaction();
      return res.status(404).json({ error: 'Booking not found' });
    }

    const uid = String(req.user._id);
    const isPassenger = String(booking.passengerId) === uid;
    const isDriver = String(booking.driverId) === uid;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role);
    if (!isPassenger && !isDriver && !isAdmin) {
      await dbSession.abortTransaction();
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await refundBookingInternal({
      booking,
      session: dbSession,
      idempotencyKey,
      reason,
      source: 'MANUAL',
    });

    await dbSession.commitTransaction();
    return res.json({
      message: 'Refund processed',
      transaction: result.transaction,
      policy: result.policy,
      refundedAmount: result.refundAmount,
      retainedAmount: result.retainedAmount,
    });
  } catch (err) {
    await dbSession.abortTransaction();
    if (isDuplicateKeyError(err)) {
      const existing = await findIdempotentTransaction(getIdempotencyKey(req));
      if (existing) return res.status(200).json({ message: 'Idempotent replay', transaction: existing });
    }
    next(err);
  } finally {
    dbSession.endSession();
  }
};

// ─── Internal: admin-driven refund for /api/v1/admin ────────────────────────
exports.processAdminRefund = async ({ bookingId, reason, idempotencyKey = null }) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
    if (normalizedKey) {
      const existing = await findIdempotentTransaction(normalizedKey);
      if (existing) {
        await dbSession.abortTransaction();
        return {
          replayed: true,
          transaction: existing,
          policy: existing?.metadata?.policy || 'IDEMPOTENT_REPLAY',
          refundAmount: existing?.amount || 0,
          retainedAmount: existing?.metadata?.retainedAmount || 0,
        };
      }
    }

    const booking = await BookingRequest.findById(bookingId).session(dbSession);
    if (!booking) {
      await dbSession.abortTransaction();
      throw Object.assign(new Error('Booking not found'), { status: 404 });
    }

    const result = await refundBookingInternal({
      booking,
      session: dbSession,
      idempotencyKey: normalizedKey,
      reason: reason || 'ADMIN_REFUND',
      source: 'ADMIN',
    });

    await dbSession.commitTransaction();
    return {
      replayed: false,
      transaction: result.transaction,
      policy: result.policy,
      refundAmount: result.refundAmount,
      retainedAmount: result.retainedAmount,
    };
  } catch (err) {
    await dbSession.abortTransaction();
    if (isDuplicateKeyError(err) && idempotencyKey) {
      const existing = await findIdempotentTransaction(normalizeIdempotencyKey(idempotencyKey));
      if (existing) {
        return {
          replayed: true,
          transaction: existing,
          policy: existing?.metadata?.policy || 'IDEMPOTENT_REPLAY',
          refundAmount: existing?.amount || 0,
          retainedAmount: existing?.metadata?.retainedAmount || 0,
        };
      }
    }
    throw err;
  } finally {
    dbSession.endSession();
  }
};

// ─── POST /api/payments/topup ────────────────────────────────────────────────
exports.topUpWallet = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const amount = round2(req.body.amount);
    const { paymentMethod } = req.body;
    const idempotencyKey = getIdempotencyKey(req);

    if (!['UPI', 'CARD'].includes(paymentMethod)) {
      await dbSession.abortTransaction();
      return res.status(400).json({ error: 'Top-up only supports UPI or CARD' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      await dbSession.abortTransaction();
      return res.status(400).json({ error: 'Invalid top-up amount' });
    }

    const existing = await findIdempotentTransaction(idempotencyKey);
    if (existing) {
      await dbSession.abortTransaction();
      return res.status(200).json({ message: 'Idempotent replay', transaction: existing });
    }

    const gatewayOrder = await gatewayCreateOrder({
      bookingId: req.user._id,
      amount,
      receipt: `topup_${req.user._id}_${Date.now()}`,
      method: paymentMethod,
    });

    const wallet = await getOrCreateWallet(req.user._id, dbSession);
    wallet.balance = round2(wallet.balance + amount);
    await wallet.save({ session: dbSession });

    const [txn] = await Transaction.create(
      [{
        userId: req.user._id,
        type: 'TOPUP',
        amount,
        paymentMethod,
        status: 'SUCCESS',
        provider: 'RAZORPAY',
        gatewayOrderId: gatewayOrder.id,
        gatewayRef: gatewayOrder.id,
        idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
        note: 'Wallet top-up',
      }],
      { session: dbSession }
    );

    await dbSession.commitTransaction();
    res.status(201).json({ message: 'Wallet topped up', balance: wallet.balance, transaction: txn });
  } catch (err) {
    await dbSession.abortTransaction();
    next(err);
  } finally {
    dbSession.endSession();
  }
};

// ─── GET /api/payments/wallet/:userId ────────────────────────────────────────
exports.getWallet = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (req.user._id.toString() !== targetId && req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied' });

    const wallet = await Wallet.findOne({ userId: targetId }).lean();

    const page = parseInt(req.query.page ?? 1);
    const limit = parseInt(req.query.limit ?? 20);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ userId: targetId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userId: targetId }),
    ]);

    res.json({
      balance: wallet?.balance ?? 0,
      reserved: wallet?.reserved ?? 0,
      pendingWithdrawal: wallet?.pendingWithdrawal ?? 0,
      totalEarned: wallet?.totalEarned ?? 0,
      transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Internal: auto-refund on reject / cancel ─────────────────────────────────
exports.processAutoRefund = async (bookingId) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const booking = await BookingRequest.findById(bookingId).session(dbSession);
    if (!booking) {
      await dbSession.abortTransaction();
      return;
    }

    const result = await refundBookingInternal({
      booking,
      session: dbSession,
      idempotencyKey: null,
      reason: 'AUTO_REFUND',
      source: 'AUTO',
    });

    if (result.policy === 'NO_PAYMENT_TO_REFUND') {
      await dbSession.abortTransaction();
      return;
    }

    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    console.error('[AutoRefund] Failed for booking', bookingId, err.message);
  } finally {
    dbSession.endSession();
  }
};

// ─── GET /api/payments/methods ───────────────────────────────────────────────
exports.getPaymentMethods = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id }).lean();
    const balance = wallet?.balance ?? 0;

    res.json({
      methods: [
        { id: 'WALLET', label: 'Wallet Balance', balance, available: balance > 0 },
        { id: 'UPI', label: 'UPI Payment', available: true },
        { id: 'CARD', label: 'Credit/Debit Card', available: true },
        { id: 'CASH', label: 'Cash', available: true },
      ],
      escrow: {
        enabled: true,
        provider: isRazorpayConfigured() ? 'RAZORPAY' : 'MOCK',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/payments/transactions ──────────────────────────────────────────
exports.getMyTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page ?? 1);
    const limit = parseInt(req.query.limit ?? 20);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userId: req.user._id }),
    ]);

    res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/wallet/withdraw ──────────────────────────────────────
exports.withdrawFromWallet = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const amount = round2(req.body.amount);
    const { upiId } = req.body;

    const wallet = await Wallet.findOne({ userId: req.user._id }).session(dbSession);
    if (!wallet || wallet.balance < amount) {
      await dbSession.abortTransaction();
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    wallet.balance = round2(wallet.balance - amount);
    await wallet.save({ session: dbSession });

    const [txn] = await Transaction.create(
      [{
        userId: req.user._id,
        type: 'WITHDRAWAL',
        amount,
        paymentMethod: 'UPI',
        status: 'SUCCESS',
        provider: 'INTERNAL',
        note: `Withdrawal to UPI: ${upiId}`,
        gatewayRef: `WD-${Date.now()}`,
      }],
      { session: dbSession }
    );

    await dbSession.commitTransaction();
    res.json({ message: 'Withdrawal initiated', balance: wallet.balance, transaction: txn });
  } catch (err) {
    await dbSession.abortTransaction();
    next(err);
  } finally {
    dbSession.endSession();
  }
};
