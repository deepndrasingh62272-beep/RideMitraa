const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/payment.controller');

// ─── POST /api/payments/init (new) ───────────────────────────────────────────
router.post(
  '/init',
  authenticate,
  [
    body('bookingId').isMongoId().withMessage('Valid bookingId required'),
    body('paymentMethod').optional().isIn(['WALLET', 'UPI', 'CARD', 'CASH']).withMessage('Invalid payment method'),
    body('idempotencyKey').optional().isString().isLength({ max: 120 }).withMessage('idempotencyKey is invalid'),
  ],
  validate,
  ctrl.initPayment
);

// ─── POST /api/payments/initiate (legacy alias) ─────────────────────────────
router.post(
  '/initiate',
  authenticate,
  [
    body('bookingId').isMongoId().withMessage('Valid bookingId required'),
    body('paymentMethod').optional().isIn(['WALLET', 'UPI', 'CARD', 'CASH']).withMessage('Invalid payment method'),
    body('idempotencyKey').optional().isString().isLength({ max: 120 }).withMessage('idempotencyKey is invalid'),
  ],
  validate,
  ctrl.initiatePayment
);

// ─── POST /api/payments/webhook (Razorpay) ──────────────────────────────────
router.post('/webhook', ctrl.paymentWebhook);

// ─── POST /api/payments/confirm ──────────────────────────────────────────────
router.post(
  '/confirm',
  authenticate,
  [body('bookingId').isMongoId().withMessage('Valid bookingId required')],
  validate,
  ctrl.confirmPayment
);

// ─── POST /api/payments/refund ───────────────────────────────────────────────
router.post(
  '/refund',
  authenticate,
  [
    body('bookingId').isMongoId().withMessage('Valid bookingId required'),
    body('idempotencyKey').optional().isString().isLength({ max: 120 }).withMessage('idempotencyKey is invalid'),
  ],
  validate,
  ctrl.refundPayment
);

// ─── POST /api/payments/topup ────────────────────────────────────────────────
router.post(
  '/topup',
  authenticate,
  [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
    body('paymentMethod').isIn(['UPI', 'CARD']).withMessage('Top-up supports UPI or CARD only'),
  ],
  validate,
  ctrl.topUpWallet
);

// ─── GET /api/payments/wallet/:userId ────────────────────────────────────────
router.get('/wallet/:userId', authenticate, ctrl.getWallet);

// ─── GET /api/payments/methods ───────────────────────────────────────────────
router.get('/methods', authenticate, ctrl.getPaymentMethods);

// ─── GET /api/payments/transactions ──────────────────────────────────────────
router.get('/transactions', authenticate, ctrl.getMyTransactions);

// ─── POST /api/payments/wallet/topup (alias) ─────────────────────────────────
router.post('/wallet/topup', authenticate,
  [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
    body('paymentMethod').isIn(['UPI', 'CARD']).withMessage('Top-up supports UPI or CARD only'),
  ],
  validate,
  ctrl.topUpWallet
);

// ─── POST /api/payments/wallet/withdraw (alias) ──────────────────────────────
router.post('/wallet/withdraw', authenticate,
  [
    body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal is ₹100'),
    body('upiId').notEmpty().withMessage('UPI ID is required for withdrawal'),
  ],
  validate,
  ctrl.withdrawFromWallet
);

module.exports = router;
