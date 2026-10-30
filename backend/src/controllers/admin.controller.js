const User         = require('../models/User');
const Ride         = require('../models/Ride');
const BookingRequest = require('../models/BookingRequest');
const Transaction  = require('../models/Transaction');
const SafetyEvent  = require('../models/SafetyEvent');
const FraudFlag    = require('../models/FraudFlag');
const { audit }    = require('../utils/audit');

// ─── Shared pagination helper ─────────────────────────────────────────────────

const paginate = (query = {}) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  return { skip: (page - 1) * limit, limit, page };
};

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Query params: role, kycStatus, page, limit, search (name/phone)
 */
exports.listUsers = async (req, res, next) => {
  try {
    const { role, kycStatus, search } = req.query;
    const { skip, limit, page } = paginate(req.query);

    const filter = {};
    if (role)      filter.role      = role;
    if (kycStatus) filter.kycStatus = kycStatus;
    if (search)    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('userId name phone email role kycStatus faceVerified rating createdAt deletedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ total, page, limit, users });
  } catch (err) { next(err); }
};

/**
 * GET /admin/users/:id
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-__v')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

/**
 * PATCH /admin/users/:id/ban
 * Soft-ban: marks deletedAt so the user can't log in (auth middleware can check this).
 */
exports.banUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date(), banReason: reason },
      { new: true }
    ).select('name phone role deletedAt');

    if (!user) return res.status(404).json({ error: 'User not found' });

    audit({
      req, user: req.user,
      action: 'ADMIN_USER_BANNED', resource: 'User',
      resourceId: user._id, meta: { reason }, severity: 'CRITICAL',
    });

    res.json({ message: 'User banned', user });
  } catch (err) { next(err); }
};

// ─── Rides ────────────────────────────────────────────────────────────────────

/**
 * GET /admin/rides
 * Query params: status, driverId, page, limit
 */
exports.listRides = async (req, res, next) => {
  try {
    const { status, driverId } = req.query;
    const { skip, limit, page } = paginate(req.query);

    const filter = {};
    if (status)   filter.status   = status;
    if (driverId) filter.driverId = driverId;

    const [rides, total] = await Promise.all([
      Ride.find(filter)
        .populate('driverId', 'name phone rating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ride.countDocuments(filter),
    ]);

    res.json({ total, page, limit, rides });
  } catch (err) { next(err); }
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

/**
 * GET /admin/bookings
 * Query params: status, paymentStatus, passengerId, driverId, page, limit
 */
exports.listBookings = async (req, res, next) => {
  try {
    const { status, paymentStatus, passengerId, driverId } = req.query;
    const { skip, limit, page } = paginate(req.query);

    const filter = {};
    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (passengerId)   filter.passengerId   = passengerId;
    if (driverId)      filter.driverId      = driverId;

    const [bookings, total] = await Promise.all([
      BookingRequest.find(filter)
        .populate('passengerId', 'name phone')
        .populate('driverId',    'name phone')
        .populate('rideId',      'vehicle schedule distanceKm')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BookingRequest.countDocuments(filter),
    ]);

    res.json({ total, page, limit, bookings });
  } catch (err) { next(err); }
};

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * GET /admin/payments
 * Query params: type, status, userId, page, limit
 */
exports.listPayments = async (req, res, next) => {
  try {
    const { type, status, userId } = req.query;
    const { skip, limit, page } = paginate(req.query);

    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId',    'name phone role')
        .populate('bookingId', 'totalAmount status paymentMethod')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({ total, page, limit, transactions });
  } catch (err) { next(err); }
};

/**
 * GET /admin/payments/refunds
 * Lists all REFUND transactions — quick view for dispute monitoring.
 */
exports.listRefunds = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);

    const [refunds, total] = await Promise.all([
      Transaction.find({ type: 'REFUND' })
        .populate('userId',    'name phone')
        .populate('bookingId', 'totalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ type: 'REFUND' }),
    ]);

    res.json({ total, page, limit, refunds });
  } catch (err) { next(err); }
};

// ─── KYC ─────────────────────────────────────────────────────────────────────

/**
 * GET /admin/kyc/pending
 * Lists drivers with kycStatus PENDING, sorted oldest first.
 */
exports.listPendingKYC = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);

    const [drivers, total] = await Promise.all([
      User.find({ role: 'DRIVER', kycStatus: 'PENDING' })
        .select('userId name phone kycDocuments kycStatus faceVerified faceVerificationMeta createdAt')
        .sort({ createdAt: 1 }) // oldest first — FIFO review queue
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ role: 'DRIVER', kycStatus: 'PENDING' }),
    ]);

    res.json({ total, page, limit, drivers });
  } catch (err) { next(err); }
};

/**
 * POST /admin/kyc/:driverId/approve
 */
exports.approveKYC = async (req, res, next) => {
  try {
    const driver = await User.findOneAndUpdate(
      { _id: req.params.driverId, role: 'DRIVER' },
      { kycStatus: 'APPROVED', kycRejectionReason: null },
      { new: true }
    ).select('name phone kycStatus');

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    audit({
      req, user: req.user,
      action: 'KYC_APPROVED', resource: 'User',
      resourceId: driver._id, severity: 'INFO',
    });

    res.json({ message: 'KYC approved', driver });
  } catch (err) { next(err); }
};

/**
 * POST /admin/kyc/:driverId/reject
 * Body: { reason }
 */
exports.rejectKYC = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

    const driver = await User.findOneAndUpdate(
      { _id: req.params.driverId, role: 'DRIVER' },
      { kycStatus: 'REJECTED', kycRejectionReason: reason },
      { new: true }
    ).select('name phone kycStatus kycRejectionReason');

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    audit({
      req, user: req.user,
      action: 'KYC_REJECTED', resource: 'User',
      resourceId: driver._id, meta: { reason }, severity: 'WARN',
    });

    res.json({ message: 'KYC rejected', driver });
  } catch (err) { next(err); }
};

