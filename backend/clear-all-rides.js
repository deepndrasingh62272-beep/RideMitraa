/**
 * Script to delete ALL rides from the database
 * Usage: node clear-all-rides.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection - MUST match backend .env
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ridesharing';

async function clearAllRides() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get Ride model
    const Ride = require('./src/models/Ride');
    const BookingRequest = require('./src/models/BookingRequest');

    // Count before deletion
    const rideCount = await Ride.countDocuments();
    const bookingCount = await BookingRequest.countDocuments();
    
    console.log(`📊 Found ${rideCount} rides and ${bookingCount} bookings`);

    if (rideCount === 0 && bookingCount === 0) {
      console.log('ℹ️ Database already empty. Nothing to delete.');
      return;
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will delete ALL rides and bookings!');
    console.log('⏳ Deleting in 3 seconds... (Ctrl+C to cancel)');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all rides
    const rideResult = await Ride.deleteMany({});
    console.log(`🗑️  Deleted ${rideResult.deletedCount} rides`);

    // Delete all bookings (optional - keeps data clean)
    const bookingResult = await BookingRequest.deleteMany({});
    console.log(`🗑️  Deleted ${bookingResult.deletedCount} bookings`);

    console.log('\n✅ All rides cleared successfully!');
    console.log('🔄 Frontend will now show no rides.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
clearAllRides();
