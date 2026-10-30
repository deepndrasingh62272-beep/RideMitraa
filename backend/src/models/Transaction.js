const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, unique: true, default: () => `TXN-${randomUUID()}` },

    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest' },

    type: {
      type: String,
      enum: [
        'RESERVE',    // funds held on booking creation (WALLET)
        'CHARGE',     // funds deducted on booking creation (UPI/CARD)
        'CONFIRM',    // reserved funds moved to driver on acceptance
        'REFUND',     // funds returned to passenger
        'TOPUP',      // wallet top-up
        'EARNING',    // driver receives ride earnings
        'WITHDRAWAL', // driver withdraws earnings
        'ESCROW_HOLD',
        'ESCROW_RELEASE',
        'PLATFORM_FEE',
      ],
      required: true,
    },

    amount:        { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'WALLET'], required: true },

    status: {
      type:    String,
      enum:    ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
    },

    // For UPI/CARD — external gateway reference
    gatewayRef: { type: String },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewayRefundId: { type: String },
    gatewayEventId: { type: String },
    provider: {
      type: String,
      enum: ['INTERNAL', 'RAZORPAY'],
      default: 'INTERNAL',
    },

    idempotencyKey: { type: String },
    relatedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    note: { type: String },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ gatewayEventId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ gatewayOrderId: 1 });
transactionSchema.index({ gatewayPaymentId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
