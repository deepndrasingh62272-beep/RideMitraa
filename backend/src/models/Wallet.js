const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance:            { type: Number, default: 0, min: 0 },   // available balance in INR
    reserved:           { type: Number, default: 0, min: 0 },   // funds held pending driver acceptance
    pendingWithdrawal:  { type: Number, default: 0, min: 0 },   // amount locked in a pending withdrawal
    totalEarned:        { type: Number, default: 0, min: 0 },   // lifetime driver earnings
  },
  { timestamps: true }
);

async function syncUserWalletBalance(doc) {
  if (!doc) return;
  try {
    const User = require('./User');
    await User.updateOne(
      { _id: doc.userId },
      { $set: { walletBalance: doc.balance ?? 0 } }
    );
  } catch {
    // best effort sync
  }
}

walletSchema.post('save', async function postSave() {
  await syncUserWalletBalance(this);
});

walletSchema.post('findOneAndUpdate', async function postFindOneAndUpdate(doc) {
  await syncUserWalletBalance(doc);
});

module.exports = mongoose.model('Wallet', walletSchema);
