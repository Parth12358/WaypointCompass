const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const gpsRoutes = require('./routes/gps');
const locationRoutes = require('./routes/locations');
const safetyRoutes = require('./routes/safety');
const ttsRoutes = require('./routes/tts');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for ESP32
app.use(cors({
  origin: '*', // Allow ESP32 to connect from any IP
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/gps', gpsRoutes);
app.use('/api', locationRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/tts', ttsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Waypoint Compass Backend API',
    version: '1.0.0',
    endpoints: {
      gps: '/api/gps',
      target: '/api/target',
      locations: '/api/locations',
      sidequestStart: '/api/sidequest/start',
      targetReached: '/api/target/reached',
      safety: '/api/safety',
      safetyRoute: '/api/safety/analyze-route',
      safetyLocation: '/api/safety/analyze-location',
      emergencyServices: '/api/safety/emergency-services',
      tts: '/api/tts',
      ttsSpeak: '/api/tts/speak',
      ttsPhrase: '/api/tts/phrase',
      ttsStatus: '/api/tts/status',
      ttsNavStart: '/api/tts/navigation/start',
      ttsNavStop: '/api/tts/navigation/stop',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server after database connection
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    console.log('🎯 Database connection completed, starting server...');
    
    // Initialize TTS service
    console.log('🔊 Initializing TTS service...');
    const ttsService = require('./services/ttsService');
    await ttsService.preGenerateCommonPhrases();
    
    // Start the HTTP server on all network interfaces
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Waypoint Compass Backend running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Local access: http://localhost:${PORT}/health`);
      console.log(`🌐 Network access: http://10.10.77.248:${PORT}/health`);
      console.log('🔊 TTS service initialized with audio feedback');
      console.log('✅ Server is ready to accept connections from ESP32');
    });

    server.on('error', (error) => {
      console.error('💥 Server error:', error);
      process.exit(1);
    });

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;