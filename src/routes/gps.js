const express = require('express');
const { body, query, validationResult } = require('express-validator');
const GPSData = require('../models/GPSData');
const SafetyService = require('../services/safetyService');
const asyncHandler = require('../utils/asyncHandler');

const safetyService = new SafetyService();

const router = express.Router();

// GET /api/gps - Get current GPS location for ESP32
router.get('/', asyncHandler(async (req, res) => {
  try {
    // Get the most recent GPS data
    const latestGPS = await GPSData.findOne()
      .sort({ timestamp: -1 })
      .select('latitude longitude altitude accuracy timestamp source -_id');

    if (!latestGPS) {
      // Return default location if no GPS data exists
      return res.json({
        success: true,
        data: {
          latitude: parseFloat(process.env.DEFAULT_LATITUDE) || 37.7749,
          longitude: parseFloat(process.env.DEFAULT_LONGITUDE) || -122.4194,
          altitude: 0,
          accuracy: 0,
          timestamp: new Date().toISOString(),
          source: 'default'
        }
      });
    }

    res.json({
      success: true,
      data: {
        latitude: latestGPS.latitude,
        longitude: latestGPS.longitude,
        altitude: latestGPS.altitude,
        accuracy: latestGPS.accuracy,
        timestamp: latestGPS.timestamp.toISOString(),
        source: latestGPS.source
      }
    });

  } catch (error) {
    console.error('GPS fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GPS data'
    });
  }
}));

// POST /api/gps - Update GPS location from ESP32 (receives iPhone GPS via BLE)
router.post('/', [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('altitude')
    .optional()
    .isFloat()
    .withMessage('Altitude must be a number'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
  body('source')
    .optional()
    .isIn(['ble', 'device', 'manual', 'simulation'])
    .withMessage('Source must be ble, device, manual, or simulation'),
  body('deviceId')
    .optional()
    .isString()
    .withMessage('Device ID must be a string')
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
    const { latitude, longitude, altitude = 0, accuracy = 0, source = 'ble', deviceId } = req.body;

    // Delete old GPS data from same device to keep database clean (optimized for high frequency)
    if (deviceId) {
      await GPSData.deleteMany({ 
        source: 'ble',
        timestamp: { $lt: new Date(Date.now() - 60000) } // Delete entries older than 1 minute (for high frequency updates)
      });
    }

    const gpsData = new GPSData({
      latitude,
      longitude,
      altitude,
      accuracy,
      source,
      timestamp: new Date()
    });

    await gpsData.save();

    res.status(201).json({
      success: true,
      message: 'GPS location updated successfully',
      data: {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude,
        accuracy: gpsData.accuracy,
        timestamp: gpsData.timestamp.toISOString(),
        source: gpsData.source
      }
    });

  } catch (error) {
    console.error('GPS update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update GPS data'
    });
  }
}));

// GET /api/gps/history - Get GPS history (for debugging)
router.get('/history', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Hours must be between 1 and 168 (1 week)')
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
    const limit = parseInt(req.query.limit) || 10;
    const hours = parseInt(req.query.hours) || 24;
    
    const timeFilter = new Date();
    timeFilter.setHours(timeFilter.getHours() - hours);

    const gpsHistory = await GPSData.find({
      timestamp: { $gte: timeFilter }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('latitude longitude altitude accuracy timestamp source -_id');

    res.json({
      success: true,
      data: gpsHistory.map(gps => ({
        latitude: gps.latitude,
        longitude: gps.longitude,
        altitude: gps.altitude,
        accuracy: gps.accuracy,
        timestamp: gps.timestamp.toISOString(),
        source: gps.source
      })),
      meta: {
        count: gpsHistory.length,
        timeRange: `${hours} hours`,
        limit
      }
    });

  } catch (error) {
    console.error('GPS history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GPS history'
    });
  }
}));

