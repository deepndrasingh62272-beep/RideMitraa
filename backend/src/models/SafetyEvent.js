const mongoose = require('mongoose');

/**
 * Unified safety event log — SOS triggers, flags, and route deviations.
 * One document per event; multiple events can exist per ride.
 */
const safetyEventSchema = new mongoose.Schema(
  {
    rideId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    reportedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    targetUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // who is being flagged

    type: {
      type: String,
      enum: [
        'SOS',               // panic button
        'FLAG_DRIVER',       // passenger flags driver
        'FLAG_PASSENGER',    // driver flags passenger
        'ROUTE_DEVIATION',   // server-detected deviation
        'SUSPICIOUS_CANCEL', // repeated cancellations
      ],
      required: true,
    },

    // Snapshot of location at time of event
    location: {
      coordinates: { type: [Number] }, // [lng, lat]
      address:     { type: String },
    },

    description: { type: String, maxlength: 500 },

    // For FLAG events
    reason: {
      type: String,
      enum: [
        'RASH_DRIVING', 'WRONG_ROUTE', 'HARASSMENT',
        'NO_SHOW', 'INAPPROPRIATE_BEHAVIOR', 'FRAUD', 'OTHER',
      ],
    },

    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },

    status: {
      type:    String,
      enum:    ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN',
    },

    // Admin resolution notes
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:  { type: Date },
    resolution:  { type: String },

    // Contacts notified during SOS
    notifiedContacts: [{ name: String, phone: String }],
  },
  { timestamps: true }
);

safetyEventSchema.index({ rideId: 1, type: 1 });
safetyEventSchema.index({ reportedBy: 1 });
safetyEventSchema.index({ targetUser: 1 });
safetyEventSchema.index({ status: 1, type: 1 });

module.exports = mongoose.model('SafetyEvent', safetyEventSchema);
