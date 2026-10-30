const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    bookingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest', required: true },
    rideId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    raterId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who gave the rating
    ratedUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who received it
    role:       { type: String, enum: ['PASSENGER', 'DRIVER'], required: true },       // role of the rater
    score:      { type: Number, required: true, min: 1, max: 5 },
    comment:    { type: String, maxlength: 300, default: null },
    flagged:    { type: Boolean, default: false }, // auto-flagged if score <= LOW_RATING_THRESHOLD
  },
  { timestamps: true }
);

// One rating per rater per booking (no double-rating)
ratingSchema.index({ bookingId: 1, raterId: 1 }, { unique: true });
ratingSchema.index({ ratedUserId: 1 });
ratingSchema.index({ flagged: 1 });

module.exports = mongoose.model('Rating', ratingSchema);
