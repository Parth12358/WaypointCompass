const express = require('express');
const { body, query, validationResult } = require('express-validator');
const GPSData = require('../models/GPSData');
const asyncHandler = require('../utils/asyncHandler');

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

// POST /api/gps - Update GPS location (for testing or manual updates)
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
    .isIn(['device', 'manual', 'simulation'])
    .withMessage('Source must be device, manual, or simulation')
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
    const { latitude, longitude, altitude = 0, accuracy = 0, source = 'manual' } = req.body;

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
        isActive: timeSinceUpdate ? timeSinceUpdate < 60000 : false, // Active if updated within 1 minute
        totalRecords,
        lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
        timeSinceLastUpdate: timeSinceUpdate ? Math.floor(timeSinceUpdate / 1000) : null,
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

module.exports = router;