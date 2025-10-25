# ESP32 WaypointCompass Implementation

## Overview
The ESP32 WaypointCompass is a comprehensive adventure navigation system that integrates with the WaypointCompass backend to provide real-time GPS tracking, safety analysis, location management, and sidequest generation.

## Architecture

### Hardware Components
- **ESP32-S3**: Main microcontroller with WiFi and BLE
- **480x480 Display**: Touch-enabled TFT display
- **BLE Radio**: Receives GPS data from iPhone via nRF Connect
- **WiFi**: Connects to WaypointCompass backend server

### Software Stack
- **Arduino Framework**: Core embedded system
- **TFT_eSPI**: Display and touch handling  
- **BLE Libraries**: Bluetooth Low Energy communication
- **ArduinoJson**: JSON parsing for API communication
- **HTTPClient**: RESTful API integration

## Features

### 🧭 Navigation System
- **Real-time Compass**: Calculates bearing and distance to target
- **GPS Tracking**: Receives coordinates via BLE from iPhone
- **Local Calculations**: Haversine formula for accurate distance/bearing
- **Visual Compass**: Graphical needle pointing to destination

### 🛡️ Safety Integration
- **Risk Analysis**: Real-time safety scoring (0-5 scale)
- **Time-based Warnings**: Night/weekend risk adjustments
- **Hazard Detection**: Infrastructure and natural hazards
- **Emergency Services**: Hospital/police/fire station lookup

### 📍 Location Management
- **Save Waypoints**: Store current GPS coordinates
- **Navigate to Saved**: Select from backend location database
- **Location Metadata**: Names, descriptions, categories
- **Device Tracking**: Unique ESP32 device identification

### 🎮 Sidequest System
- **Adventure Generation**: AI-powered exploration suggestions
- **Difficulty Levels**: Customizable challenge ratings
- **Target Navigation**: Direct compass guidance to quest locations
- **Completion Tracking**: Quest status management

## API Integration

### Backend Endpoints Used
```
GET  /health                           - System health check
POST /api/gps                          - GPS location updates
GET  /api/locations                    - Retrieve saved locations
POST /api/locations                    - Save new locations
POST /api/locations/sidequest          - Generate sidequest
GET  /api/safety/analyze-location      - Safety risk analysis
GET  /api/safety/emergency-services    - Find emergency help
POST /api/gps/compass                  - Compass data logging
```

### Data Formats
```json
// GPS Update
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 15.0,
  "accuracy": 5.0,
  "source": "ble",
  "deviceId": "ESP32_12345678"
}

// Location Save
{
  "name": "ESP32 Waypoint 12345",
  "description": "Saved from WaypointCompass ESP32",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "category": "waypoint",
  "source": "esp32",
  "deviceId": "ESP32_12345678"
}

// Sidequest Generation
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radius": 2000,
  "difficulty": "moderate"
}
```

## User Interface

### Main Menu
- **GPS Status**: Current coordinates and accuracy
- **System Status**: WiFi, Backend, BLE connectivity
- **Safety Indicator**: Current risk level
- **Action Buttons**: Save, Navigate, Safety, Sidequest

### Compass Screen
- **Visual Compass**: Needle pointing to target
- **Distance Display**: Kilometers or meters to destination
- **Bearing**: Degrees from North
- **Target Info**: Name and safety status
- **Control Buttons**: Back, Safety check

### Safety Screen
- **Risk Score**: Large 0-5.0 display with color coding
- **Risk Level**: Safe/Moderate/High text indicator
- **Warnings**: Specific safety concerns
- **Hazards**: Nearby dangerous infrastructure
- **Emergency**: Quick access to help services

### Sidequest Screen
- **Quest Title**: Adventure name
- **Description**: Detailed quest information
- **Difficulty**: Challenge level indicator
- **Target Location**: Destination details
- **Actions**: Navigate to quest, Mark complete

## Setup Instructions

### 1. Hardware Preparation
```cpp
// Pin configuration (adjust for your ESP32 board)
// TFT_eSPI User_Setup.h configuration required
// Touch pins: Usually GPIO pins for SPI touch controller
```

