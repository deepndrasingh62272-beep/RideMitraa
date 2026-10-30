const User = require('../models/User');
const Transaction = require('../models/Transaction');

const getMyReferrals = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get the user's referral code
    const user = await User.findById(userId).select('referralCode');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Count users referred by this user
    const totalReferrals = await User.countDocuments({ referredBy: userId });

    // Sum all referral bonus TOPUP transactions for this user
    const bonusAgg = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'TOPUP',
          note: 'Referral bonus',
          status: 'SUCCESS',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalBonusEarned = bonusAgg.length > 0 ? bonusAgg[0].total : 0;

    return res.json({
      referralCode: user.referralCode || null,
      totalReferrals,
      totalBonusEarned,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getMyReferrals };
