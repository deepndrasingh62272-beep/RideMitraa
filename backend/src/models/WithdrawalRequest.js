const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    driverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount:        { type: Number, required: true, min: 1 },

    // Bank / UPI details provided by driver
    accountDetails: {
      method:        { type: String, enum: ['BANK', 'UPI'], required: true },
      upiId:         { type: String },                  // for UPI
      accountNumber: { type: String },                  // for BANK
      ifsc:          { type: String },                  // for BANK
      accountName:   { type: String },
    },

    status: {
      type:    String,
      enum:    ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'],
      default: 'PENDING',
    },

    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },
    rejectReason:{ type: String, default: null },

    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  },
  { timestamps: true }
);

withdrawalSchema.index({ driverId: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: -1 }); // admin queue

module.exports = mongoose.model('WithdrawalRequest', withdrawalSchema);
