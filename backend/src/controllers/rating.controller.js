const mongoose = require('mongoose');
const Rating        = require('../models/Rating');
const User          = require('../models/User');
const BookingRequest= require('../models/BookingRequest');
const FraudFlag     = require('../models/FraudFlag');
const { audit }     = require('../utils/audit');
const { recalculateTrustScore } = require('../utils/trustScore');
const { notify }    = require('../utils/notify');

const LOW_RATING_THRESHOLD = 2; // score <= this triggers a fraud flag

// ─── POST /api/ratings ────────────────────────────────────────────────────────
// Passenger rates driver OR driver rates passenger after ride completion

exports.submitRating = async (req, res, next) => {
  try {
    const { bookingId, score, comment } = req.body;
    const raterId = req.user._id;

    const booking = await BookingRequest.findById(bookingId)
      .populate('rideId', 'status');

    if (!booking)
      return res.status(404).json({ error: 'Booking not found' });

    if (booking.status !== 'COMPLETED')
      return res.status(400).json({ error: 'Can only rate after ride is completed' });

    const isPassenger = booking.passengerId.toString() === raterId.toString();
    const isDriver    = booking.driverId?.toString()   === raterId.toString();

    if (!isPassenger && !isDriver)
      return res.status(403).json({ error: 'Not involved in this booking' });

    // Who is being rated
    const ratedUserId = isPassenger ? booking.driverId : booking.passengerId;
    const raterRole   = isPassenger ? 'PASSENGER' : 'DRIVER';

    // Create rating — unique index prevents duplicates
    let rating;
    try {
      [rating] = await Rating.create(
        [{ bookingId, rideId: booking.rideId, raterId, ratedUserId, role: raterRole, score, comment: comment ?? null }]
      );
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'You have already rated this booking' });
      }
      throw err;
    }

    // Recalculate average rating for the rated user
    const agg = await Rating.aggregate([
      { $match: { ratedUserId: new mongoose.Types.ObjectId(ratedUserId) } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);

    const newAvg   = agg.length ? parseFloat(agg[0].avg.toFixed(2)) : score;
    const newCount = agg.length ? agg[0].count : 1;

    await User.findByIdAndUpdate(
      ratedUserId,
      { $set: { rating: newAvg, totalRatings: newCount } }
    );

    // Flag low-rated users
    if (score <= LOW_RATING_THRESHOLD) {
      rating.flagged = true;
      await rating.save();

      await FraudFlag.findOneAndUpdate(
        { userId: ratedUserId, flagType: 'LOW_RATING', windowStart: _dayStart() },
        { $inc: { count: 1 }, $set: { meta: { latestScore: score, bookingId } } },
        { upsert: true }
      );
    }

    // Recalculate trust score for the rated user (non-blocking)
    try {
      await recalculateTrustScore(ratedUserId);
    } catch (e) {
      // Don't break the response if trust score recalculation fails
    }

    // Notify the rated user
    try {
      await notify({
        userId: ratedUserId,
        type: 'RATING_RECEIVED',
        title: 'New Rating Received',
        body: 'You received a new rating.',
        data: { bookingId, score },
      });
    } catch (e) {
      // Don't break the response if notification fails
    }

    audit({
      req,
      user:       req.user,
      action:     'RATING_SUBMITTED',
      resource:   'Rating',
      resourceId: rating._id,
      meta:       { bookingId, score, ratedUserId, flagged: rating.flagged },
    });

    res.status(201).json({
      message:    'Rating submitted',
      rating,
      updatedAvg: newAvg,
      totalRatings: newCount,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ratings/user/:id ────────────────────────────────────────────────
// Get a user's rating summary + paginated rating history

exports.getUserRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page   = parseInt(req.query.page  ?? 1);
    const limit  = parseInt(req.query.limit ?? 20);
    const skip   = (page - 1) * limit;

    const user = await User.findById(id).select('name role rating totalRatings').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [ratings, total] = await Promise.all([
      Rating.find({ ratedUserId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('raterId', 'name role')
        .lean(),
      Rating.countDocuments({ ratedUserId: id }),
    ]);

    // Score distribution (1–5)
    const distribution = await Rating.aggregate([
      { $match: { ratedUserId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$score', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      user:         { name: user.name, role: user.role },
      avgRating:    user.rating,
      totalRatings: user.totalRatings,
      distribution: Object.fromEntries(distribution.map((d) => [d._id, d.count])),
      ratings,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _dayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── GET /api/ratings/:id ─────────────────────────────────────────────────────
exports.getRatingById = async (req, res, next) => {
  try {
    const rating = await Rating.findById(req.params.id)
      .populate('raterId', 'name role')
      .populate('ratedUserId', 'name role')
      .lean();
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    res.json({ rating });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/ratings/:id ─────────────────────────────────────────────────────
// Update own rating within 24 hours
exports.updateRating = async (req, res, next) => {
  try {
    const { score, comment } = req.body;
    const rating = await Rating.findById(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });

    if (rating.raterId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Can only update your own rating' });

    const ageMs = Date.now() - new Date(rating.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000)
      return res.status(400).json({ error: 'Ratings can only be updated within 24 hours' });

    if (score !== undefined) rating.score = score;
    if (comment !== undefined) rating.comment = comment;
    await rating.save();

    // Recalculate average
    const agg = await Rating.aggregate([
      { $match: { ratedUserId: rating.ratedUserId } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    if (agg.length) {
      await User.findByIdAndUpdate(rating.ratedUserId, {
        $set: { rating: parseFloat(agg[0].avg.toFixed(2)), totalRatings: agg[0].count },
      });
    }

    res.json({ message: 'Rating updated', rating });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/ratings/:id ──────────────────────────────────────────────────
// Delete own rating within 1 hour, or admin anytime
exports.deleteRating = async (req, res, next) => {
  try {
    const rating = await Rating.findById(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });

    const isOwner = rating.raterId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin)
      return res.status(403).json({ error: 'Access denied' });

    if (isOwner && !isAdmin) {
      const ageMs = Date.now() - new Date(rating.createdAt).getTime();
      if (ageMs > 60 * 60 * 1000)
        return res.status(400).json({ error: 'Ratings can only be deleted within 1 hour' });
    }

    const ratedUserId = rating.ratedUserId;
    await rating.deleteOne();

    // Recalculate average after deletion
    const agg = await Rating.aggregate([
      { $match: { ratedUserId } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    await User.findByIdAndUpdate(ratedUserId, {
      $set: {
        rating: agg.length ? parseFloat(agg[0].avg.toFixed(2)) : 0,
        totalRatings: agg.length ? agg[0].count : 0,
      },
    });

    res.json({ message: 'Rating deleted' });
  } catch (err) {
    next(err);
  }
};
