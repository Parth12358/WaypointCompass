const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const GPSData = require('../models/GPSData');
const Sidequest = require('../models/Sidequest');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.AUDIO_UPLOAD_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported formats: MP3, WAV, M4A, OGG'));
    }
  }
});

// POST /api/voice/query - Process voice query with STT and LLM
router.post('/query', upload.single('audio'), [
  // Validate if using text input instead of audio
  body('text')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Text must be between 1 and 500 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object')
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
    let transcribedText = '';

    // Handle audio file or text input
    if (req.file) {
      // Process audio with Whisper STT
      try {
        // Create temporary file for OpenAI Whisper
        const tempDir = path.join(__dirname, '../../temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempFilePath = path.join(tempDir, `audio_${Date.now()}.${getFileExtension(req.file.mimetype)}`);
        await fs.writeFile(tempFilePath, req.file.buffer);

        // Transcribe audio
        const transcription = await openai.audio.transcriptions.create({
          file: await fs.readFile(tempFilePath),
          model: 'whisper-1',
          language: 'en'
        });

        transcribedText = transcription.text;

        // Clean up temp file
        await fs.unlink(tempFilePath).catch(console.error);

      } catch (sttError) {
        console.error('Speech-to-text error:', sttError);
        return res.status(500).json({
          success: false,
          error: 'Failed to process audio. Please try again or use text input.'
        });
      }
    } else if (req.body.text) {
      transcribedText = req.body.text.trim();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either audio file or text input is required'
      });
    }

    if (!transcribedText) {
      return res.status(400).json({
        success: false,
        error: 'No text could be extracted from the input'
      });
    }

    // Get current location context
    const currentGPS = await GPSData.findOne().sort({ timestamp: -1 });
    const location = currentGPS ? {
      latitude: currentGPS.latitude,
      longitude: currentGPS.longitude
    } : {
      latitude: parseFloat(process.env.DEFAULT_LATITUDE) || 37.7749,
      longitude: parseFloat(process.env.DEFAULT_LONGITUDE) || -122.4194
    };

    // Get nearby sidequests for context
    const nearbySidequests = await Sidequest.find({
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          },
          $maxDistance: 1000 // 1km radius
        }
      }
    }).limit(3).select('title description category difficulty');

    // Build context for LLM
    const systemPrompt = `You are the AI assistant for the Waypoint Compass, a GPS-enabled companion device. 

Current Context:
- User location: ${location.latitude}, ${location.longitude}
- Available sidequests nearby: ${nearbySidequests.map(q => `"${q.title}" (${q.category}, ${q.difficulty})`).join(', ') || 'None'}

You can help with:
1. Navigation and directions
2. Information about nearby sidequests/challenges
3. Location-based recommendations
4. Compass and GPS information

Keep responses concise and helpful for a small device display. Focus on actionable information.`;

    // Process with LLM (GPT)
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcribedText }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t process your request. Please try again.';

    // Generate TTS audio response
    let audioBuffer = null;
    try {
      const ttsResponse = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: aiResponse,
        response_format: 'mp3'
      });

      audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    } catch (ttsError) {
      console.error('Text-to-speech error:', ttsError);
      // Continue without audio if TTS fails
    }

    const response = {
      success: true,
      data: {
        transcribedText,
        aiResponse,
        context: {
          location,
          nearbySidequests: nearbySidequests.length
        }
      }
    };

    // If we have audio, send it as base64
    if (audioBuffer) {
      response.data.audioResponse = {
        format: 'mp3',
        data: audioBuffer.toString('base64')
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Voice query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process voice query'
    });
  }
}));

// POST /api/voice/tts - Text-to-speech conversion
router.post('/tts', [
  body('text')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Text must be between 1 and 1000 characters'),
  body('voice')
    .optional()
    .isIn(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
    .withMessage('Invalid voice selection')
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
    const { text, voice = 'nova' } = req.body;

    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      response_format: 'mp3'
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

    res.json({
      success: true,
      data: {
        text,
        voice,
        audioResponse: {
          format: 'mp3',
          size: audioBuffer.length,
          data: audioBuffer.toString('base64')
        }
      }
    });

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate speech'
    });
  }
}));

// GET /api/voice/status - Get voice system status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const supportedFormats = ['mp3', 'wav', 'm4a', 'ogg'];
    const supportedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

    res.json({
      success: true,
      data: {
        sttAvailable: hasOpenAIKey,
        ttsAvailable: hasOpenAIKey,
        llmAvailable: hasOpenAIKey,
        supportedAudioFormats: supportedFormats,
        supportedVoices: supportedVoices,
        maxAudioSize: parseInt(process.env.AUDIO_UPLOAD_MAX_SIZE) || 10485760
      }
    });

  } catch (error) {
    console.error('Voice status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get voice system status'
    });
  }
}));

// Helper function to get file extension from mime type
function getFileExtension(mimeType) {
  const mimeToExt = {
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm'
  };
  return mimeToExt[mimeType] || 'mp3';
}

module.exports = router;