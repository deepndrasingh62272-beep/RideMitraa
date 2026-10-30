const Notification = require('../models/Notification');

/**
 * Persist a notification to DB and push it to the user's socket room.
 *
 * @param {Object} opts
 * @param {string|ObjectId} opts.userId   - recipient
 * @param {string}          opts.type     - NOTIFICATION_TYPES value
 * @param {string}          opts.title
 * @param {string}          opts.body
 * @param {Object}          [opts.data]   - arbitrary extra payload
 */
const notify = async ({ userId, type, title, body, data = {} }) => {
  // 1. Persist
  const notification = await Notification.create({ userId, type, title, body, data });

  // 2. Real-time push — user room is `user:<userId>`
  try {
    const { getIO } = require('../config/socket');
    getIO().to(`user:${userId}`).emit('notification', notification);
  } catch {
    // Socket not initialised in test env — silently skip
  }

  return notification;
};

module.exports = { notify };
