const mongoose = require('mongoose');

const sidequestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  // Target location for the sidequest
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
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
  // Completion radius in meters
  completionRadius: {
    type: Number,
    default: 50,
    min: 5,
    max: 1000
  },
  // Difficulty level
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  // Rewards/points for completion
  points: {
    type: Number,
    default: 100,
    min: 0
  },
  // Quest type/category
  category: {
    type: String,
    enum: ['exploration', 'photography', 'trivia', 'challenge', 'discovery'],
    default: 'exploration'
  },
  // Prerequisites or requirements
  requirements: [{
    type: String,
    trim: true
  }],
  // Hints for the quest
  hints: [{
    text: String,
    unlockDistance: Number // Distance in meters when hint becomes available
  }],
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Creation info
  createdBy: {
    type: String,
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for location-based queries
sidequestSchema.index({ location: '2dsphere' });
sidequestSchema.index({ isActive: 1 });
sidequestSchema.index({ category: 1 });
sidequestSchema.index({ difficulty: 1 });

// Pre-save middleware to set GeoJSON location and update timestamp
sidequestSchema.pre('save', function(next) {
  if (this.longitude !== undefined && this.latitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  this.updatedAt = Date.now();
  next();
});

// Method to check if a location is within completion radius
sidequestSchema.methods.isWithinCompletionRadius = function(lat, lng) {
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

module.exports = mongoose.model('Sidequest', sidequestSchema);