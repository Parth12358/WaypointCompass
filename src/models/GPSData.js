const mongoose = require('mongoose');

const gpsDataSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  altitude: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['device', 'manual', 'simulation', 'ble'],
    default: 'device'
  },
  // GeoJSON format for MongoDB geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: false // Will be set by pre-save middleware
    }
  }
});

// Create geospatial index for location-based queries
gpsDataSchema.index({ location: '2dsphere' });
gpsDataSchema.index({ timestamp: -1 });

// Pre-save middleware to set GeoJSON location
gpsDataSchema.pre('save', function(next) {
  if (this.longitude !== undefined && this.latitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

module.exports = mongoose.model('GPSData', gpsDataSchema);