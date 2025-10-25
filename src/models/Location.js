const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  // Target coordinates
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
  },
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
  // Type of location
  type: {
    type: String,
    enum: ['saved', 'sidequest'],
    required: true
  },
  // Completion radius in meters
  completionRadius: {
    type: Number,
    default: 50,
    min: 5,
    max: 200
  },
  // Is this the current target?
  isActive: {
    type: Boolean,
    default: false
  },
  // Landmark-specific fields (for sidequests)
  hiddenName: {
    type: String,
    trim: true
  },
  hiddenDescription: {
    type: String,
    trim: true
  },
  hiddenCategory: {
    type: String,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  osmId: {
    type: String,
    trim: true
  },
  // Creation timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for location-based queries
locationSchema.index({ location: '2dsphere' });
locationSchema.index({ isActive: 1 });
locationSchema.index({ type: 1 });

// Pre-save middleware to set GeoJSON location
locationSchema.pre('save', function(next) {
  if (this.longitude !== undefined && this.latitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

// Method to check if a location is within completion radius
locationSchema.methods.isWithinCompletionRadius = function(lat, lng) {
  const earthRadius = 6371000; // Earth radius in meters
  const dLat = (lat - this.latitude) * Math.PI / 180;
  const dLng = (lng - this.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = earthRadius * c;
  
  return distance <= this.completionRadius;
};

module.exports = mongoose.model('Location', locationSchema);