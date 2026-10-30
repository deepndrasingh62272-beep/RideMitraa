const crypto = require('crypto');
const { verifyToken } = require('../utils/jwt');
const Session = require('../models/Session');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Wallet = require('../models/Wallet');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Check session is not revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findOne({ tokenHash, isRevoked: false });
    if (!session) return res.status(401).json({ error: 'Session expired or revoked' });

    const user = await User.findById(decoded.id).select('-__v');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.deletedAt) return res.status(403).json({ error: 'Account is blocked' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Access denied' });
  next();
};

const hasRideOwnerOrEarnings = async (userId) => {
  const [ownsRide, wallet] = await Promise.all([
    Ride.exists({ driverId: userId }),
    Wallet.findOne({ userId }).select('totalEarned pendingWithdrawal').lean(),
  ]);

  const totalEarned = Number(wallet?.totalEarned || 0);
  const pendingWithdrawal = Number(wallet?.pendingWithdrawal || 0);
  const hasEarnings = totalEarned > 0 || pendingWithdrawal > 0;

  return Boolean(ownsRide || hasEarnings);
};

const denyDriverCapability = (res) =>
  res.status(403).json({
    error: 'Access requires at least one offered ride or wallet earnings',
  });

// Dynamic driver-capability gate: no static DRIVER role dependency.
const requireRideOwnerOrEarnings = async (req, res, next) => {
  try {
    if (await hasRideOwnerOrEarnings(req.user._id)) return next();
    return denyDriverCapability(res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to verify ride ownership' });
  }
};

// KYC status can be accessed if the user has started KYC OR has dynamic driver capability.
const requireKycStatusAccess = async (req, res, next) => {
  const docs = req.user?.kycDocuments || {};
  const hasSubmittedKyc = Boolean(
    docs.govtId || docs.selfie || docs.rc || docs.insurance || docs.pollutionCert
  );
  const hasReviewedKyc = req.user?.kycStatus === 'APPROVED' || req.user?.kycStatus === 'REJECTED';

  if (hasSubmittedKyc || hasReviewedKyc) return next();

  try {
    if (await hasRideOwnerOrEarnings(req.user._id)) return next();
    return denyDriverCapability(res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to verify KYC status access' });
  }
};

// Any logged-in user can offer rides if KYC approved
const requireApprovedDriver = (req, res, next) => {
  if (req.user.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'KYC verification required to offer rides' });
  }
  next();
};

// Check user is not booking their own ride (handled in controller)
const requireNotOwnRide = (req, res, next) => next();

const requireAdmin = (req, res, next) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role))
    return res.status(403).json({ error: 'Admin access required' });
  next();
};

module.exports = {
  authenticate,
  requireRole,
  requireApprovedDriver,
  requireNotOwnRide,
  requireAdmin,
  requireRideOwnerOrEarnings,
  requireKycStatusAccess,
};
