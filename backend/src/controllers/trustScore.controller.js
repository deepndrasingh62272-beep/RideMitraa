const User   = require('../models/User');
const Rating = require('../models/Rating');

// GET /api/users/:id/trust-score
exports.getTrustScore = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('trustScore rating cancellationCount totalRatings kycStatus')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      userId:            req.params.id,
      trustScore:        user.trustScore,
      rating:            user.rating,
      cancellationCount: user.cancellationCount,
      totalRatings:      user.totalRatings,
      kycStatus:         user.kycStatus,
    });
  } catch (err) {
    next(err);
  }
};
