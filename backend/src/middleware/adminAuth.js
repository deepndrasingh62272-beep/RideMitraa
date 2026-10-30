const User = require('../models/User');
const { verifyAdminToken } = require('../utils/adminJwt');

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Admin token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);

    const adminUser = await User.findById(decoded.id).select('-__v').lean();
    if (!adminUser) return res.status(401).json({ error: 'Admin user not found' });
    if (adminUser.deletedAt) return res.status(403).json({ error: 'Admin account is blocked' });
    if (!ADMIN_ROLES.includes(adminUser.role)) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    req.admin = adminUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

const requireAdminRoles = (...roles) => (req, res, next) => {
  const allowed = roles.length ? roles : ADMIN_ROLES;
  if (!req.admin || !allowed.includes(req.admin.role)) {
    return res.status(403).json({ error: 'Insufficient admin privileges' });
  }
  next();
};

module.exports = {
  ADMIN_ROLES,
  authenticateAdmin,
  requireAdminRoles,
};
