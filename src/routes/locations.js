const express = require('express');
const { query, body, validationResult } = require('express-validator');
const Location = require('../models/Location');
const GPSData = require('../models/GPSData');
const asyncHandler = require('../utils/asyncHandler');
const LandmarkService = require('../services/landmarkService');
const SafetyService = require('../services/safetyService');

const router = express.Router();
const landmarkService = new LandmarkService();
const safetyService = new SafetyService();

// GET /api/target - Get current target location (what compass points to)
router.get('/target', asyncHandler(async (req, res) => {
  try {
    // Find the currently active target
    const activeTarget = await Location.findOne({ isActive: true })
      .select('name latitude longitude type completionRadius -_id');

    if (!activeTarget) {
      return res.json({
        success: true,
        data: null,
        message: 'No active target set. Choose a saved location or start a sidequest.'
      });
    }

    // For sidequests, don't reveal the name until completion
    const response = {
      latitude: activeTarget.latitude,
      longitude: activeTarget.longitude,
      type: activeTarget.type,
      completionRadius: activeTarget.completionRadius
    };

    // Only include name for saved locations, keep sidequests mysterious
    if (activeTarget.type === 'saved') {
      response.name = activeTarget.name;
    } else {
      response.name = 'Mystery Location';
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current target'
    });
  }
}));

// GET /api/locations - Get all saved locations for user menu
router.get('/locations', asyncHandler(async (req, res) => {
  try {
    const savedLocations = await Location.find({ type: 'saved' })
      .select('name latitude longitude completionRadius createdAt -_id')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: savedLocations.map(loc => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        completionRadius: loc.completionRadius,
        createdAt: loc.createdAt
      })),
      meta: {
        totalSaved: savedLocations.length
      }
    });

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved locations'
    });
  }
}));

// POST /api/locations - Save a new location ("Save my car here")
router.post('/locations', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('completionRadius')
    .optional()
    .isInt({ min: 5, max: 200 })
    .withMessage('Completion radius must be between 5 and 200 meters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array()
    });
  }

  try {
    // Check if location name already exists
    const existingLocation = await Location.findOne({ 
      name: req.body.name, 
      type: 'saved' 
    });

    if (existingLocation) {
      return res.status(400).json({
        success: false,
        error: 'A location with this name already exists'
      });
    }

    const locationData = {
      name: req.body.name,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      type: 'saved',
      completionRadius: req.body.completionRadius || 50
    };

    const location = new Location(locationData);
    await location.save();

    res.status(201).json({
      success: true,
      message: `Location "${location.name}" saved successfully`,
      data: {
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        type: location.type,
        completionRadius: location.completionRadius
      }
    });

  } catch (error) {
    console.error('Save location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save location'
    });
  }
}));

// POST /api/target/set - Set a saved location as the current target
router.post('/target/set', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Location name is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array()
    });
  }

  try {
    // Clear any existing active targets
    await Location.updateMany({}, { isActive: false });

    // Set the new target as active
    const target = await Location.findOneAndUpdate(
      { name: req.body.name, type: 'saved' },
      { isActive: true },
      { new: true }
    );

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Saved location not found'
      });
    }

    res.json({
      success: true,
      message: `Now pointing to ${target.name}`,
      data: {
        name: target.name,
        latitude: target.latitude,
        longitude: target.longitude,
        type: target.type
      }
    });

  } catch (error) {
    console.error('Set target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set target'
    });
  }
}));

