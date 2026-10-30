const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Ride = require('../models/Ride');
const RideLocation = require('../models/RideLocation');
const BookingRequest = require('../models/BookingRequest');
const Transaction = require('../models/Transaction');
const SafetyEvent = require('../models/SafetyEvent');
const AuditLog = require('../models/AuditLog');

const { generateAdminToken } = require('../utils/adminJwt');
const { audit } = require('../utils/audit');
const { processAdminRefund } = require('./payment.controller');
const {
  getPlatformConfig,
  updatePlatformConfig,
} = require('../services/platformConfigService');

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];

const paginate = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const toDateRange = (query = {}) => {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return { from, to };
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email: String(email).toLowerCase() })
      .select('+password name email role deletedAt')
      .lean();

    if (!admin || !ADMIN_ROLES.includes(admin.role)) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    if (admin.deletedAt) {
      return res.status(403).json({ error: 'Admin account is blocked' });
    }

    if (!admin.password) {
      return res.status(401).json({ error: 'Password login is not enabled for this admin account' });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = generateAdminToken({ id: admin._id, role: admin.role, type: 'ADMIN' });

    audit({
      req,
      user: admin,
      action: 'ADMIN_LOGIN',
      resource: 'User',
      resourceId: admin._id,
      severity: 'INFO',
    });

    return res.json({
      message: 'Admin login successful',
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({
    admin: {
      _id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role,
    },
  });
};

exports.listUsers = async (req, res, next) => {
  try {
    const { role, search, blocked } = req.query;
    const { page, limit, skip } = paginate(req.query);

    const filter = {};
    if (role) filter.role = role;
    if (blocked === 'true') filter.deletedAt = { $ne: null };
    if (blocked === 'false') filter.deletedAt = null;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('userId name phone email role rating trustScore totalRatings kycStatus cancellationCount deletedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ total, page, limit, users });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('userId name phone email role rating trustScore totalRatings kycStatus cancellationCount emergencyContacts deletedAt banReason createdAt updatedAt')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.blockUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { deletedAt: new Date(), banReason: reason || 'Blocked by admin' } },
      { new: true }
    ).select('name phone email role deletedAt banReason');

    if (!user) return res.status(404).json({ error: 'User not found' });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_USER_BLOCKED',
      resource: 'User',
      resourceId: user._id,
      meta: { reason: user.banReason },
      severity: 'CRITICAL',
    });

    res.json({ message: 'User blocked', user });
  } catch (err) {
    next(err);
  }
};

exports.unblockUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { deletedAt: null, banReason: null } },
      { new: true }
    ).select('name phone email role deletedAt');

    if (!user) return res.status(404).json({ error: 'User not found' });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_USER_UNBLOCKED',
      resource: 'User',
      resourceId: user._id,
      severity: 'WARN',
    });

    res.json({ message: 'User unblocked', user });
  } catch (err) {
    next(err);
  }
};

exports.listPendingKyc = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {
      role: 'DRIVER',
      kycStatus: 'PENDING',
    };

    const [drivers, total] = await Promise.all([
      User.find(filter)
        .select('name phone email kycStatus kycDocuments faceVerified faceVerificationMeta createdAt')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ total, page, limit, drivers });
  } catch (err) {
    next(err);
  }
};

exports.approveKyc = async (req, res, next) => {
  try {
    const driver = await User.findOneAndUpdate(
      { _id: req.params.driverId, role: 'DRIVER' },
      { $set: { kycStatus: 'APPROVED', kycRejectionReason: null } },
      { new: true }
    ).select('name phone email kycStatus');

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_KYC_APPROVED',
      resource: 'User',
      resourceId: driver._id,
    });

    res.json({ message: 'KYC approved', driver });
  } catch (err) {
    next(err);
  }
};

exports.rejectKyc = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const driver = await User.findOneAndUpdate(
      { _id: req.params.driverId, role: 'DRIVER' },
      { $set: { kycStatus: 'REJECTED', kycRejectionReason: reason } },
      { new: true }
    ).select('name phone email kycStatus kycRejectionReason');

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_KYC_REJECTED',
      resource: 'User',
      resourceId: driver._id,
      meta: { reason },
      severity: 'WARN',
    });

    res.json({ message: 'KYC rejected', driver });
  } catch (err) {
    next(err);
  }
};

