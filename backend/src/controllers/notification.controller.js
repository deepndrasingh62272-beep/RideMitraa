const Notification = require('../models/Notification');
const { notify } = require('../utils/notify');

// ─── POST /api/notifications/send ────────────────────────────────────────────
// Admin / internal: manually send a notification to any user

exports.sendNotification = async (req, res, next) => {
  try {
    const { userId, type, title, body, data } = req.body;

    const notification = await notify({ userId, type, title, body, data });

    res.status(201).json({ message: 'Notification sent', notification });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/notifications ──────────────────────────────────────────────────
// Fetch paginated notifications for the authenticated user

exports.getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const page   = parseInt(req.query.page  ?? 1);
    const limit  = parseInt(req.query.limit ?? 20);
    const skip   = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const filter = { userId, ...(unreadOnly ? { read: false } : {}) };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, read: false }),
    ]);

    res.json({ total, unreadCount, page, pages: Math.ceil(total / limit), notifications });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/notifications/:userId ──────────────────────────────────────────
// Fetch paginated notifications for a user (own only, or admin)

exports.getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Users can only fetch their own; admins can fetch any
    if (req.user._id.toString() !== userId && req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied' });

    const page   = parseInt(req.query.page  ?? 1);
    const limit  = parseInt(req.query.limit ?? 20);
    const skip   = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const filter = { userId, ...(unreadOnly ? { read: false } : {}) };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, read: false }),
    ]);

    res.json({ total, unreadCount, page, pages: Math.ceil(total / limit), notifications });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
// Mark a single notification as read

exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    res.json({ message: 'Marked as read', notification });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
// Mark all unread notifications as read for the current user

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ message: 'All notifications marked as read', updated: result.modifiedCount });
  } catch (err) {
    next(err);
  }
};
