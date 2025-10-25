# WaypointCompass ESP-IDF Project

This is the ESP-IDF conversion of the Arduino IDE WaypointCompass project. The conversion provides a professional embedded development framework with better structure, debugging capabilities, and performance.

## Project Structure

```
esp-idf-waypoint/
├── CMakeLists.txt              # Main project CMake file
├── sdkconfig.defaults          # Default project configuration
├── main/                       # Main application
│   ├── CMakeLists.txt
│   └── waypoint_compass_main.cpp
└── components/                 # Modular components
    ├── compass_display/        # TFT display driver and UI
    ├── gps_handler/           # BLE GPS communication
    ├── network_manager/       # HTTP client for backend API
    ├── navigation_calc/       # Navigation calculations
    └── touch_controller/      # Touch screen interface
```

## Key Differences from Arduino IDE

### 1. Modular Architecture
- **Arduino IDE**: Single monolithic file (971 lines)
- **ESP-IDF**: Modular components with clear separation of concerns

### 2. Professional Development Features
- **FreeRTOS**: Multi-tasking with dedicated tasks for GPS, network, and UI
- **Event-driven**: Uses FreeRTOS event groups for synchronization
- **Memory Management**: Proper mutex protection for shared data
- **Error Handling**: Comprehensive error checking and logging

### 3. Component Responsibilities

#### compass_display
- **Function**: TFT display driver with complete UI rendering
- **Features**: Startup screen, main menu, compass view, safety analysis, sidequest display
- **Hardware**: ILI9341 compatible TFT with SPI interface
- **Improvements**: Proper SPI configuration, optimized drawing functions

#### gps_handler  
- **Function**: BLE GATT server for nRF Connect GPS data reception
- **Features**: NMEA sentence parsing, coordinate conversion, connection management
- **Protocol**: Nordic UART Service (NUS) for nRF Connect compatibility
- **Improvements**: Task-based processing, proper BLE stack management

#### network_manager
- **Function**: HTTP client for backend API communication
- **Features**: Connectivity testing, GPS data upload, location management, safety analysis, sidequest generation
- **Backend**: Railway deployment integration
- **Improvements**: JSON parsing with cJSON, proper HTTP error handling

#### navigation_calc
- **Function**: Haversine distance and bearing calculations
- **Features**: High-precision navigation mathematics
- **Improvements**: Optimized floating-point calculations

#### touch_controller
- **Function**: XPT2046 touch controller driver
- **Features**: Coordinate mapping, touch event generation, interrupt-driven
- **Improvements**: Queue-based event system, calibration support

## Hardware Requirements

### ESP32-S3 DevKit
- **MCU**: ESP32-S3 with WiFi and Bluetooth
- **Flash**: Minimum 4MB
- **RAM**: 8MB PSRAM recommended

### TFT Display
- **Controller**: ILI9341 or compatible
- **Resolution**: 480x320 pixels
- **Interface**: SPI
- **Pins**: MISO(19), MOSI(23), CLK(18), CS(15), DC(2), RST(4), BL(21)

### Touch Controller
- **Controller**: XPT2046 or compatible
- **Interface**: SPI (shared with display)
- **Pins**: CS(5), IRQ(25)

### GPS Source
- **Method**: BLE connection to nRF Connect mobile app
- **Protocol**: Nordic UART Service (NUS)
- **Data Format**: NMEA sentences (GPGGA)

## Build Instructions

### Prerequisites
1. Install ESP-IDF v5.0 or later
2. Set up ESP-IDF environment
3. Configure target: `idf.py set-target esp32s3`

### Build Process
```bash
# Navigate to project directory
cd esp-idf-waypoint

# Configure project (optional - uses sdkconfig.defaults)
idf.py menuconfig

# Build project
idf.py build

# Flash to device
idf.py -p COM3 flash monitor
```

### Configuration Options
- **WiFi SSID/Password**: Modify in waypoint_compass_main.cpp
- **Backend URL**: Update BACKEND_URL in main file
- **Hardware Pins**: Adjust pin definitions in component headers

## System Operation

### Boot Sequence
1. **Initialization**: NVS, display, touch, BLE, WiFi
2. **Startup Screen**: 2-second logo display
3. **Main Menu**: Four-option interface
4. **Background Tasks**: GPS monitoring, backend connectivity

### Task Architecture
- **Main Task**: UI management and touch handling
- **GPS Task**: BLE data reception and NMEA parsing
- **Network Task**: Backend connectivity monitoring
- **Touch Task**: Touch event processing

### State Management
- **Menu State**: Location save, navigation, safety, sidequest options
- **Navigation State**: Real-time compass with bearing/distance
- **Safety State**: Risk analysis display
- **Sidequest State**: Adventure generation and navigation

## Integration with Backend

### API Endpoints
- `GET /health` - Connectivity test
- `POST /api/gps` - GPS data upload
- `POST /api/locations` - Save location
- `GET /api/locations` - Retrieve locations
- `GET /api/safety/analyze-location` - Safety analysis
- `POST /api/locations/sidequest` - Generate sidequest

### Data Synchronization
- **GPS Upload**: Automatic background transmission
- **Location Management**: On-demand save/retrieve
- **Safety Analysis**: Real-time location risk assessment
- **Sidequest Generation**: AI-powered adventure creation

## nRF Connect Setup

### Mobile App Configuration
1. Install nRF Connect for Mobile
2. Enable GPS location sharing
3. Connect to "WaypointCompass" BLE device
4. Select Nordic UART Service (NUS)
5. Enable GPS data transmission

### GPS Data Flow
1. **nRF Connect** → NMEA sentences → **ESP32 BLE**
2. **ESP32** → Parse coordinates → **Internal GPS data**
3. **Navigation System** → Calculate bearing/distance → **Display**
4. **Background Upload** → Send to backend → **Cloud storage**

## Debugging and Monitoring

### Serial Monitor
- **Baud Rate**: 115200
- **Log Levels**: INFO, WARN, ERROR, DEBUG
- **Components**: GPS, Display, Network, Touch, Navigation

### Performance Monitoring
- **Memory Usage**: FreeRTOS heap monitoring
- **Task Status**: Real-time task state
- **Network Latency**: HTTP response times
- **GPS Accuracy**: HDOP and fix quality

## Production Deployment

### Flash Configuration
- **Partition Table**: Default with OTA support
- **Bootloader**: Secure boot optional
- **Encryption**: Flash encryption for security

### Power Management
- **WiFi**: Automatic power saving mode
- **BLE**: Connection interval optimization
- **Display**: Backlight PWM control
- **Sleep Mode**: Deep sleep when inactive

## Comparison Summary

| Feature | Arduino IDE | ESP-IDF |
|---------|-------------|---------|
| Code Structure | Monolithic | Modular Components |
| Task Management | Single loop() | FreeRTOS Multi-tasking |
| Memory Protection | None | Mutex & Semaphores |
| Error Handling | Basic | Comprehensive |
| Debugging | Serial.print | ESP_LOG system |
| Build System | Arduino | CMake |
| Configuration | #define | Kconfig |
| Library Management | Arduino Library Manager | Component Registry |
| Flash Optimization | Basic | Advanced Partitioning |
| Professional Features | Limited | Full Embedded Framework |

The ESP-IDF version provides a robust, scalable, and maintainable foundation for the WaypointCompass system with professional embedded development practices.