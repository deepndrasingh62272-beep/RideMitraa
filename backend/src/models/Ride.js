const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },       // human-readable place name
    address: { type: String },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['CAR', 'SEDAN', 'SUV', 'HATCHBACK', 'BIKE', 'AUTO', 'VAN'],
      required: true,
    },
    name: { type: String, required: true },         // e.g. "Honda City"
    registrationNumber: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/,    // Indian vehicle reg format (e.g. DL01AB1234)
    },
    seatingCapacity: { type: Number, required: true }, // total seats incl. driver
    helmetRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const lineStringSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: { type: [[Number]] }, // [[lng, lat], ...]
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickup: { type: locationSchema, required: true },
    dropoff: { type: locationSchema, required: true },

    distanceKm: { type: Number, required: true, min: 0 },  // calculated server-side

    vehicle: { type: vehicleSchema, required: true },
    vehicleType: {
      type: String,
      enum: ['CAR', 'BIKE'],
      default: 'CAR',
    },
    totalSeats:     { type: Number, required: true, min: 1, max: 9 }, // full vehicle capacity
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (v) {
          // Passenger seats (excluding driver) must not exceed totalSeats - 1
          if (this.totalSeats == null) return true;
          return v <= Math.max(0, this.totalSeats - 1);
        },
        message: 'availableSeats cannot exceed totalSeats - 1',
      },
    },
    maxPassengers:  { type: Number, required: true, min: 1 },         // hard cap for this vehicle type

    farePerSeat: { type: Number, required: true, min: 0 }, // in INR

    // New pricing fields (backward-compatible; farePerSeat remains the canonical legacy field)
    pricePerSeat: { type: Number, default: null, min: 0 },
    pricingBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },

    // Stored route metadata for matching + UI
    etaMinutes: { type: Number, default: null, min: 0 },
    routePolyline: { type: String, default: null },
    routeLine: { type: lineStringSchema, default: null },

    schedule: {
      date: { type: String, required: true },  // YYYY-MM-DD
      time: { type: String, required: true },  // HH:MM (24h)
      departureAt: { type: Date, required: true }, // combined, indexed
    },

    status: {
      type: String,
      enum: ['CREATED', 'BOOKING_OPEN', 'FULL', 'STARTED', 'COMPLETED', 'CANCELLED'],
      default: 'BOOKING_OPEN',
    },

    // Lifecycle timestamps
    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // OTP for boarding verification — generated on first booking acceptance, shared across all passengers
    otpCode: { type: String, default: null },

    // Tracks which accepted passengers have physically boarded
    boardedPassengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Ride preferences and rider flexibility
    genderPreference: {
      type: String,
      enum: ['ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'OTHER_ONLY'],
      default: 'ANY',
    },
    pickupRadius: { type: Number, default: 300, min: 300, max: 500 },

    // Seat locking for overbooking prevention
    lockedSeats:    { type: Number, default: 0, min: 0 },
    seatLockExpiry: { type: Date, default: null },

    // Tracks which booking holds the current lock
    seatLockBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest', default: null },

    // Autocomplete search support
    pickupText: { type: String },   // lowercased for text search
    dropoffText: { type: String },

    // Advanced features
    isScheduled:     { type: Boolean, default: false },
    scheduledTime:   { type: Date, default: null },
    isCarpool:       { type: Boolean, default: false },
    carpoolGroupId:  { type: String, default: null },
    surgeMultiplier: { type: Number, default: 1.0, min: 1.0 },
  },
  { timestamps: true }
);

// Keep legacy + new pricing fields in sync for backward compatibility.
rideSchema.pre('validate', function (next) {
  if (this.pricePerSeat == null && this.farePerSeat != null) {
    this.pricePerSeat = this.farePerSeat;
  }
  if (this.farePerSeat == null && this.pricePerSeat != null) {
    this.farePerSeat = this.pricePerSeat;
  }

  const rawType = String(this.vehicleType || this.vehicle?.type || '').toUpperCase();
  this.vehicleType = rawType === 'BIKE' ? 'BIKE' : 'CAR';

  if (this.vehicle) {
    if (this.vehicleType === 'BIKE') {
      this.vehicle.helmetRequired = true;
      if (this.maxPassengers == null || this.maxPassengers > 1) this.maxPassengers = 1;
    } else if (this.vehicle.helmetRequired == null) {
      this.vehicle.helmetRequired = false;
    }
  }

  next();
});

// Geospatial index for proximity search
rideSchema.index({ 'pickup.coordinates': '2dsphere' });
rideSchema.index({ 'dropoff.coordinates': '2dsphere' });

// Geospatial index for route overlap matching
rideSchema.index({ routeLine: '2dsphere' });

// Text index for autocomplete on location names
rideSchema.index({ pickupText: 'text', dropoffText: 'text' });

// Compound index for common search pattern
rideSchema.index({ 'schedule.departureAt': 1, status: 1, availableSeats: 1 });

module.exports = mongoose.model('Ride', rideSchema);