// GET /api/gps/status - Get GPS system status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const totalRecords = await GPSData.countDocuments();
    const recentRecord = await GPSData.findOne().sort({ timestamp: -1 });
    
    const now = new Date();
    const lastUpdate = recentRecord ? recentRecord.timestamp : null;
    const timeSinceUpdate = lastUpdate ? now - lastUpdate : null;
    
    res.json({
      success: true,
      data: {
        isActive: timeSinceUpdate ? timeSinceUpdate < 10000 : false, // Active if updated within 10 seconds (high frequency)
        totalRecords,
        lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
        timeSinceLastUpdate: timeSinceUpdate ? Math.floor(timeSinceUpdate / 1000) : null,
        updateFrequency: timeSinceUpdate ? `~${Math.floor(10000 / timeSinceUpdate)} updates/sec` : null,
        currentLocation: recentRecord ? {
          latitude: recentRecord.latitude,
          longitude: recentRecord.longitude,
          source: recentRecord.source
        } : null
      }
    });

  } catch (error) {
    console.error('GPS status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GPS status'
    });
  }
}));

// POST /api/gps/compass - ESP32 sends current GPS and gets bearing to target
router.post('/compass', [
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

    // Store the current GPS location
    const gpsData = new GPSData({
      latitude,
      longitude,
      source: 'ble',
      timestamp: new Date()
    });
    await gpsData.save();

    // Get current active target
    const Location = require('../models/Location');
    const activeTarget = await Location.findOne({ isActive: true })
      .select('name latitude longitude type completionRadius -_id');

    if (!activeTarget) {
      return res.json({
        success: true,
        data: {
          hasTarget: false,
          message: 'No active target set',
          currentLocation: { latitude, longitude }
        }
      });
    }

    // Calculate bearing from current GPS to target
    const bearing = calculateBearing(latitude, longitude, activeTarget.latitude, activeTarget.longitude);
    const distance = calculateDistance(latitude, longitude, activeTarget.latitude, activeTarget.longitude);

    // Check if user is close enough to complete target
    const isWithinRadius = distance <= activeTarget.completionRadius;

    // For sidequests, don't reveal name until completion
    const targetName = activeTarget.type === 'saved' ? activeTarget.name : 'Mystery Location';

    // Safety check - analyze current location for immediate hazards
    let safetyWarnings = [];
    try {
      const currentLocationSafety = await safetyService.analyzeSafetyAtLocation(
        latitude, 
        longitude, 
        'current_location'
      );
      
      // Add warnings for high-risk current location
      if (currentLocationSafety.riskScore > 3.0) {
        safetyWarnings.push({
          type: 'current_location_risk',
          severity: 'warning',
          message: '⚠️ You are in a high-risk area - exercise extra caution'
        });
      }
      
      // Add time-based warnings
      if (currentLocationSafety.timeRisk && currentLocationSafety.timeRisk.riskLevel > 1.5) {
        safetyWarnings.push({
          type: 'time_warning', 
          severity: 'caution',
          message: `🌙 ${currentLocationSafety.timeRisk.factors.join(', ')} - stay alert`
        });
      }
      
      // If getting close to destination, check route safety
      if (distance < 100 && distance > 20) {
        const routeSafety = await safetyService.analyzeSafetyRoute(
          latitude, longitude, 
          activeTarget.latitude, activeTarget.longitude
        );
        
        if (routeSafety.success && routeSafety.warnings && routeSafety.warnings.length > 0) {
          safetyWarnings.push({
            type: 'approaching_destination',
            severity: 'info',
            message: `🎯 Approaching destination - ${routeSafety.warnings[0].message}`
          });
        }
      }
      
    } catch (safetyError) {
      console.log('Safety check skipped:', safetyError.message);
      // Don't fail the compass request if safety check fails
    }

    res.json({
      success: true,
      data: {
        hasTarget: true,
        currentLocation: { latitude, longitude },
        target: {
          name: targetName,
          latitude: activeTarget.latitude,
          longitude: activeTarget.longitude,
          type: activeTarget.type
        },
        compass: {
          bearing: Math.round(bearing),
          distance: Math.round(distance),
          canComplete: isWithinRadius,
          completionRadius: activeTarget.completionRadius
        },
        safety: safetyWarnings.length > 0 ? {
          warnings: safetyWarnings,
          hasWarnings: true,
          message: 'Safety notices for your current location'
        } : {
          hasWarnings: false,
          message: 'No immediate safety concerns detected'
        }
      }
    });

  } catch (error) {
    console.error('GPS compass error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process GPS and compass data'
    });
  }
}));

// Helper function to calculate bearing between two coordinates
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360 degrees
}

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