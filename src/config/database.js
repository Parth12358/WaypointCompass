const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Railway provides MONGODB_URL environment variable
    // Atlas uses MONGODB_URI
    // Support both for flexibility
    const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/waypointcompass';
    
    const conn = await mongoose.connect(mongoUri);

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);
    
    // Enable geospatial indexing
    console.log('📍 Setting up geospatial indexes...');
    
    // Set up indexes for Location model
    const db = conn.connection.db;
    
    // Create geospatial index for locations
    try {
      await db.collection('locations').createIndex({ "location": "2dsphere" });
      console.log('✅ Geospatial indexes created successfully');
    } catch (indexError) {
      console.log('⚠️  Geospatial index already exists or failed to create:', indexError.message);
    }
    
    console.log('🎯 Database setup completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// Removed signal handlers for testing
// process.on('SIGINT', async () => {
//   await mongoose.connection.close();
//   console.log('🔒 MongoDB connection closed through app termination');
//   process.exit(0);
// });

module.exports = connectDB;