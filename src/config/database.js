const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

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