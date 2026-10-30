const mongoose = require('mongoose');

const SafetySchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sosTriggered: {
      type: Boolean,
      default: false,
    },
    sosTriggeredAt: {
      type: Date,
      default: null,
    },
    sosStatus: {
      type: String,
      enum: ['ACTIVE', 'CANCELLED', 'RESOLVED'],
      default: 'ACTIVE',
    },
    liveLocationActive: {
      type: Boolean,
      default: false,
    },
    locationHistory: [
      {
        lat: Number,
        lng: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        accuracy: Number,
      },
    ],
    emergencyContacts: [
      {
        name: String,
        phone: String,
        relationship: String,
        notified: {
          type: Boolean,
          default: false,
        },
        notifiedAt: Date,
      },
    ],
    policeAlerted: {
      type: Boolean,
      default: false,
    },
    policeAlertedAt: Date,
    ambulanceAlerted: {
      type: Boolean,
      default: false,
    },
    ambulanceAlertedAt: Date,
    incidentDescription: String,
    incidentSeverity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    resolvedAt: Date,
    resolutionNotes: String,
  },
  { timestamps: true }
);

// Index for faster queries
SafetySchema.index({ rideId: 1 });
SafetySchema.index({ passengerId: 1 });
SafetySchema.index({ driverId: 1 });
SafetySchema.index({ sosTriggered: 1 });
SafetySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Safety', SafetySchema);