### 2. Library Installation
```bash
# Arduino IDE Library Manager:
- ArduinoJson by Benoit Blanchon
- ESP32 BLE Arduino by Neil Kolban
- TFT_eSPI by Bodmer

# Platform IO (platformio.ini):
lib_deps = 
    bblanchon/ArduinoJson@^6.21.0
    bodmer/TFT_eSPI@^2.5.0
    h2zero/NimBLE-Arduino@^1.4.0
```

### 3. Configuration
```cpp
// Update in arduinoide.ino:
const char* WIFI_SSID = "YourWiFiNetwork";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* BACKEND_URL = "http://YOUR_SERVER_IP:3000";
```

### 4. TFT_eSPI Setup
```cpp
// In TFT_eSPI/User_Setup.h:
#define ESP32_PARALLEL  // or appropriate driver
#define TFT_WIDTH  480
#define TFT_HEIGHT 480
// Configure pins for your specific ESP32 board
```

## BLE GPS Integration

### nRF Connect Setup
1. **Install nRF Connect** on iPhone
2. **Connect to "WaypointCompass_ESP32"**
3. **Find UART Service**: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
4. **Write to Characteristic**: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E

### GPS Data Format
```
Basic: "37.7749,-122.4194"
Extended: "37.7749,-122.4194,15.0,5.0"
Format: "latitude,longitude[,altitude,accuracy]"
```

### iPhone GPS Shortcuts
Create iOS Shortcuts to automatically send GPS:
```
Get Current Location → Format as "lat,lng" → Send to BLE
```

## Troubleshooting

### Common Issues

#### WiFi Connection Failed
```cpp
// Check credentials and network
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
// Monitor serial output for connection status
```

#### Backend Unreachable
```cpp
// Verify server is running
curl http://YOUR_SERVER_IP:3000/health

// Check firewall settings
// Ensure MongoDB is running
```

#### BLE Not Advertising
```cpp
// Reset BLE stack
BLEDevice::deinit();
BLEDevice::init("WaypointCompass_ESP32");
```

#### Display Issues
```cpp
// Verify TFT_eSPI configuration
// Check pin connections
// Test with TFT_eSPI examples first
```

### Debug Output
Monitor serial console for detailed status:
```
🧭 WaypointCompass Adventure System Initializing...
🌐 WiFi Connected: 192.168.1.100
✅ Backend connectivity verified
📶 BLE Advertising: WaypointCompass_ESP32
🔧 Device ID: ESP32_A1B2C3D4
📍 BLE GPS received: 37.7749,-122.4194,15.0,5.0
🎯 GPS Updated: 37.774900, -122.419400 (alt: 15.0m, acc: 5.0m)
```

## Performance Optimization

### Memory Management
- **JSON Buffer Sizing**: Appropriate StaticJsonDocument sizes
- **String Handling**: Efficient String operations
- **Display Buffers**: Minimal screen redraws

### Network Efficiency
- **Connection Pooling**: Reuse HTTP connections where possible
- **Timeout Settings**: Appropriate timeout values
- **Offline Mode**: Graceful degradation without backend

### Battery Optimization
- **Sleep Modes**: Implement deep sleep for battery operation
- **Update Frequency**: Balance accuracy vs power consumption
- **Display Brightness**: Automatic brightness adjustment

## Future Enhancements

### Planned Features
- **Multi-location Selection**: Scrollable location list
- **Voice Notifications**: Audio compass directions
- **Offline Maps**: Local tile caching
- **Weather Integration**: Weather-based safety factors
- **Group Coordination**: Multi-device synchronization

### Hardware Upgrades
- **External GPS**: Dedicated GPS module option
- **Magnetometer**: True compass heading
- **Accelerometer**: Motion-based features
- **SD Card**: Local data storage

## Contributing

### Code Structure
```
arduinoide.ino
├── Configuration & Includes
├── Global State Management
├── BLE Callbacks
├── Setup & Initialization
├── Main Loop
├── Display Functions
├── Touch Handling
├── Backend API Integration
└── Helper Functions
```

### Development Guidelines
- **Modular Functions**: Keep functions focused and testable
- **Error Handling**: Comprehensive error checking
- **Serial Logging**: Detailed debug output
- **Code Comments**: Clear documentation
- **Consistent Styling**: Follow Arduino conventions

## License
This ESP32 implementation is part of the WaypointCompass project and follows the same licensing terms.