# Waypoint Compass Backend

A Node.js Express backend server for the Waypoint Compass ESP32 project. Provides GPS data, location-based sidequests, and voice processing capabilities.

## Features

- **GPS Endpoint**: Provides current location data to ESP32 devices
- **Sidequests**: Location-based challenges and activities
- **Voice Processing**: OpenAI Whisper STT, GPT LLM, and TTS integration
- **Geospatial Queries**: MongoDB with 2dsphere indexing for location-based operations
- **Security**: CORS, rate limiting, helmet security headers
- **Error Handling**: Comprehensive error handling and validation

## API Endpoints

### GPS Endpoints
- `GET /api/gps` - Get current GPS location
- `POST /api/gps` - Update GPS location (for testing)
- `GET /api/gps/history` - Get GPS history
- `GET /api/gps/status` - Get GPS system status

### Sidequest Endpoints
- `GET /api/sidequests/nearby` - Get nearby location challenges
- `POST /api/sidequests` - Create new sidequest (for testing)
- `GET /api/sidequests/categories` - Get available categories
- `POST /api/sidequests/complete` - Mark sidequest as completed

### Voice Endpoints
- `POST /api/voice/query` - Process voice or text query with AI
- `POST /api/voice/tts` - Text-to-speech conversion
- `GET /api/voice/status` - Get voice system status

### System Endpoints
- `GET /health` - Health check
- `GET /` - API information

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   - MongoDB connection string
   - OpenAI API key
   - Default GPS coordinates

3. **Start MongoDB:**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo

   # Or start your local MongoDB instance
   mongod
   ```

4. **Run the server:**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

5. **Test the API:**
   ```bash
   curl http://localhost:3000/health
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/waypoint-compass |
| `OPENAI_API_KEY` | OpenAI API key for voice processing | - |
| `DEFAULT_LATITUDE` | Default GPS latitude | 37.7749 |
| `DEFAULT_LONGITUDE` | Default GPS longitude | -122.4194 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## ESP32 Integration

The server is designed to work with ESP32-S3 devices using HTTPS requests:

### ESP32 Example Code
```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Get GPS data
HTTPClient http;
http.begin("https://your-server.com/api/gps");
int httpCode = http.GET();

if (httpCode == 200) {
  String payload = http.getString();
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, payload);
  
  float lat = doc["data"]["latitude"];
  float lng = doc["data"]["longitude"];
  
  // Use coordinates for compass calculations
}
```

### Recommended ESP32 Polling
- GPS data: Every 5-10 seconds
- Sidequests: Every 30-60 seconds (or when location changes significantly)
- Voice queries: On-demand only

## Database Schema

### GPS Data
```javascript
{
  latitude: Number,
  longitude: Number,
  altitude: Number,
  accuracy: Number,
  timestamp: Date,
  source: String,
  location: { type: "Point", coordinates: [lng, lat] }
}
```

### Sidequests
```javascript
{
  title: String,
  description: String,
  latitude: Number,
  longitude: Number,
  completionRadius: Number,
  difficulty: String,
  category: String,
  points: Number,
  location: { type: "Point", coordinates: [lng, lat] }
}
```

## Development

### Scripts
- `npm run dev` - Start with nodemon for development
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Testing Endpoints

1. **Test GPS endpoint:**
   ```bash
   curl http://localhost:3000/api/gps
   ```

2. **Add test location:**
   ```bash
   curl -X POST http://localhost:3000/api/gps \
     -H "Content-Type: application/json" \
     -d '{"latitude": 37.7749, "longitude": -122.4194}'
   ```

3. **Create test sidequest:**
   ```bash
   curl -X POST http://localhost:3000/api/sidequests \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Find the Golden Gate Bridge",
       "description": "Navigate to this iconic San Francisco landmark",
       "latitude": 37.8199, "longitude": -122.4783,
       "category": "exploration", "difficulty": "easy"
     }'
   ```

4. **Test voice query:**
   ```bash
   curl -X POST http://localhost:3000/api/voice/query \
     -H "Content-Type: application/json" \
     -d '{"text": "What sidequests are nearby?"}'
   ```

## Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start src/server.js --name waypoint-compass
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### Environment Setup
- Ensure MongoDB is accessible
- Configure firewall for port 3000
- Set up HTTPS with reverse proxy (nginx/Apache)
- Add domain name and SSL certificate

## Security Considerations

- CORS is configured to allow ESP32 connections
- Rate limiting prevents API abuse
- Input validation on all endpoints
- Helmet.js for security headers
- Environment variables for sensitive data

## Performance

- MongoDB geospatial indexing for fast location queries
- Response compression enabled
- Async/await pattern for non-blocking operations
- Connection pooling for database
- Request logging for monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper error handling
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details