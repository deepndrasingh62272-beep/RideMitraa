const mongoose = require('mongoose');
const Wallet            = require('../models/Wallet');
const Transaction       = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { notify }        = require('../utils/notify');
const { audit }         = require('../utils/audit');

const MIN_WITHDRAWAL = 100; // INR

// ─── GET /api/driver/wallet ───────────────────────────────────────────────────
// Driver views their wallet balance + earnings summary + transaction history

exports.getDriverWallet = async (req, res, next) => {
  try {
    const driverId = req.user._id;

    const wallet = await Wallet.findOne({ userId: driverId }).lean();
    const page   = parseInt(req.query.page  ?? 1);
    const limit  = parseInt(req.query.limit ?? 20);
    const skip   = (page - 1) * limit;

    const [transactions, total, earningStats] = await Promise.all([
      Transaction.find({ userId: driverId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userId: driverId }),
      // Aggregate earnings breakdown
      Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(driverId), type: 'EARNING' } },
        {
          $group: {
            _id:          null,
            totalEarned:  { $sum: '$amount' },
            rideCount:    { $sum: 1 },
            avgPerRide:   { $avg: '$amount' },
          },
        },
      ]),
    ]);

    const stats = earningStats[0] ?? { totalEarned: 0, rideCount: 0, avgPerRide: 0 };

    res.json({
      balance:           wallet?.balance           ?? 0,
      reserved:          wallet?.reserved          ?? 0,
      pendingWithdrawal: wallet?.pendingWithdrawal ?? 0,
      totalEarned:       wallet?.totalEarned       ?? 0,
      earnings: {
        totalEarned: parseFloat(stats.totalEarned.toFixed(2)),
        rideCount:   stats.rideCount,
        avgPerRide:  parseFloat(stats.avgPerRide.toFixed(2)),
      },
      transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/driver/withdraw ────────────────────────────────────────────────
// Driver requests a withdrawal

exports.requestWithdrawal = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const driverId = req.user._id;
    const { amount, accountDetails } = req.body;

    if (amount < MIN_WITHDRAWAL)
      return res.status(400).json({ error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}` });

    // Block if a pending withdrawal already exists
    const existing = await WithdrawalRequest.findOne({ driverId, status: 'PENDING' }).session(dbSession);
    if (existing)
      return res.status(409).json({ error: 'You already have a pending withdrawal request' });

    const wallet = await Wallet.findOne({ userId: driverId }).session(dbSession);
    const available = (wallet?.balance ?? 0) - (wallet?.pendingWithdrawal ?? 0);

    if (available < amount)
      return res.status(400).json({ error: `Insufficient balance. Available: ₹${available.toFixed(2)}` });

    // Lock the amount in pendingWithdrawal
    wallet.pendingWithdrawal += amount;
    await wallet.save({ session: dbSession });

    const withdrawal = await WithdrawalRequest.create(
      [{ driverId, amount, accountDetails }],
      { session: dbSession }
    );

    await dbSession.commitTransaction();

    audit({
      req,
      user:       req.user,
      action:     'WITHDRAWAL_REQUESTED',
      resource:   'WithdrawalRequest',
      resourceId: withdrawal[0]._id,
      meta:       { amount },
    });

    res.status(201).json({ message: 'Withdrawal request submitted', withdrawal: withdrawal[0] });
  } catch (err) {
    await dbSession.abortTransaction();
    next(err);
  } finally {
    dbSession.endSession();
  }
};

// ─── POST /api/admin/withdrawals/:id/approve ─────────────────────────────────
// Admin approves a withdrawal — deducts from wallet, creates WITHDRAWAL transaction

exports.approveWithdrawal = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id).session(dbSession);
    if (!withdrawal)
      return res.status(404).json({ error: 'Withdrawal request not found' });
    if (withdrawal.status !== 'PENDING')
      return res.status(400).json({ error: `Request is already ${withdrawal.status}` });

    const wallet = await Wallet.findOne({ userId: withdrawal.driverId }).session(dbSession);
    if (!wallet || wallet.balance < withdrawal.amount) {
      await dbSession.abortTransaction();
      return res.status(400).json({ error: 'Insufficient wallet balance to process withdrawal' });
    }

    // Deduct from balance and clear the pending lock
    wallet.balance            -= withdrawal.amount;
    wallet.pendingWithdrawal  -= withdrawal.amount;
    await wallet.save({ session: dbSession });

    // Record the withdrawal transaction
    const [txn] = await Transaction.create(
      [{
        userId:        withdrawal.driverId,
        type:          'WITHDRAWAL',
        amount:        withdrawal.amount,
        paymentMethod: withdrawal.accountDetails.method === 'UPI' ? 'UPI' : 'CARD',
        note:          `Withdrawal to ${withdrawal.accountDetails.method} — ${withdrawal.accountDetails.upiId ?? withdrawal.accountDetails.accountNumber}`,
      }],
      { session: dbSession }
    );

    withdrawal.status        = 'PROCESSED';
    withdrawal.reviewedBy    = req.user._id;
    withdrawal.reviewedAt    = new Date();
    withdrawal.transactionId = txn._id;
    await withdrawal.save({ session: dbSession });

    await dbSession.commitTransaction();

    notify({
      userId: withdrawal.driverId,
      type:   'ACCEPTED',
      title:  'Withdrawal Approved',
      body:   `Your withdrawal of ₹${withdrawal.amount} has been approved and is being processed.`,
      data:   { withdrawalId: withdrawal._id, amount: withdrawal.amount },
    });

    audit({
      req,
      user:       req.user,
      action:     'WITHDRAWAL_APPROVED',
      resource:   'WithdrawalRequest',
      resourceId: withdrawal._id,
      meta:       { amount: withdrawal.amount, driverId: withdrawal.driverId },
    });

    res.json({ message: 'Withdrawal approved and processed', withdrawal, transaction: txn });
  } catch (err) {
    await dbSession.abortTransaction();
    next(err);
  } finally {
    dbSession.endSession();
  }
};

// ─── POST /api/admin/withdrawals/:id/reject ───────────────────────────────────
// Admin rejects a withdrawal — releases the pending lock back to balance

exports.rejectWithdrawal = async (req, res, next) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    const { reason } = req.body;
    const withdrawal = await WithdrawalRequest.findById(req.params.id).session(dbSession);
    if (!withdrawal)
      return res.status(404).json({ error: 'Withdrawal request not found' });
    if (withdrawal.status !== 'PENDING')
      return res.status(400).json({ error: `Request is already ${withdrawal.status}` });

    // Release the locked amount
    await Wallet.findOneAndUpdate(
      { userId: withdrawal.driverId },
      { $inc: { pendingWithdrawal: -withdrawal.amount } },
      { session: dbSession }
    );

    withdrawal.status       = 'REJECTED';
    withdrawal.reviewedBy   = req.user._id;
    withdrawal.reviewedAt   = new Date();
    withdrawal.rejectReason = reason ?? 'Rejected by admin';
    await withdrawal.save({ session: dbSession });

    await dbSession.commitTransaction();

    notify({
      userId: withdrawal.driverId,
      type:   'REJECTED',
      title:  'Withdrawal Rejected',
      body:   `Your withdrawal request was rejected. Reason: ${withdrawal.rejectReason}`,
      data:   { withdrawalId: withdrawal._id },
    });

    audit({
      req,
      user:       req.user,
      action:     'WITHDRAWAL_REJECTED',
      resource:   'WithdrawalRequest',
      resourceId: withdrawal._id,
      meta:       { reason: withdrawal.rejectReason },
    });

    res.json({ message: 'Withdrawal rejected', withdrawal });
  } catch (err) {
    await dbSession.abortTransaction();
    next(err);
  } finally {
    dbSession.endSession();
  }
};

// ─── GET /api/admin/withdrawals ───────────────────────────────────────────────
// Admin lists all withdrawal requests (filterable by status)

exports.listWithdrawals = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const skip   = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('driverId', 'name phone')
        .lean(),
      WithdrawalRequest.countDocuments(filter),
    ]);

    res.json({ total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), withdrawals });
  } catch (err) {
    next(err);
  }
};
