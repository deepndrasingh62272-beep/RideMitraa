const jwt = require('jsonwebtoken');

const getAdminSecret = () => process.env.ADMIN_JWT_SECRET || 'admin-dev-secret-change-me';

const generateAdminToken = (payload) =>
  jwt.sign(payload, getAdminSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  });

const verifyAdminToken = (token) => jwt.verify(token, getAdminSecret());

module.exports = {
  generateAdminToken,
  verifyAdminToken,
};
