const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit logger.
 * Never throws — audit failures must not break the main request flow.
 *
 * @param {object} params
 * @param {object} params.req         - Express request (for actor IP)
 * @param {object} [params.user]      - User object (id + role)
 * @param {string} params.action      - e.g. 'BOOKING_CREATED'
 * @param {string} params.resource    - e.g. 'BookingRequest'
 * @param {*}      [params.resourceId]
 * @param {object} [params.meta]      - Extra context (no PII)
 * @param {string} [params.severity]  - INFO | WARN | CRITICAL
 */
const audit = (params) => {
  const { req, user, action, resource, resourceId, meta, severity = 'INFO' } = params;

  AuditLog.create({
    actor: {
      userId: user?._id ?? user?.id,
      role:   user?.role,
      ip:     req?.ip || req?.headers?.['x-forwarded-for'],
    },
    action,
    resource,
    resourceId,
    meta,
    severity,
  }).catch((err) => console.error('[Audit] Failed to write log:', err.message));
};

module.exports = { audit };
