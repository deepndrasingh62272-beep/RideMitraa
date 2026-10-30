const mongoose = require('mongoose');

const bookingRequestSchema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driverId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rideId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },

    pickup: {
      name:        { type: String, required: true },
      address:     { type: String },
      coordinates: {
        type:        { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [lng, lat]
      },
    },
    dropoff: {
      name:        { type: String, required: true },
      address:     { type: String },
      coordinates: {
        type:        { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },

    passengersCount: { type: Number, required: true, min: 1, max: 6 },
  seatsBooked: { type: Number, min: 1, max: 6 },

    bookingTime: { type: Date, default: Date.now },
    rideTime:    { type: Date, required: true },

    pricePerSeat:  { type: Number, required: true, min: 0 },
    platformFee:   { type: Number, required: true, min: 0 },
    totalAmount:   { type: Number, required: true, min: 0 },

    status: {
      type:    String,
      enum:    ['PENDING', 'ACCEPTED', 'REJECTED', 'PAYMENT_DONE', 'OTP_VERIFIED', 'ONGOING', 'CANCELLED', 'COMPLETED', 'EXPIRED'],
      default: 'PENDING',
    },

    paymentStatus: {
      type:    String,
      enum:    ['UNPAID', 'ESCROWED', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
    },

    paymentProvider: {
      type: String,
      enum: ['INTERNAL', 'RAZORPAY'],
      default: 'INTERNAL',
    },

    paymentGatewayOrderId: { type: String, default: null },
    paymentGatewayPaymentId: { type: String, default: null },
    escrowHeldAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'WALLET'],
      required: true,
    },

    transactionId: { type: String },

    requestExpiry: { type: Date, required: true }, // auto-expires after 5 min

    // Waiting-time controls after ride start
    waitingStartedAt: { type: Date, default: null },
    freeWaitMinutes: { type: Number, default: 5, min: 0 },
    waitedMinutes: { type: Number, default: 0, min: 0 },
    waitPenaltyApplied: { type: Boolean, default: false },
    waitPenaltyAmount: { type: Number, default: 0, min: 0 },
    waitStatus: {
      type: String,
      enum: ['NONE', 'FREE_WINDOW', 'CHARGEABLE', 'AUTO_CANCELLED'],
      default: 'NONE',
    },

    // Cancellation metadata
    cancelledBy:        { type: String, enum: ['PASSENGER', 'DRIVER', null], default: null },
    cancellationReason: { type: String, default: null },
    penaltyApplied:     { type: Boolean, default: false },
    penaltyAmount:      { type: Number, default: 0 },

    // OTP Verification
    otpCode:            { type: String, default: null },
    otpVerified:        { type: Boolean, default: false },
    otpVerifiedAt:      { type: Date, default: null },
    rideStartedAt:      { type: Date, default: null },
    rideEndedAt:        { type: Date, default: null },
  },
  { timestamps: true }
);

bookingRequestSchema.pre('validate', function syncSeatFields(next) {
  if (this.seatsBooked == null && this.passengersCount != null) {
    this.seatsBooked = this.passengersCount;
  }
  if (this.passengersCount == null && this.seatsBooked != null) {
    this.passengersCount = this.seatsBooked;
  }
  next();
});

// Index for expiry job — find PENDING docs past their requestExpiry
bookingRequestSchema.index({ status: 1, requestExpiry: 1 });

bookingRequestSchema.index({ passengerId: 1, status: 1 });
bookingRequestSchema.index({ driverId: 1, status: 1 });
bookingRequestSchema.index({ rideId: 1 });

module.exports = mongoose.model('BookingRequest', bookingRequestSchema);
