# WaypointCompass for SenseCAP Indicator

This is an ESP-IDF adaptation of the WaypointCompass project specifically for the SenseCAP Indicator D1 device.

## SenseCAP Indicator D1 Specifications

### Hardware Features
- **MCU**: ESP32-S3-WROOM-1-N16R8 (16MB Flash, 8MB PSRAM)
- **Display**: 4-inch IPS LCD, 480×480 resolution, capacitive touch
- **Connectivity**: WiFi 802.11 b/g/n, Bluetooth 5.0 LE, LoRa 863-928MHz
- **Sensors**: Grove interface for external sensors
- **Power**: 3.7V Li-ion battery with charging circuit
- **Enclosure**: IP54 rated for outdoor use

### Display Controller
- **Driver**: ST7701S with LVGL support
- **Interface**: RGB parallel interface (not SPI)
- **Touch**: FT6336U capacitive touch controller (I2C)
- **Brightness**: Software controlled backlight

### Pin Configuration (SenseCAP Indicator)
```
Display (RGB Interface):
- DATA: GPIO 8-23 (16-bit parallel)
- PCLK: GPIO 42
- HSYNC: GPIO 39  
- VSYNC: GPIO 40
- DE: GPIO 41
- DISP: GPIO 38 (enable)
- BL: GPIO 45 (backlight)

Touch (I2C):
- SDA: GPIO 6
- SCL: GPIO 7

LoRa Module:
- SPI_MISO: GPIO 11
- SPI_MOSI: GPIO 10
- SPI_SCLK: GPIO 12
- CS: GPIO 13
- RST: GPIO 14
- BUSY: GPIO 21
- DIO1: GPIO 33

Grove Connector:
- SDA: GPIO 4
- SCL: GPIO 5
- D0: GPIO 1
- D1: GPIO 2
```

## Key Differences from Generic ESP32 Build

### 1. Display Driver
- **Generic ESP32**: SPI interface with ILI9341
- **SenseCAP**: RGB parallel interface with ST7701S

### 2. Touch Controller  
- **Generic ESP32**: SPI-based XPT2046 resistive touch
- **SenseCAP**: I2C-based FT6336U capacitive touch

### 3. Additional Features
- **LoRa radio**: For long-range communication
- **Battery management**: Built-in charging and power management
- **Grove connector**: For sensor expansion

## Project Structure

```
sensecap-indicator/
├── CMakeLists.txt
├── sdkconfig.sensecap
├── main/
│   ├── CMakeLists.txt
│   └── sensecap_waypoint_main.cpp
└── components/
    ├── sensecap_display/      # LVGL-based display driver
    ├── sensecap_touch/        # FT6336U I2C touch driver
    ├── gps_handler/           # BLE GPS (same as original)
    ├── network_manager/       # HTTP client (same as original)
    ├── navigation_calc/       # Math functions (same as original)
    └── lora_handler/          # Optional LoRa communication
```

## Configuration for SenseCAP Indicator

### Build Commands
```bash
# Set target to ESP32-S3
idf.py set-target esp32s3

# Use SenseCAP specific config
cp sdkconfig.sensecap sdkconfig

# Build for SenseCAP
idf.py build

# Flash to device
idf.py -p COMx flash monitor
```

### Display Configuration
The SenseCAP Indicator uses LVGL (Light and Versatile Graphics Library) instead of TFT_eSPI:

```c
// Display initialization
lv_init();
lv_disp_drv_init(&disp_drv);
disp_drv.flush_cb = sensecap_display_flush;
disp_drv.buffer = &disp_buf;
lv_disp_drv_register(&disp_drv);
```

### Touch Configuration
Capacitive touch via I2C instead of SPI resistive:

```c
// Touch initialization
ft6336u_init(GPIO_6, GPIO_7); // SDA, SCL
lv_indev_drv_init(&indev_drv);
indev_drv.type = LV_INDEV_TYPE_POINTER;
indev_drv.read_cb = sensecap_touch_read;
lv_indev_drv_register(&indev_drv);
```

## Advantages of SenseCAP Indicator

### 1. Professional Hardware
- **Rugged design**: IP54 rated enclosure
- **Battery powered**: 3.7V Li-ion with charging
- **High-quality display**: 4-inch IPS with better viewing angles
- **Capacitive touch**: More responsive than resistive

### 2. Additional Connectivity
- **LoRa radio**: Long-range communication (up to 10km)
- **Grove connector**: Easy sensor integration
- **Better antenna**: Improved WiFi/BLE range

### 3. Software Ecosystem
- **LVGL support**: Professional GUI framework
- **SenseCAP ecosystem**: Integration with SenseCAP sensors
- **Battery management**: Built-in power optimization

## Implementation Strategy

### Phase 1: Core Functionality
1. Port display driver to LVGL
2. Implement FT6336U touch driver
3. Adapt main application logic
4. Test basic GPS and navigation

### Phase 2: SenseCAP Specific Features
1. Add LoRa communication option
2. Implement battery monitoring
3. Add Grove sensor support
4. Optimize for power efficiency

### Phase 3: Advanced Features
1. LoRa mesh networking
2. Offline map caching
3. Solar charging support
4. Multi-device coordination

## Code Adaptation Notes

### Display Differences
```c
// Original TFT_eSPI approach:
tft.fillScreen(COLOR_BLACK);
tft.drawString("WaypointCompass", 100, 50);

// LVGL approach for SenseCAP:
lv_obj_set_style_bg_color(lv_scr_act(), lv_color_black(), 0);
lv_label_create(lv_scr_act());
lv_label_set_text(label, "WaypointCompass");
lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 50);
```

### Touch Handling
```c
// Original resistive touch:
bool touched = tft.getTouch(&x, &y);

// Capacitive touch via LVGL:
// Handled automatically by LVGL input device driver
// Touch events delivered via LVGL callbacks
```

### Power Management
```c
// SenseCAP specific power features:
sensecap_battery_get_level();    // Get battery percentage
sensecap_battery_get_voltage();  // Get battery voltage
sensecap_sleep_enable();         // Enter low power mode
sensecap_wake_on_touch();        // Wake on touch event
```

## Getting Started

### Prerequisites
1. **ESP-IDF v5.0+**: Latest ESP-IDF framework
2. **SenseCAP Indicator D1**: Hardware device
3. **USB-C cable**: For programming and power
4. **SenseCAP Studio**: Optional development environment

### Quick Setup
1. Clone this directory
2. Install ESP-IDF and set up environment
3. Connect SenseCAP Indicator via USB-C
4. Run build and flash commands
5. Monitor via serial console

### Development Environment
- **Primary**: ESP-IDF with VS Code
- **Alternative**: SenseCAP Studio (Seeed's IDE)
- **Debugging**: JTAG via built-in debugger
- **Monitoring**: Serial console + SenseCAP Cloud

## Migration Path

### From Arduino IDE Version
1. **Keep logic**: Core navigation and GPS handling
2. **Replace display**: TFT_eSPI → LVGL
3. **Replace touch**: XPT2046 → FT6336U
4. **Add features**: LoRa, battery, Grove sensors

### From Generic ESP-IDF Version
1. **Update display component**: RGB parallel + LVGL
2. **Update touch component**: I2C capacitive
3. **Add SenseCAP components**: LoRa, battery, Grove
4. **Update pin configurations**: SenseCAP specific

The SenseCAP Indicator provides a more professional hardware platform with better durability, battery life, and connectivity options for your WaypointCompass project!