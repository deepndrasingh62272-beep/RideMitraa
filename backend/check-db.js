/**
 * Check MongoDB connection and ride count
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection - MUST match backend .env
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ridesharing';

async function checkDB() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 URI:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const Ride = require('./src/models/Ride');
    const BookingRequest = require('./src/models/BookingRequest');

    // Count documents
    const rideCount = await Ride.countDocuments();
    const bookingCount = await BookingRequest.countDocuments();
    
    console.log('📊 Database Stats:');
    console.log('  - Total Rides:', rideCount);
    console.log('  - Total Bookings:', bookingCount);
    
    if (rideCount > 0) {
      console.log('\n🚨 RIDES FOUND IN DATABASE!');
      const sample = await Ride.findOne().lean();
      console.log('Sample ride:', {
        id: sample._id,
        pickup: sample.pickup?.name,
        dropoff: sample.dropoff?.name,
        status: sample.status,
        availableSeats: sample.availableSeats,
      });
    } else {
      console.log('\n✅ Database is empty - no rides found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

checkDB();
