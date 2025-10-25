# 📱 WaypointCompass Display Menu System

## 🎯 **Menu Structure Overview**

The ESP32 display provides a complete user interface for the WaypointCompass system with touch navigation.

### **Main Menu Options**

```
🧭 WaypointCompass
┌─────────────────────────────────────┐
│ 📍 Save Location                    │
│ Mark current GPS position           │
├─────────────────────────────────────┤
│ 🧭 Point to Location               │
│ Select target destination           │
├─────────────────────────────────────┤
│ ❓ Mystery Adventure                │
│ Discover random landmark            │
├─────────────────────────────────────┤
│ ⚙️ Settings                        │
│ WiFi, GPS, Display options          │
└─────────────────────────────────────┘
```

## 🔧 **Menu Functions**

### **1. 📍 Save Location**
- Captures current GPS coordinates
- Allows user to name the location
- Saves to backend database via API
- Shows confirmation message
- **Requirements**: Active GPS signal

**Flow:**
1. Touch "Save Location"
2. System checks GPS signal
3. If GPS available → Save with timestamp name
4. Send POST to `/api/locations`
5. Show success/failure message
6. Return to main menu

### **2. 🧭 Point to Location**
- Shows list of saved locations
- User selects target destination
- Sets as active compass target
- Switches to compass mode

**Flow:**
1. Touch "Point to Location"
2. GET `/api/locations` from backend
3. Display location list with touch navigation
4. User selects location
5. POST to `/api/target/set`
6. Switch to compass mode
7. Begin real-time compass updates

### **3. ❓ Mystery Adventure**
- Starts random sidequest
- Uses OpenStreetMap landmarks
- Keeps destination secret until arrival
- Switches to compass mode

**Flow:**
1. Touch "Mystery Adventure"
2. POST to `/api/sidequest/start` with current GPS
3. Backend discovers nearby landmarks
4. Sets random landmark as target
5. Show "adventure started" message
6. Switch to compass mode
7. Follow compass to mystery destination

### **4. ⚙️ Settings**
- WiFi configuration
- GPS source selection
- Display brightness
- Calibration options

## 🧭 **Compass Mode Interface**

```
        🧭 Compass
    Target: Mystery Location
      Distance: 290m

         N
         ↑
    W ←  ●  → E    267°
         ↓
         S
         
    Follow the needle to your destination
    
    [← Menu]
```

### **Compass Features:**
- **Live bearing calculation** (updates every 500ms)
- **Distance to target** in meters
- **Visual compass needle** pointing to destination
- **Cardinal directions** (N, S, E, W)
- **Numeric bearing display** (0-359°)
- **Target name display** (hidden for mysteries)

## 🎮 **Touch Navigation**

### **Touch Areas:**
- **Menu Items**: Full width touch zones (20px margins)
- **Back Buttons**: Bottom-left corner (100x40px)
- **Compass**: Tap anywhere to return to menu
- **Location List**: Individual location touch zones

### **Visual Feedback:**
- **Highlight Effect**: Selected items show blue border
- **Color Coding**: 
  - Green: Save/Success actions
  - Cyan: Navigation actions  
  - Magenta: Mystery/Adventure
  - Orange: Settings/Config
  - Red: Errors/Warnings

## 📐 **Display Layout (480x480)**

```
┌─────────────────────────────────────┐ ← Header (0-80px)
│         🧭 WaypointCompass          │
│    GPS: 37.7749, -122.4194         │
├─────────────────────────────────────┤ ← Menu Area (80-400px)
│                                     │
│    [Menu Item 1: 80px height]      │
│    [Menu Item 2: 80px height]      │
│    [Menu Item 3: 80px height]      │
│    [Menu Item 4: 80px height]      │
│                                     │
├─────────────────────────────────────┤ ← Footer (400-480px)
│         Touch to select             │
│                                     │
└─────────────────────────────────────┘
```

## 🔄 **State Management**

### **Menu States:**
- `MAIN_MENU`: Primary navigation
- `LOCATION_LIST`: Saved locations display
- `COMPASS_MODE`: Live compass interface
- `SETTINGS_MENU`: Configuration options
- `CREATING_LOCATION`: Location save process
- `MYSTERY_ACTIVE`: Adventure mode

### **State Transitions:**
```
MAIN_MENU → LOCATION_LIST (Point to Location)
MAIN_MENU → COMPASS_MODE (After target set)
MAIN_MENU → MYSTERY_ACTIVE (Mystery Adventure)
LOCATION_LIST → COMPASS_MODE (Location selected)
COMPASS_MODE → MAIN_MENU (Back button)
```

## 🎨 **Visual Design**

### **Color Scheme:**
```cpp
#define BACKGROUND_COLOR TFT_BLACK      // Main background
#define MENU_COLOR TFT_DARKGREY         // Menu item backgrounds
#define SELECTED_COLOR TFT_BLUE         // Selection highlight
#define TEXT_COLOR TFT_WHITE            // Primary text
#define ACCENT_COLOR TFT_GREEN          // Success/Save actions
#define DANGER_COLOR TFT_RED            // Errors/warnings
```

### **Typography:**
- **Headers**: Size 2, Accent Color
- **Menu Items**: Size 2, White text
- **Subtitles**: Size 1, Light grey
- **Compass Bearing**: Size 3, Accent Color

## 🔌 **Hardware Requirements**

### **Display:**
- **480x480 TFT LCD** with touch capability
- **SPI interface** (TFT_eSPI library)
- **Touch controller** (resistive or capacitive)

### **Controls:**
- **Touch screen** for all navigation
- **No physical buttons required**
- **Haptic feedback** (optional vibration motor)

## 📊 **Performance Specifications**

### **Update Frequencies:**
- **GPS Data**: 1000ms intervals
- **Compass Updates**: 500ms in compass mode
- **Touch Polling**: 50ms for responsiveness
- **Display Refresh**: On-demand (state changes only)

### **Memory Usage:**
- **Menu Items**: ~200 bytes per item
- **Location List**: ~1KB for 10 locations
- **Graphics Buffer**: Built into TFT_eSPI library
- **JSON Parsing**: 2KB buffer for API responses

## 🚀 **Integration Points**

### **Backend API Calls:**
- `GET /api/locations` - Retrieve saved locations
- `POST /api/locations` - Save new location
- `POST /api/target/set` - Set compass target
- `POST /api/sidequest/start` - Begin mystery adventure
- `POST /api/gps/compass` - Get compass bearing/distance

### **Data Flow:**
1. **GPS Source**: iPhone → nRF Connect → ESP32 BLE
2. **Location Storage**: ESP32 → WiFi → Backend → MongoDB
3. **Compass Calculation**: Backend math → ESP32 display
4. **Mystery Discovery**: OpenStreetMap → Backend → ESP32

This complete menu system provides intuitive touch navigation for all WaypointCompass features while maintaining the mystery and adventure aspects of the sidequests! 🧭✨