exports.listRides = async (req, res, next) => {
  try {
    const { status, driverId } = req.query;
    const { page, limit, skip } = paginate(req.query);

    const filter = {};
    if (status) filter.status = status;
    if (driverId) filter.driverId = driverId;

    const [rides, total] = await Promise.all([
      Ride.find(filter)
        .populate('driverId', 'name phone rating trustScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ride.countDocuments(filter),
    ]);

    res.json({ total, page, limit, rides });
  } catch (err) {
    next(err);
  }
};

exports.getRideLive = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    const [ride, location, activeBookings] = await Promise.all([
      Ride.findById(rideId)
        .populate('driverId', 'name phone rating trustScore')
        .lean(),
      RideLocation.findOne({ rideId }).lean(),
      BookingRequest.find({
        rideId,
        status: { $in: ['ACCEPTED', 'ONGOING'] },
      })
        .populate('passengerId', 'name phone')
        .select('passengerId status seatsBooked passengersCount pickup dropoff')
        .lean(),
    ]);

    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    res.json({
      ride,
      tracking: {
        current: location?.current || null,
        updatedAt: location?.current?.updatedAt || null,
        driverOnline: location?.driverOnline || false,
        driverHeartbeatAt: location?.driverHeartbeatAt || null,
      },
      activeBookings,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRideTrackingHistory = async (req, res, next) => {
  try {
    const location = await RideLocation.findOne({ rideId: req.params.rideId }, 'history current').lean();
    if (!location) return res.status(404).json({ error: 'No tracking data found' });

    res.json({
      totalPoints: location.history?.length || 0,
      current: location.current,
      history: location.history || [],
    });
  } catch (err) {
    next(err);
  }
};

exports.listSafetyAlerts = async (req, res, next) => {
  try {
    const { status = 'OPEN', severity, type } = req.query;
    const { page, limit, skip } = paginate(req.query);

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const [alerts, total] = await Promise.all([
      SafetyEvent.find(filter)
        .populate('reportedBy', 'name phone role')
        .populate('targetUser', 'name phone role')
        .populate('rideId', 'status vehicle schedule')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SafetyEvent.countDocuments(filter),
    ]);

    res.json({ total, page, limit, alerts });
  } catch (err) {
    next(err);
  }
};

exports.resolveSafetyAlert = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    if (!resolution) return res.status(400).json({ error: 'resolution is required' });

    const alert = await SafetyEvent.findByIdAndUpdate(
      req.params.alertId,
      {
        $set: {
          status: 'RESOLVED',
          resolvedBy: req.admin._id,
          resolvedAt: new Date(),
          resolution,
        },
      },
      { new: true }
    );

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_SOS_ALERT_RESOLVED',
      resource: 'SafetyEvent',
      resourceId: alert._id,
      meta: { resolution },
    });

    res.json({ message: 'Alert resolved', alert });
  } catch (err) {
    next(err);
  }
};

exports.listTransactions = async (req, res, next) => {
  try {
    const { type, status, userId } = req.query;
    const { page, limit, skip } = paginate(req.query);

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId', 'name phone role')
        .populate('bookingId', 'totalAmount status paymentStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({ total, page, limit, transactions });
  } catch (err) {
    next(err);
  }
};

exports.processRefund = async (req, res, next) => {
  try {
    const { bookingId, reason } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    const idempotencyKey = req.headers['idempotency-key'] || `admin_refund_${bookingId}`;
    const result = await processAdminRefund({
      bookingId,
      reason: reason || 'Admin initiated refund',
      idempotencyKey,
    });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_PAYMENT_REFUND_PROCESSED',
      resource: 'BookingRequest',
      resourceId: bookingId,
      meta: {
        idempotencyKey,
        policy: result.policy,
        refundAmount: result.refundAmount,
        replayed: result.replayed,
      },
      severity: 'WARN',
    });

    res.json({
      message: result.replayed ? 'Idempotent replay' : 'Refund processed',
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getConfig = async (_req, res, next) => {
  try {
    const config = await getPlatformConfig();
    res.json({ config });
  } catch (err) {
    next(err);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const updates = {
      pricing: req.body.pricing,
      penalties: req.body.penalties,
    };

    const config = await updatePlatformConfig({
      updates,
      updatedBy: req.admin._id,
    });

    audit({
      req,
      user: req.admin,
      action: 'ADMIN_CONFIG_UPDATED',
      resource: 'PlatformConfig',
      meta: updates,
      severity: 'WARN',
    });

    res.json({ message: 'Platform config updated', config });
  } catch (err) {
    next(err);
  }
};

exports.getAnalyticsOverview = async (req, res, next) => {
  try {
    const { from, to } = toDateRange(req.query);
    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [
      totalRides,
      activeRides,
      totalUsers,
      activeUsers,
      platformFeeAgg,
      openSosAlerts,
    ] = await Promise.all([
      Ride.countDocuments(dateFilter),
      Ride.countDocuments({ status: { $in: ['BOOKING_OPEN', 'FULL', 'STARTED'] } }),
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({
        deletedAt: null,
        updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            type: 'PLATFORM_FEE',
            status: 'SUCCESS',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      SafetyEvent.countDocuments({ status: 'OPEN' }),
    ]);

    res.json({
      period: { from, to },
      rides: {
        totalRides,
        activeRides,
      },
      users: {
        totalUsers,
        activeUsers30d: activeUsers,
      },
      revenue: {
        platformFee: platformFeeAgg[0]?.total || 0,
      },
      safety: {
        openAlerts: openSosAlerts,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdminLogs = async (req, res, next) => {
  try {
    const { action, severity } = req.query;
    const { from, to } = toDateRange(req.query);
    const { page, limit, skip } = paginate(req.query);

    const filter = {
      createdAt: { $gte: from, $lte: to },
      'actor.role': { $in: ADMIN_ROLES },
    };

    if (action) filter.action = action;
    if (severity) filter.severity = severity;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ total, page, limit, logs });
  } catch (err) {
    next(err);
  }
};
