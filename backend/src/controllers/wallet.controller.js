const Wallet      = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// ─── GET /api/wallet/balance ──────────────────────────────────────────────────
exports.getBalance = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let wallet = await Wallet.findOne({ userId }).lean();
    if (!wallet) {
      wallet = await Wallet.create({ userId });
      wallet = wallet.toObject();
    }

    res.json({
      balance:           wallet.balance           ?? 0,
      reserved:          wallet.reserved          ?? 0,
      pendingWithdrawal: wallet.pendingWithdrawal ?? 0,
      totalEarned:       wallet.totalEarned       ?? 0,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/wallet/transactions ────────────────────────────────────────────
exports.getTransactions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { type }  = req.query;
    const page  = parseInt(req.query.page  ?? 1);
    const limit = parseInt(req.query.limit ?? 20);
    const skip  = (page - 1) * limit;

    const filter = { userId };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/wallet/topup ───────────────────────────────────────────────────
exports.topUp = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount < 1 || amount > 10000) {
      return res.status(400).json({ error: 'Amount must be between ₹1 and ₹10,000' });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );

    const transaction = await Transaction.create({
      userId,
      type:          'TOPUP',
      amount,
      paymentMethod: 'WALLET',
      status:        'SUCCESS',
    });

    res.status(201).json({
      message:     'Wallet topped up',
      balance:     wallet.balance,
      transaction,
    });
  } catch (err) {
    next(err);
  }
};
