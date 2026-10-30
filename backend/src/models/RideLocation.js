const mongoose = require('mongoose');

/**
 * Stores the live + historical location trail for a ride.
 * One document per rideId — route history is an array of breadcrumbs.
 */
const rideLocationSchema = new mongoose.Schema(
  {
    rideId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Ride',
      required: true,
      unique:   true,
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Latest known position
    current: {
      coordinates: { type: [Number], required: true }, // [lng, lat]
      heading:     { type: Number },                   // degrees 0-360
      speedKmh:    { type: Number },
      updatedAt:   { type: Date, default: Date.now },
    },

    // Full route trail for safety / replay
    history: [
      {
        coordinates: { type: [Number], required: true },
        heading:     { type: Number },
        speedKmh:    { type: Number },
        recordedAt:  { type: Date, default: Date.now },
        _id:         false,
      },
    ],

    // Passengers already notified with DRIVER_NEARBY for this ride (at-most-once guard)
    notifiedPassengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Driver heartbeat for offline detection in realtime channels
    driverHeartbeatAt: { type: Date, default: Date.now },
    driverOnline: { type: Boolean, default: true },
    driverOfflineAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rideLocationSchema.index({ rideId: 1 });
rideLocationSchema.index({ driverId: 1 });
rideLocationSchema.index({ driverOnline: 1, driverHeartbeatAt: 1 });

module.exports = mongoose.model('RideLocation', rideLocationSchema);
