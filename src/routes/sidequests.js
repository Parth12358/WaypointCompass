const express = require('express');
const { query, body, validationResult } = require('express-validator');
const Sidequest = require('../models/Sidequest');
const GPSData = require('../models/GPSData');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/sidequests/nearby - Get nearby sidequests for ESP32
router.get('/nearby', [
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
    .isInt({ min: 10, max: 10000 })
    .withMessage('Radius must be between 10 and 10000 meters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  query('category')
    .optional()
    .isIn(['exploration', 'photography', 'trivia', 'challenge', 'discovery'])
    .withMessage('Invalid category')
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
    let { lat, lng, radius = 1000, limit = 5, difficulty, category } = req.query;

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

    radius = parseInt(radius);
    limit = parseInt(limit);

    // Build query filters
    const filters = { isActive: true };
    if (difficulty) filters.difficulty = difficulty;
    if (category) filters.category = category;

    // Geospatial query to find nearby sidequests
    const nearbySidequests = await Sidequest.find({
      ...filters,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radius
        }
      }
    })
    .limit(limit)
    .select('title description latitude longitude completionRadius difficulty category points hints -_id');

    // Calculate distances and format response
    const sidequestsWithDistance = nearbySidequests.map(quest => {
      const distance = calculateDistance(lat, lng, quest.latitude, quest.longitude);
      
      // Determine available hints based on distance
      const availableHints = quest.hints.filter(hint => 
        !hint.unlockDistance || distance <= hint.unlockDistance
      ).map(hint => hint.text);

      return {
        title: quest.title,
        description: quest.description,
        location: {
          latitude: quest.latitude,
          longitude: quest.longitude
        },
        distance: Math.round(distance),
        completionRadius: quest.completionRadius,
        difficulty: quest.difficulty,
        category: quest.category,
        points: quest.points,
        hints: availableHints,
        canComplete: distance <= quest.completionRadius
      };
    });

    res.json({
      success: true,
      data: {
        currentLocation: { latitude: lat, longitude: lng },
        searchRadius: radius,
        sidequests: sidequestsWithDistance
      },
      meta: {
        totalFound: sidequestsWithDistance.length,
        searchParams: {
          radius,
          difficulty: difficulty || 'all',
          category: category || 'all'
        }
      }
    });

  } catch (error) {
    console.error('Nearby sidequests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby sidequests'
    });
  }
}));

// POST /api/sidequests - Create a new sidequest (for testing)
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('completionRadius')
    .optional()
    .isInt({ min: 5, max: 1000 })
    .withMessage('Completion radius must be between 5 and 1000 meters'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  body('category')
    .optional()
    .isIn(['exploration', 'photography', 'trivia', 'challenge', 'discovery'])
    .withMessage('Invalid category'),
  body('points')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Points must be a positive number')
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
    const sidequestData = {
      title: req.body.title,
      description: req.body.description,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      completionRadius: req.body.completionRadius || 50,
      difficulty: req.body.difficulty || 'medium',
      category: req.body.category || 'exploration',
      points: req.body.points || 100,
      requirements: req.body.requirements || [],
      hints: req.body.hints || [],
      createdBy: 'api'
    };

    const sidequest = new Sidequest(sidequestData);
    await sidequest.save();

    res.status(201).json({
      success: true,
      message: 'Sidequest created successfully',
      data: {
        id: sidequest._id,
        title: sidequest.title,
        description: sidequest.description,
        location: {
          latitude: sidequest.latitude,
          longitude: sidequest.longitude
        },
        completionRadius: sidequest.completionRadius,
        difficulty: sidequest.difficulty,
        category: sidequest.category,
        points: sidequest.points
      }
    });

  } catch (error) {
    console.error('Create sidequest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sidequest'
    });
  }
}));

// GET /api/sidequests/categories - Get available categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = [
    { id: 'exploration', name: 'Exploration', description: 'Discover new places and landmarks' },
    { id: 'photography', name: 'Photography', description: 'Capture specific photos or scenes' },
    { id: 'trivia', name: 'Trivia', description: 'Answer questions about locations' },
    { id: 'challenge', name: 'Challenge', description: 'Complete specific tasks or activities' },
    { id: 'discovery', name: 'Discovery', description: 'Find hidden objects or secrets' }
  ];

  res.json({
    success: true,
    data: categories
  });
}));

// POST /api/sidequests/complete - Mark a sidequest as completed
router.post('/complete', [
  body('questId')
    .isMongoId()
    .withMessage('Valid quest ID is required'),
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
    const { questId, latitude, longitude } = req.body;

    const sidequest = await Sidequest.findById(questId);
    if (!sidequest) {
      return res.status(404).json({
        success: false,
        error: 'Sidequest not found'
      });
    }

    if (!sidequest.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Sidequest is not active'
      });
    }

    const isWithinRadius = sidequest.isWithinCompletionRadius(latitude, longitude);
    if (!isWithinRadius) {
      const distance = calculateDistance(latitude, longitude, sidequest.latitude, sidequest.longitude);
      return res.status(400).json({
        success: false,
        error: 'Not within completion radius',
        data: {
          requiredRadius: sidequest.completionRadius,
          currentDistance: Math.round(distance)
        }
      });
    }

    res.json({
      success: true,
      message: 'Sidequest completed successfully!',
      data: {
        questTitle: sidequest.title,
        pointsEarned: sidequest.points,
        difficulty: sidequest.difficulty,
        category: sidequest.category
      }
    });

  } catch (error) {
    console.error('Complete sidequest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete sidequest'
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