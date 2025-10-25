# Waypoint Compass

A digital compass system that helps users navigate to saved locations using ESP32 hardware, iPhone GPS via Bluetooth, and Express.js backend.

## Project Overview

This project creates a simple compass that points to saved locations (like a parked car, pizza place, etc.) with an optional "mystery sidequest" feature that discovers interesting nearby locations.

**Key Innovation**: Uses iPhone GPS data transmitted via Bluetooth Low Energy (BLE) to ESP32, since the hardware doesn't include GPS sensors.

## Current Status (October 2024)

✅ **Backend Complete**: Full Express.js API with MongoDB integration  
✅ **Database Design**: Geospatial indexing for location queries  
✅ **API Endpoints**: All routes implemented and tested  
✅ **BLE Integration**: Backend adapted for iPhone GPS via nRF Connect  
🔄 **ESP32 Code**: Example BLE + HTTP client code provided  
⏳ **Sidequest Discovery**: OpenStreetMap integration planned  

## Architecture

```
iPhone (GPS) → nRF Connect App → BLE → ESP32 → HTTP → Backend → MongoDB
                                   ↓
                              480x480 Display (Compass)
```

## Hardware Requirements

- **ESP32-S3**: Main processor with WiFi and BLE
- **RP2040**: Co-processor for display management  
- **480x480 Display**: Compass visualization
- **iPhone**: GPS source via nRF Connect app
- **No GPS Module Needed**: Uses BLE from iPhone instead

## Tech Stack

- **Backend**: Node.js, Express.js, MongoDB
- **Database**: Geospatial indexing with 2dsphere
- **Hardware**: ESP32-S3 + RP2040 dual processor setup
- **Communication**: BLE (iPhone ↔ ESP32), HTTP (ESP32 ↔ Backend)
- **GPS Source**: iPhone location via nRF Connect BLE app

## API Endpoints

### Core Compass API
- `POST /api/gps/compass` - **Main endpoint**: Send GPS, get bearing + target info
- `GET /api/target` - Get current active navigation target
- `POST /api/target/reached` - Mark target as completed

### Location Management
- `POST /api/locations` - Save new locations (car, restaurant, etc.)
- `GET /api/locations` - List saved locations
- `POST /api/sidequest/start` - Start mystery location discovery

### GPS Data (for debugging)
- `GET /api/gps` - Get latest GPS coordinates  
- `POST /api/gps` - Store GPS coordinates

### System
- `GET /health` - Health check
- `GET /` - API information

## Quick Start

### 1. Backend Setup
```bash
npm install
cp .env.example .env
# Edit .env with MongoDB connection string
npm start
```

### 2. iPhone Setup
1. Install "nRF Connect for Mobile" from App Store
2. Follow guide in `docs/nrf-connect-setup.md`
3. Connect to ESP32 and send GPS coordinates

### 3. ESP32 Setup
1. Flash ESP32 with code from `examples/esp32_compass_example.cpp`
2. ESP32 will receive GPS via BLE and display compass

## Data Flow

1. **iPhone GPS** → nRF Connect sends `"lat,lng"` via BLE
2. **ESP32 receives** GPS coordinates and stores locally  
3. **ESP32 calls** `POST /api/gps/compass` with coordinates
4. **Backend calculates** bearing and distance to active target
5. **ESP32 displays** compass pointing toward target

## Key Files

- `src/server.js` - Main Express application
- `src/routes/gps.js` - GPS and compass calculation endpoints
- `src/routes/locations.js` - Location and sidequest management  
- `src/models/Location.js` - Simple location schema (name, coordinates, type)
- `src/models/GPSData.js` - GPS coordinate storage with cleanup
- `examples/esp32_compass_example.cpp` - Complete ESP32 BLE + HTTP example
- `docs/nrf-connect-setup.md` - iPhone BLE setup guide

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/waypoint-compass |

## Development

```bash
npm run dev  # Development with auto-reload
npm start    # Production mode
```

## Testing Example

```bash
# Save a location
curl -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -d '{"name":"Home","latitude":37.7749,"longitude":-122.4194}'

# Send GPS and get compass bearing  
curl -X POST http://localhost:3000/api/gps/compass \
  -H "Content-Type: application/json" \
  -d '{"latitude":37.7849,"longitude":-122.4094}'
```

## Database Schema

### Location (Simplified)
```javascript
{
  name: String,           // "Home", "Car", "Pizza Place"
  latitude: Number,
  longitude: Number,
  type: String,          // "saved" or "sidequest"
  isActive: Boolean,     // Currently targeted location
  completionRadius: Number, // Meters to consider "reached"
  location: { type: "Point", coordinates: [lng, lat] }
}
```

### GPS Data (BLE Source)
```javascript
{
  latitude: Number,
  longitude: Number,
  source: String,        // "ble" from iPhone
  deviceId: String,      // Optional device identifier
  timestamp: Date
}
```

## Next Steps

1. **Complete ESP32 Integration**: Test BLE + HTTP communication
2. **OpenStreetMap Sidequests**: Auto-discover interesting locations within 0.5 miles
3. **Display Optimization**: Improve compass visualization on 480x480 screen  
4. **Error Handling**: Robust connection handling for BLE and WiFi

## License

MIT License - see LICENSE file for details