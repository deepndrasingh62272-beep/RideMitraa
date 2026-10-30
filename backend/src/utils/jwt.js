const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Session = require('../models/Session');

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

/**
 * Creates a session record for token revocation tracking
 */
const createSession = async (userId, token, deviceInfo = '') => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const decoded = verifyToken(token);
  await Session.create({
    userId,
    tokenHash,
    deviceInfo,
    expiresAt: new Date(decoded.exp * 1000),
  });
};

/**
 * Revokes all sessions for a user (logout all devices)
 */
const revokeAllSessions = async (userId) => {
  await Session.updateMany({ userId }, { isRevoked: true });
};

module.exports = { generateToken, verifyToken, createSession, revokeAllSessions };
