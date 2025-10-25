const express = require('express');
const { body, validationResult } = require('express-validator');
const ttsService = require('../services/ttsService');
const navigationTrackingService = require('../services/navigationTrackingService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /api/tts/speak - Speak custom text
router.post('/speak', [
  body('text')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Text must be between 1 and 500 characters'),
  body('type')
    .optional()
    .isIn(['info', 'success', 'warning', 'progress'])
    .withMessage('Type must be info, success, warning, or progress'),
  body('voice')
    .optional()
    .isString()
    .withMessage('Voice must be a string'),
  body('speed')
    .optional()
    .isFloat({ min: 0.1, max: 3.0 })
    .withMessage('Speed must be between 0.1 and 3.0')
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
    const { text, type = 'info', voice, speed } = req.body;
    
    if (type === 'info' || type === 'success' || type === 'warning' || type === 'progress') {
      await ttsService.announceNavigation(text, type);
    } else {
      const options = {};
      if (voice) options.voice = voice;
      if (speed) options.speed = speed;
      
      await ttsService.speak(text, options);
    }

    res.json({
      success: true,
      message: 'Text spoken successfully',
      data: {
        text,
        type,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('TTS speak error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to speak text'
    });
  }
}));

// POST /api/tts/phrase - Play pre-generated common phrase
router.post('/phrase', [
  body('phrase')
    .isIn([
      'destination_reached', 
      'getting_closer', 
      'getting_further', 
      'gps_acquired', 
      'high_risk_warning', 
      'navigation_started', 
      'sidequest_available', 
      'safety_complete'
    ])
    .withMessage('Invalid phrase name')
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
    const { phrase } = req.body;
    
    await ttsService.playCommonPhrase(phrase);

    res.json({
      success: true,
      message: 'Phrase played successfully',
      data: {
        phrase,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('TTS phrase error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to play phrase'
    });
  }
}));

// GET /api/tts/status - Get TTS service status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const ttsStatus = ttsService.getStatus();
    const navigationStatus = navigationTrackingService.getStatus();

    res.json({
      success: true,
      data: {
        tts: ttsStatus,
        navigation: navigationStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('TTS status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get TTS status'
    });
  }
}));

// POST /api/tts/toggle - Enable/disable TTS
router.post('/toggle', [
  body('enabled')
    .isBoolean()
    .withMessage('Enabled must be a boolean')
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
    const { enabled } = req.body;
    
    ttsService.setEnabled(enabled);

    res.json({
      success: true,
      message: `TTS ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        enabled,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('TTS toggle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle TTS'
    });
  }
}));

// POST /api/tts/navigation/start - Start navigation tracking with TTS
router.post('/navigation/start', [
  body('deviceId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Device ID is required'),
  body('target')
    .isObject()
    .withMessage('Target location is required'),
  body('target.name')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Target name is required'),
  body('target.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Target latitude must be between -90 and 90'),
  body('target.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Target longitude must be between -180 and 180'),
  body('currentLocation')
    .isObject()
    .withMessage('Current location is required'),
  body('currentLocation.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Current latitude must be between -90 and 90'),
  body('currentLocation.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Current longitude must be between -180 and 180')
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
    const { deviceId, target, currentLocation } = req.body;
    
    const navigationData = navigationTrackingService.startNavigation(deviceId, target, currentLocation);

    res.json({
      success: true,
      message: 'Navigation tracking started with TTS announcements',
      data: navigationData
    });

  } catch (error) {
    console.error('Navigation start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start navigation tracking'
    });
  }
}));

// POST /api/tts/navigation/stop - Stop navigation tracking
router.post('/navigation/stop', [
  body('deviceId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Device ID is required'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
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
    const { deviceId, reason = 'manual' } = req.body;
    
    navigationTrackingService.stopNavigation(deviceId, reason);

    res.json({
      success: true,
      message: 'Navigation tracking stopped',
      data: {
        deviceId,
        reason,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Navigation stop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop navigation tracking'
    });
  }
}));

// POST /api/tts/setup - Pre-generate common phrases
router.post('/setup', asyncHandler(async (req, res) => {
  try {
    await ttsService.preGenerateCommonPhrases();

    res.json({
      success: true,
      message: 'TTS setup completed - common phrases generated',
      data: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('TTS setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup TTS'
    });
  }
}));

module.exports = router;