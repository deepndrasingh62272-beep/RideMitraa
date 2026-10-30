const mongoose = require('mongoose');

/**
 * Immutable audit trail for rides, payments, bookings, and auth events.
 * Documents are never updated — only inserted.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role:   { type: String },
      ip:     { type: String },
    },
    action:     { type: String, required: true }, // e.g. 'BOOKING_CREATED', 'PAYMENT_INITIATED'
    resource:   { type: String, required: true }, // e.g. 'BookingRequest', 'Transaction'
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    meta:       { type: mongoose.Schema.Types.Mixed }, // extra context (sanitised — no PII)
    severity:   { type: String, enum: ['INFO', 'WARN', 'CRITICAL'], default: 'INFO' },
  },
  {
    timestamps: true,
    // Prevent accidental updates to audit records
    strict: true,
  }
);

// TTL: retain logs for 2 years (GDPR / Indian IT Act compliance)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });
auditLogSchema.index({ 'actor.userId': 1, action: 1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