// ─── Safety Alerts ────────────────────────────────────────────────────────────

/**
 * GET /admin/alerts
 * Query params: type, status, severity, page, limit
 * Defaults to OPEN events, sorted by severity then recency.
 */
exports.listAlerts = async (req, res, next) => {
  try {
    const { type, severity } = req.query;
    const status = req.query.status || 'OPEN';
    const { skip, limit, page } = paginate(req.query);

    const filter = { status };
    if (type)     filter.type     = type;
    if (severity) filter.severity = severity;

    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

    const [alerts, total] = await Promise.all([
      SafetyEvent.find(filter)
        .populate('reportedBy', 'name phone role')
        .populate('targetUser', 'name phone role')
        .populate('rideId',     'vehicle schedule pickup dropoff')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SafetyEvent.countDocuments(filter),
    ]);

    // Sort CRITICAL/HIGH to top within the page
    alerts.sort((a, b) =>
      (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );

    res.json({ total, page, limit, alerts });
  } catch (err) { next(err); }
};

/**
 * PATCH /admin/alerts/:id/resolve
 * Body: { resolution }
 */
exports.resolveAlert = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    if (!resolution) return res.status(400).json({ error: 'resolution text is required' });

    const alert = await SafetyEvent.findByIdAndUpdate(
      req.params.id,
      {
        status:      'RESOLVED',
        resolvedBy:  req.user._id,
        resolvedAt:  new Date(),
        resolution,
      },
      { new: true }
    );

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    audit({
      req, user: req.user,
      action: 'ALERT_RESOLVED', resource: 'SafetyEvent',
      resourceId: alert._id, meta: { resolution }, severity: 'INFO',
    });

    res.json({ message: 'Alert resolved', alert });
  } catch (err) { next(err); }
};

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /admin/analytics
 * Returns platform-wide KPIs.
 * Query params: from, to (ISO date strings, default last 30 days)
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const to   = req.query.to   ? new Date(req.query.to)   : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to - 30 * 24 * 60 * 60 * 1000);

    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [
      totalRides,
      completedRides,
      cancelledRides,
      totalBookings,
      cancelledBookings,
      totalRevenue,
      totalRefunds,
      newUsers,
      pendingKYC,
      openAlerts,
      driverRatingAgg,
    ] = await Promise.all([
      Ride.countDocuments(dateFilter),
      Ride.countDocuments({ ...dateFilter, status: 'COMPLETED' }),
      Ride.countDocuments({ ...dateFilter, status: 'CANCELLED' }),
      BookingRequest.countDocuments(dateFilter),
      BookingRequest.countDocuments({ ...dateFilter, status: 'CANCELLED' }),
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'CHARGE',  status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'REFUND', status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.countDocuments(dateFilter),
      User.countDocuments({ role: 'DRIVER', kycStatus: 'PENDING' }),
      SafetyEvent.countDocuments({ status: 'OPEN' }),
      User.aggregate([
        { $match: { role: 'DRIVER', totalRatings: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    const rideCompletionRate = totalRides > 0
      ? parseFloat(((completedRides / totalRides) * 100).toFixed(1))
      : 0;

    const bookingCancellationRate = totalBookings > 0
      ? parseFloat(((cancelledBookings / totalBookings) * 100).toFixed(1))
      : 0;

    res.json({
      period: { from, to },
      rides: {
        total:          totalRides,
        completed:      completedRides,
        cancelled:      cancelledRides,
        completionRate: `${rideCompletionRate}%`,
      },
      bookings: {
        total:            totalBookings,
        cancelled:        cancelledBookings,
        cancellationRate: `${bookingCancellationRate}%`,
      },
      payments: {
        totalRevenue: totalRevenue[0]?.total ?? 0,
        totalRefunds: totalRefunds[0]?.total ?? 0,
      },
      users: {
        newSignups: newUsers,
        pendingKYC,
      },
      safety: {
        openAlerts,
      },
      drivers: {
        averageRating: parseFloat((driverRatingAgg[0]?.avgRating ?? 0).toFixed(2)),
        ratedDrivers:  driverRatingAgg[0]?.count ?? 0,
      },
    });
  } catch (err) { next(err); }
};

/**
 * DELETE /admin/rides/clear-all
 * Delete all rides and associated bookings (admin only)
 */
exports.clearAllRides = async (req, res, next) => {
  try {
    const Ride = require('../models/Ride');
    const BookingRequest = require('../models/BookingRequest');

    // Count before deletion
    const rideCount = await Ride.countDocuments();
    const bookingCount = await BookingRequest.countDocuments();

    // Delete all bookings first (to avoid orphaned records)
    const bookingResult = await BookingRequest.deleteMany({});
    
    // Delete all rides
    const rideResult = await Ride.deleteMany({});

    res.json({
      success: true,
      message: 'All rides and bookings cleared successfully',
      deleted: {
        rides: rideResult.deletedCount,
        bookings: bookingResult.deletedCount,
      },
      previousCount: {
        rides: rideCount,
        bookings: bookingCount,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /admin/analytics/fraud
 * Fraud flag breakdown by type.
 */
exports.getFraudAnalytics = async (req, res, next) => {
  try {
    const breakdown = await FraudFlag.aggregate([
      { $group: { _id: '$flagType', count: { $sum: '$count' }, unresolved: {
        $sum: { $cond: [{ $eq: ['$resolved', false] }, 1, 0] }
      }}},
      { $sort: { count: -1 } },
    ]);

    res.json({ breakdown });
  } catch (err) { next(err); }
};