// POST /api/sidequest/start - Start a mystery adventure (user gets no info about destination)
router.post('/sidequest/start', [
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
], asyncHandler(async (req, res) => {
  try {
    let { lat, lng } = req.query;

    // If no coordinates provided, use latest GPS data
    if (!lat || !lng) {
      const latestGPS = await GPSData.findOne().sort({ timestamp: -1 });
      if (!latestGPS) {
        lat = parseFloat(process.env.DEFAULT_LATITUDE) || 37.7749;
        lng = parseFloat(process.env.DEFAULT_LONGITUDE) || -122.4194;
      } else {
        lat = latestGPS.latitude;
        lng = latestGPS.longitude;
      }
    } else {
      lat = parseFloat(lat);
      lng = parseFloat(lng);
    }

    // Clear any existing active targets (including other sidequests)
    await Location.updateMany({}, { isActive: false });
    
    // Delete any old sidequest locations to keep database clean
    await Location.deleteMany({ type: 'sidequest' });

    // Discover real landmarks using OpenStreetMap
    console.log(`Discovering landmarks near ${lat}, ${lng}`);
    const landmark = await landmarkService.getRandomSidequest(lat, lng, 800);
    
    let selectedLandmark = landmark;
    let safetyWarnings = [];
    
    // Safety check for discovered landmark
    if (landmark) {
      try {
        console.log(`Safety checking landmark: ${landmark.name} at ${landmark.latitude}, ${landmark.longitude}`);
        const safetyCheck = await safetyService.analyzeSafetyAtLocation(
          landmark.latitude, 
          landmark.longitude, 
          'sidequest_destination'
        );
        
        // If landmark is too dangerous (risk score > 3.5), find an alternative
        if (safetyCheck.riskScore > 3.5) {
          console.log(`Landmark ${landmark.name} deemed too dangerous (risk: ${safetyCheck.riskScore}), finding alternative`);
          
          // Try to get alternative landmarks
          const alternativeLandmarks = await landmarkService.discoverLandmarks(lat, lng, 1200);
          const safeLandmarks = [];
          
          for (const altLandmark of alternativeLandmarks) {
            const altSafety = await safetyService.analyzeSafetyAtLocation(
              altLandmark.latitude, 
              altLandmark.longitude, 
              'alternative_check'
            );
            if (altSafety.riskScore <= 3.0) {
              safeLandmarks.push(altLandmark);
            }
          }
          
          if (safeLandmarks.length > 0) {
            selectedLandmark = safeLandmarks[Math.floor(Math.random() * safeLandmarks.length)];
            console.log(`Using safer alternative: ${selectedLandmark.name} (risk: ${altSafety.riskScore})`);
          } else {
            // No safe alternatives, use original but add strong warnings
            safetyWarnings.push({
              type: 'high_risk_destination',
              severity: 'warning',
              message: '⚠️ This mystery location may require extra caution'
            });
          }
        } else if (safetyCheck.riskScore > 2.0) {
          // Moderate risk - add caution warning
          safetyWarnings.push({
            type: 'moderate_risk',
            severity: 'caution', 
            message: '🚨 Exercise caution when approaching this location'
          });
        }
        
        // Add time-based warnings if applicable
        if (safetyCheck.timeRisk && safetyCheck.timeRisk.riskLevel > 1) {
          safetyWarnings.push({
            type: 'time_warning',
            severity: 'info',
            message: `🌙 ${safetyCheck.timeRisk.factors.join(', ')} - extra caution advised`
          });
        }
        
      } catch (safetyError) {
        console.error('Safety check failed for landmark:', safetyError.message);
        // Add generic warning if safety check fails
        safetyWarnings.push({
          type: 'safety_check_failed',
          severity: 'info',
          message: '⚠️ Safety information unavailable - proceed with normal caution'
        });
      }
    }
    
    if (!selectedLandmark) {
      // Fallback to random location if no landmarks found
      const mysteryPlaces = ['Hidden Spot', 'Secret Location', 'Mystery Destination'];
      const mysteryName = mysteryPlaces[Math.floor(Math.random() * mysteryPlaces.length)];
      
      const radiusKm = 0.005 + Math.random() * 0.003;
      const angle = Math.random() * 2 * Math.PI;
      
      const mysteryLat = lat + radiusKm * Math.cos(angle);
      const mysteryLng = lng + radiusKm * Math.sin(angle);

      const sidequestLocation = new Location({
        name: mysteryName,
        latitude: mysteryLat,
        longitude: mysteryLng,
        type: 'sidequest',
        completionRadius: 50,
        isActive: true
      });
      await sidequestLocation.save();
      
      console.log('No landmarks found, created random mystery location');
    } else {
      // Create sidequest from discovered (and safety-checked) landmark
      const sidequestLocation = new Location({
        name: 'Mystery Location', // Keep name secret until completion
        latitude: selectedLandmark.latitude,
        longitude: selectedLandmark.longitude,
        type: 'sidequest',
        completionRadius: selectedLandmark.completionRadius,
        isActive: true,
        // Store the real landmark info for reveal on completion
        hiddenName: selectedLandmark.name,
        hiddenDescription: selectedLandmark.description,
        hiddenCategory: selectedLandmark.category,
        difficulty: selectedLandmark.difficulty,
        osmId: selectedLandmark.id
      });
      await sidequestLocation.save();
      
      console.log(`Created sidequest for landmark: ${selectedLandmark.name} (${selectedLandmark.distance}m away)`);
    }

    res.json({
      success: true,
      message: 'Mystery adventure started! Follow the compass to discover what awaits...',
      data: {
        type: 'sidequest',
        message: 'Destination unknown - follow your compass!',
        estimatedDistance: '300-800 meters away',
        safetyWarnings: safetyWarnings.length > 0 ? safetyWarnings : undefined,
        safetyMessage: safetyWarnings.length > 0 
          ? 'Safety notices for your adventure - please review before proceeding'
          : 'Have a safe adventure!'
      }
    });

  } catch (error) {
    console.error('Start sidequest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start mystery adventure'
    });
  }
}));

