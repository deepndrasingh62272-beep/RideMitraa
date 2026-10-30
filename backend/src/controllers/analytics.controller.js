const { getUserAnalytics } = require('../utils/analytics');

const getMyAnalytics = async (req, res) => {
  try {
    const analytics = await getUserAnalytics(req.user._id);
    res.json(analytics);
  } catch (err) {
    console.error('getMyAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

module.exports = { getMyAnalytics };
