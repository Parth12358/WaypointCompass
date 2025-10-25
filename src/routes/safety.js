const express = require('express');
const { query, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const SafetyService = require('../services/safetyService');

const router = express.Router();
const safetyService = new SafetyService();

// GET /api/safety/analyze-route - Analyze safety along route to destination
router.get('/analyze-route', [
  query('fromLat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('From latitude must be between -90 and 90'),
  query('fromLng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('From longitude must be between -180 and 180'),
  query('toLat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('To latitude must be between -90 and 90'),
  query('toLng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('To longitude must be between -180 and 180')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates provided',
      details: errors.array()
    });
  }

  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    
    console.log(`Safety analysis requested: ${fromLat},${fromLng} → ${toLat},${toLng}`);
    
    const safetyAnalysis = await safetyService.analyzeSafetyRoute(
      parseFloat(fromLat),
      parseFloat(fromLng),
      parseFloat(toLat),
      parseFloat(toLng)
    );
    
    res.json({
      success: true,
      data: safetyAnalysis,
      message: 'Route safety analysis completed'
    });

  } catch (error) {
    console.error('Safety analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze route safety',
      fallback: {
        warnings: [{
          type: 'system_error',
          severity: 'info',
          message: 'Safety analysis unavailable - proceed with normal caution'
        }],
        recommendations: [{
          type: 'general',
          message: 'Stay alert and trust your instincts',
          priority: 'high'
        }]
      }
    });
  }
}));

// GET /api/safety/analyze-location - Analyze safety at specific location
router.get('/analyze-location', [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isInt({ min: 50, max: 1000 })
    .withMessage('Radius must be between 50 and 1000 meters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid parameters provided',
      details: errors.array()
    });
  }

  try {
    const { lat, lng, radius = 200 } = req.query;
    
    console.log(`Location safety analysis: ${lat},${lng} (${radius}m radius)`);
    
    const locationSafety = await safetyService.analyzeSafetyAtLocation(
      parseFloat(lat),
      parseFloat(lng),
      'requested_location'
    );
    
    res.json({
      success: true,
      data: locationSafety,
      message: 'Location safety analysis completed'
    });

  } catch (error) {
    console.error('Location safety analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze location safety'
    });
  }
}));

// GET /api/safety/check-destination - Quick safety check for mystery destinations
router.get('/check-destination', [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates provided',
      details: errors.array()
    });
  }

  try {
    const { lat, lng } = req.query;
    
    console.log(`Destination safety check: ${lat},${lng}`);
    
    const destinationSafety = await safetyService.analyzeSafetyAtLocation(
      parseFloat(lat),
      parseFloat(lng),
      'destination_check'
    );
    
    // Determine if destination is safe enough for mystery sidequest
    const isSafeForSidequest = destinationSafety.riskScore < 3.0;
    const requiresWarning = destinationSafety.riskScore > 2.0;
    
    res.json({
      success: true,
      data: {
        isSafeForSidequest,
        requiresWarning,
        riskScore: destinationSafety.riskScore,
        warnings: destinationSafety.warnings,
        safetyMessage: isSafeForSidequest 
          ? 'Destination appears safe for exploration'
          : 'Destination may require extra caution',
        recommendation: requiresWarning 
          ? 'Consider choosing a different mystery location'
          : 'Destination suitable for adventure'
      },
      message: 'Destination safety check completed'
    });

  } catch (error) {
    console.error('Destination safety check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check destination safety',
      fallback: {
        isSafeForSidequest: true, // Default to allowing sidequests
        requiresWarning: true,    // But always show caution
        safetyMessage: 'Safety check unavailable - exercise normal caution'
      }
    });
  }
}));

// GET /api/safety/emergency-services - Find nearby emergency services
router.get('/emergency-services', [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isInt({ min: 100, max: 5000 })
    .withMessage('Radius must be between 100 and 5000 meters'),
  query('type')
    .optional()
    .isIn(['hospital', 'police', 'fire_station', 'all'])
    .withMessage('Type must be hospital, police, fire_station, or all')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid parameters provided',
      details: errors.array()
    });
  }

  try {
    const { lat, lng, radius = 1000, type = 'all' } = req.query;
    
    console.log(`Emergency services search: ${lat},${lng} (${radius}m, type: ${type})`);
    
    // Build specific query for emergency services
    const typeFilter = type === 'all' 
      ? 'hospital|police|fire_station'
      : type;
    
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node[amenity~"^(${typeFilter})$"](around:${radius},${lat},${lng});
        way[amenity~"^(${typeFilter})$"](around:${radius},${lat},${lng});
      );
      out center meta;
    `;
    
    const axios = require('axios');
    const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 20000
    });
    
    const emergencyServices = [];
    
    if (response.data.elements) {
      response.data.elements.forEach(element => {
        const serviceLat = element.lat || (element.center && element.center.lat);
        const serviceLng = element.lon || (element.center && element.center.lon);
        
        if (serviceLat && serviceLng && element.tags) {
          const distance = safetyService.calculateDistance(
            parseFloat(lat), parseFloat(lng), serviceLat, serviceLng
          );
          
          emergencyServices.push({
            id: element.id,
            type: element.tags.amenity,
            name: element.tags.name || `${element.tags.amenity} facility`,
            latitude: serviceLat,
            longitude: serviceLng,
            distance: Math.round(distance),
            address: element.tags['addr:full'] || 
                    `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street'] || ''}`.trim(),
            phone: element.tags.phone,
            website: element.tags.website,
            emergency: element.tags.emergency === 'yes'
          });
        }
      });
    }
    
    // Sort by distance
    emergencyServices.sort((a, b) => a.distance - b.distance);
    
    res.json({
      success: true,
      data: {
        services: emergencyServices,
        count: emergencyServices.length,
        searchRadius: parseInt(radius),
        closestService: emergencyServices.length > 0 ? emergencyServices[0] : null
      },
      message: `Found ${emergencyServices.length} emergency services within ${radius}m`
    });

  } catch (error) {
    console.error('Emergency services search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find emergency services'
    });
  }
}));

module.exports = router;