// POST /api/target/reached - Mark current target as reached and get congratulations
router.post('/target/reached', [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array()
    });
  }

  try {
    const { latitude, longitude } = req.body;

    const activeTarget = await Location.findOne({ isActive: true });
    if (!activeTarget) {
      return res.status(404).json({
        success: false,
        error: 'No active target found. Set a target first.'
      });
    }

    // Check if user is close enough
    const isWithinRadius = activeTarget.isWithinCompletionRadius(latitude, longitude);
    if (!isWithinRadius) {
      const distance = calculateDistance(latitude, longitude, activeTarget.latitude, activeTarget.longitude);
      return res.status(400).json({
        success: false,
        error: 'Not close enough yet',
        data: {
          requiredRadius: activeTarget.completionRadius,
          currentDistance: Math.round(distance),
          message: `Get within ${activeTarget.completionRadius}m to complete`
        }
      });
    }

    // Success! User reached the target
    const targetType = activeTarget.type;
    let targetName = activeTarget.name;
    let revelationData = {};

    // Mark as reached and deactivate
    activeTarget.isActive = false;
    await activeTarget.save();

    // Generate appropriate congratulations message
    let congratsMessage;
    if (targetType === 'saved') {
      congratsMessage = `Congratulations! You reached ${targetName}!`;
    } else {
      // Reveal the mystery landmark!
      const realName = activeTarget.hiddenName || targetName;
      const description = activeTarget.hiddenDescription || 'You discovered a mystery location!';
      const category = activeTarget.hiddenCategory || 'unknown';
      
      targetName = realName;
      congratsMessage = `Mystery Solved! You discovered: ${realName}`;
      
      revelationData = {
        realName: realName,
        description: description,
        category: category,
        difficulty: activeTarget.difficulty,
        type: 'landmark_discovery'
      };

      // Delete sidequest after revealing
      await Location.findByIdAndDelete(activeTarget._id);
    }

    res.json({
      success: true,
      message: congratsMessage,
      data: {
        targetName: targetName,
        targetType: targetType,
        completedAt: new Date().toISOString(),
        // For sidequests, reveal the landmark information
        ...(targetType === 'sidequest' && revelationData)
      }
    });

  } catch (error) {
    console.error('Target reached error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark target as reached'
    });
  }
}));

// GET /api/landmarks/discover - Discover nearby landmarks (for testing and exploration)
router.get('/landmarks/discover', [
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isInt({ min: 100, max: 2000 })
    .withMessage('Radius must be between 100 and 2000 meters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array()
    });
  }

  try {
    let { lat, lng, radius } = req.query;

    // Default to latest GPS location if not provided
    if (!lat || !lng) {
      const latestGPS = await GPSData.findOne().sort({ timestamp: -1 });
      if (!latestGPS) {
        lat = parseFloat(process.env.DEFAULT_LATITUDE) || 37.7749;
        lng = parseFloat(process.env.DEFAULT_LONGITUDE) || -122.4194;
      } else {
        lat = latestGPS.latitude;
        lng = latestGPS.longitude;
      }
    } else {
      lat = parseFloat(lat);
      lng = parseFloat(lng);
    }

    radius = radius ? parseInt(radius) : 500;

    console.log(`Discovering landmarks near ${lat}, ${lng} within ${radius}m`);
    const landmarks = await landmarkService.discoverLandmarks(lat, lng, radius);

    res.json({
      success: true,
      message: `Found ${landmarks.length} landmarks within ${radius}m`,
      data: {
        searchLocation: { latitude: lat, longitude: lng },
        radiusMeters: radius,
        landmarks: landmarks.map(landmark => ({
          name: landmark.name,
          description: landmark.description,
          latitude: landmark.latitude,
          longitude: landmark.longitude,
          distance: landmark.distance,
          category: landmark.category,
          difficulty: landmark.difficulty,
          interestScore: landmark.interestScore,
          completionRadius: landmark.completionRadius
        }))
      }
    });

  } catch (error) {
    console.error('Landmark discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover landmarks: ' + error.message
    });
  }
}));

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return earthRadius * c;
}

module.exports = router;