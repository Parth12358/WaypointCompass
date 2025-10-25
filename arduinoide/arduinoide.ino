
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <TFT_eSPI.h>

const char* WIFI_SSID = "La Luna";
const char* WIFI_PASSWORD = "access";
const char* BACKEND_URL = "http://10.10.77.248:3000";

#define BUZZER_PIN 2
#define SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

TFT_eSPI tft = TFT_eSPI();
enum AppState {
  STATE_MENU,
  STATE_POINTING,
  STATE_SAFETY_WARNING,
  STATE_SIDEQUEST
};

AppState currentState = STATE_MENU;

struct GPSData {
  double latitude = 0.0;
  double longitude = 0.0;
  double altitude = 0.0;
  double accuracy = 0.0;
  bool valid = false;
  unsigned long lastUpdate = 0;
  String deviceId = "ESP32_Compass_001";
} currentGPS;

struct Target {
  String name = "";
  String id = "";
  double latitude = 0.0;
  double longitude = 0.0;
  bool active = false;
} currentTarget;

struct CompassData {
  float bearing = 0.0;
  float distance = 0.0;
  unsigned long lastUpdate = 0;
} compass;

struct SafetyData {
  float riskScore = 0.0;
  float timeRisk = 0.0;
  String warnings = "";
  String hazards = "";
  bool hasEmergencyServices = false;
  unsigned long lastCheck = 0;
} currentSafety;

struct SidequestData {
  String title = "";
  String description = "";
  String location = "";
  double targetLat = 0.0;
  double targetLng = 0.0;
  bool active = false;
  String difficulty = "";
} currentSidequest;

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
bool gpsDataReceived = false;

#define TOUCH_THRESHOLD 40
uint16_t touchX, touchY;
unsigned long lastTouch = 0;
bool wifiConnected = false;
bool backendReachable = false;
unsigned long lastBackendCheck = 0;
String systemStatus = "Initializing...";
#define COLOR_SAFE 0x07E0
#define COLOR_WARNING 0xFFE0
#define COLOR_DANGER 0xF800
#define COLOR_MENU 0x001F
#define COLOR_SIDEQUEST 0x7C1F
#define COLOR_BACKGROUND 0x0000
#define COLOR_TEXT 0xFFFF
void sendGPSToBackend();
void testBackendConnectivity();
void updateCompass();
void checkLocationSafety();
void drawMainMenu();
void drawCompass();
void drawSafetyScreen();
void drawSidequestScreen();
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("BLE Client Connected");
  }
  
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("BLE Client Disconnected");
    BLEDevice::startAdvertising();
  }
};

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String data = pCharacteristic->getValue().c_str();
    
    if (data.length() > 0) {
      Serial.println("GPS: " + data);
      
      int firstComma = data.indexOf(',');
      if (firstComma > 0) {
        currentGPS.latitude = data.substring(0, firstComma).toDouble();
        
        int secondComma = data.indexOf(',', firstComma + 1);
        if (secondComma > 0) {
          currentGPS.longitude = data.substring(firstComma + 1, secondComma).toDouble();
          
          int thirdComma = data.indexOf(',', secondComma + 1);
          if (thirdComma > 0) {
            currentGPS.altitude = data.substring(secondComma + 1, thirdComma).toDouble();
            currentGPS.accuracy = data.substring(thirdComma + 1).toDouble();
          } else {
            currentGPS.altitude = data.substring(secondComma + 1).toDouble();
            currentGPS.accuracy = 5.0;
          }
        } else {
          currentGPS.longitude = data.substring(firstComma + 1).toDouble();
          currentGPS.altitude = 0.0;
          currentGPS.accuracy = 10.0;
        }
        
        currentGPS.valid = true;
        currentGPS.lastUpdate = millis();
        gpsDataReceived = true;
        
        Serial.println("GPS Updated");
        
        // Send GPS data to backend immediately for tracking and safety analysis
        if (wifiConnected && backendReachable) {
          sendGPSToBackend();
        }
      }
    }
  }
};

// SETUP
void setup() {
  Serial.begin(115200);
  Serial.println("Initializing...");
  
  // Simple startup beep
  pinMode(BUZZER_PIN, OUTPUT);
  tone(BUZZER_PIN, 1000, 300);
  delay(400);
  
  // Initialize Display
  tft.init();
  tft.setRotation(0);
  tft.fillScreen(COLOR_BACKGROUND);
  tft.setTextColor(COLOR_TEXT, COLOR_BACKGROUND);
  tft.setTextSize(2);
  
  displayBootScreen();
  
  // Initialize WiFi
  systemStatus = "Connecting WiFi...";
  displaySystemStatus();
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
    
    if (wifiAttempts % 5 == 0) {
      systemStatus = "WiFi attempt " + String(wifiAttempts) + "/30";
      displaySystemStatus();
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    systemStatus = "WiFi Connected: " + WiFi.localIP().toString();
    Serial.println("WiFi Connected");
    displaySystemStatus();
    
    // WiFi success beep
    tone(BUZZER_PIN, 1200, 200);
    delay(300);
    testBackendConnectivity();
  } else {
    wifiConnected = false;
    systemStatus = "WiFi Failed - Offline Mode";
    Serial.println("WiFi Failed");
    displaySystemStatus();
    tone(BUZZER_PIN, 400, 500);
    delay(600);
  }
  
  delay(1500);
  
  // Initialize BLE
  systemStatus = "Starting BLE...";
  displaySystemStatus();
  
  BLEDevice::init("WaypointCompass_ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  
  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  systemStatus = "BLE Ready - Connect nRF Connect";
  Serial.println("BLE Ready");
  displaySystemStatus();
  
  // BLE ready beep
  tone(BUZZER_PIN, 800, 300);
  delay(400);
  
  delay(1000);
  
  // Initialize system components
  currentGPS.deviceId = "ESP32_" + String((uint32_t)ESP.getEfuseMac(), HEX);
  
  // Show main menu
  currentState = STATE_MENU;
  drawMainMenu();
}

// MAIN LOOP
void loop() {
  unsigned long currentTime = millis();
  
  // GPS timeout check
  if (currentGPS.valid && (currentTime - currentGPS.lastUpdate > 60000)) {
    currentGPS.valid = false;
    gpsDataReceived = false;
    if (currentState == STATE_MENU) drawMainMenu();
  }
  
  // Backend check every 30s
  if (wifiConnected && (currentTime - lastBackendCheck > 30000)) {
    testBackendConnectivity();
    lastBackendCheck = currentTime;
  }
  
  // Handle touch input with debouncing
  #ifdef TOUCH_CS
  bool touched = tft.getTouch(&touchX, &touchY);
  if (touched && (currentTime - lastTouch > 300)) {
    lastTouch = currentTime;
    handleTouch(touchX, touchY);
  }
  #else
  // Alternative touch handling for boards without touch support
  // You can implement button-based navigation here if needed
  #endif
  
  // State-specific updates
  switch (currentState) {
    case STATE_POINTING:
      if (currentTarget.active && currentGPS.valid) {
        if (currentTime - compass.lastUpdate > 2000) {
          updateCompass();
          compass.lastUpdate = currentTime;
        }
      }
      break;
      
    case STATE_SAFETY_WARNING:
      if (currentTime - currentSafety.lastCheck > 10000) {
        checkLocationSafety();
      }
      break;
      
    case STATE_SIDEQUEST:
      if (currentSidequest.active) {
        drawSidequestScreen();
      }
      break;
      
    default:
      break;
  }
  
  delay(50);
}

// DISPLAY FUNCTIONS
void displayBootScreen() {
  tft.fillScreen(COLOR_BACKGROUND);
  tft.setTextSize(3);
  tft.setTextColor(COLOR_MENU);
  tft.setCursor(60, 200);
  tft.print("WAYPOINT\nCOMPASS");
  delay(1000);
}

void displaySystemStatus() {
  tft.fillScreen(COLOR_BACKGROUND);
  tft.setTextSize(2);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(20, 200);
  tft.print("Status:\n");
  tft.println(systemStatus);
}

void drawMainMenu() {
  tft.fillScreen(COLOR_BACKGROUND);
  
  // Title
  tft.setTextSize(2);
  tft.setTextColor(COLOR_MENU);
  tft.setCursor(20, 20);
  tft.println("WAYPOINT COMPASS");
  
  // Status
  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(20, 50);
  tft.print("WiFi:");
  tft.print(wifiConnected ? "OK" : "NO");
  tft.print(" BLE:");
  tft.println(deviceConnected ? "OK" : "NO");
  
  // GPS Status
  tft.setCursor(20, 70);
  if (currentGPS.valid) {
    tft.setTextColor(COLOR_SAFE);
    tft.printf("GPS: %.4f,%.4f", currentGPS.latitude, currentGPS.longitude);
  } else {
    tft.setTextColor(COLOR_DANGER);
    tft.println("GPS: Connect nRF Connect");
  }
  
  // Menu Buttons
  tft.fillRect(20, 120, 200, 40, COLOR_MENU);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(60, 135);
  tft.print("SAVE LOCATION");
  
  tft.fillRect(20, 170, 200, 40, COLOR_SAFE);
  tft.setCursor(60, 185);
  tft.print("NAVIGATE");
  
  tft.fillRect(20, 220, 200, 40, COLOR_WARNING);
  tft.setCursor(70, 235);
  tft.print("SAFETY");
  
  tft.fillRect(20, 270, 200, 40, COLOR_SIDEQUEST);
  tft.setCursor(60, 285);
  tft.print("SIDEQUEST");
}

void drawCompass() {
  tft.fillScreen(COLOR_BACKGROUND);
  
  // Header with target info
  tft.setTextSize(2);
  tft.setTextColor(COLOR_SAFE);
  tft.setCursor(20, 20);
  tft.print("TO: ");
  tft.setTextColor(COLOR_TEXT);
  tft.print(currentTarget.name);
  
  // Safety indicator in header
  if (currentSafety.riskScore > 0) {
    uint16_t safetyColor = (currentSafety.riskScore <= 2.0) ? COLOR_SAFE : 
                          (currentSafety.riskScore <= 3.5) ? COLOR_WARNING : COLOR_DANGER;
    tft.setCursor(320, 20);
    tft.setTextColor(safetyColor);
    tft.printf("Risk: %.1f", currentSafety.riskScore);
  }
  
  int centerX = 240;
  int centerY = 220;
  int radius = 120;
  
  // Draw compass background circle
  tft.fillCircle(centerX, centerY, radius + 5, 0x2104); // Dark background
  tft.drawCircle(centerX, centerY, radius, COLOR_TEXT);
  tft.drawCircle(centerX, centerY, radius - 2, COLOR_TEXT);
  
  // Cardinal directions
  tft.setTextSize(2);
  tft.setTextColor(COLOR_SAFE);
  tft.setCursor(centerX - 8, centerY - radius - 25);
  tft.print("N");
  tft.setCursor(centerX + radius + 8, centerY - 8);
  tft.print("E");
  tft.setCursor(centerX - 8, centerY + radius + 8);
  tft.print("S");
  tft.setCursor(centerX - radius - 25, centerY - 8);
  tft.print("W");
  
  // Draw bearing arrow
  if (compass.bearing >= 0) {
    float angleRad = compass.bearing * PI / 180.0;
    int arrowLen = 100;
    int tipX = centerX + arrowLen * sin(angleRad);
    int tipY = centerY - arrowLen * cos(angleRad);
    
    // Arrow shaft (thicker)
    tft.drawLine(centerX, centerY, tipX, tipY, COLOR_DANGER);
    tft.drawLine(centerX + 1, centerY, tipX + 1, tipY, COLOR_DANGER);
    tft.drawLine(centerX, centerY + 1, tipX, tipY + 1, COLOR_DANGER);
    
    // Arrow head
    int headLen = 25;
    float headAngle = PI / 5;
    int leftX = tipX - headLen * sin(angleRad - headAngle);
    int leftY = tipY + headLen * cos(angleRad - headAngle);
    int rightX = tipX - headLen * sin(angleRad + headAngle);
    int rightY = tipY + headLen * cos(angleRad + headAngle);
    
    tft.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY, COLOR_DANGER);
    
    // Bearing text
    tft.setTextSize(2);
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(centerX - 30, centerY + 40);
    tft.printf("%.0f°", compass.bearing);
  }
  
  // Distance display
  tft.setTextSize(3);
  tft.setTextColor(COLOR_SAFE);
  tft.setCursor(120, 380);
  if (compass.distance < 1.0) {
    tft.printf("%.0f m", compass.distance * 1000);
  } else {
    tft.printf("%.2f km", compass.distance);
  }
  
  // GPS accuracy
  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(180, 420);
  tft.printf("GPS: ±%.1fm", currentGPS.accuracy);
  
  // Control buttons
  tft.fillRect(20, 450, 100, 30, 0x39C4);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(40, 458);
  tft.print("BACK");
  
  tft.fillRect(360, 450, 100, 30, COLOR_WARNING);
  tft.setCursor(375, 458);
  tft.print("SAFETY");
}

void drawSafetyScreen() {
  tft.fillScreen(COLOR_BACKGROUND);
  
  tft.setTextSize(2);
  tft.setTextColor(COLOR_WARNING);
  tft.setCursor(20, 20);
  tft.print("SAFETY CHECK");
  
  if (currentSafety.riskScore >= 0) {
    uint16_t riskColor = (currentSafety.riskScore <= 2.0) ? COLOR_SAFE : 
                        (currentSafety.riskScore <= 3.5) ? COLOR_WARNING : COLOR_DANGER;
    
    tft.setTextSize(3);
    tft.setTextColor(riskColor);
    tft.setCursor(20, 60);
    tft.printf("Risk: %.1f/5", currentSafety.riskScore);
    
    if (currentSafety.riskScore <= 2.0) {
      tft.setTextColor(COLOR_SAFE);
      tft.setCursor(20, 100);
      tft.print("SAFE");
    } else if (currentSafety.riskScore <= 3.5) {
      tft.setTextColor(COLOR_WARNING);
      tft.setCursor(20, 100);
      tft.print("MODERATE");
    } else {
      tft.setTextColor(COLOR_DANGER);
      tft.setCursor(20, 100);
      tft.print("HIGH RISK");
    }
  } else {
    tft.setTextSize(2);
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(20, 100);
    tft.print("No data");
  }
}

void drawSidequestScreen() {
  tft.fillScreen(COLOR_BACKGROUND);
  
  tft.setTextSize(2);
  tft.setTextColor(COLOR_SIDEQUEST);
  tft.setCursor(20, 20);
  tft.print("SIDEQUEST");
  
  if (currentSidequest.active) {
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(20, 60);
    tft.print(currentSidequest.title.substring(0, 30));
    
    tft.setTextSize(1);
    tft.setCursor(20, 90);
    tft.print(currentSidequest.description.substring(0, 150));
    
    tft.setTextSize(2);
    tft.setCursor(20, 150);
    tft.setTextColor(COLOR_SAFE);
    tft.print(currentSidequest.location.substring(0, 25));
    
    if (currentGPS.valid && currentSidequest.targetLat != 0) {
      float distance = calculateDistance(currentGPS.latitude, currentGPS.longitude,
                                       currentSidequest.targetLat, currentSidequest.targetLng);
      tft.setCursor(20, 180);
      tft.setTextColor(COLOR_TEXT);
      if (distance < 1.0) {
        tft.printf("%.0f m", distance * 1000);
      } else {
        tft.printf("%.2f km", distance);
      }
    }
    
    tft.fillRect(20, 220, 100, 30, COLOR_SAFE);
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(35, 230);
    tft.print("NAVIGATE");
    
  } else {
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(20, 100);
    tft.print("Generate adventure!");
    
    tft.fillRect(20, 150, 120, 30, COLOR_SIDEQUEST);
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(35, 160);
    tft.print("GENERATE");
  }
}

// TOUCH HANDLING
void handleTouch(uint16_t x, uint16_t y) {
  switch (currentState) {
    case STATE_MENU:
      if (y >= 120 && y <= 160) {
        // Save Location
        if (currentGPS.valid) saveCurrentLocation();
      } else if (y >= 170 && y <= 210) {
        // Navigate
        selectTargetLocation();
      } else if (y >= 220 && y <= 260) {
        // Safety Check
        currentState = STATE_SAFETY_WARNING;
        checkLocationSafety();
      } else if (y >= 270 && y <= 310) {
        // Sidequest
        currentState = STATE_SIDEQUEST;
        if (!currentSidequest.active) {
          generateSidequest();
        } else {
          drawSidequestScreen();
        }
      }
      break;
      
    case STATE_POINTING:
      // Back to menu
      currentState = STATE_MENU;
      currentTarget.active = false;
      drawMainMenu();
      break;
      
    case STATE_SAFETY_WARNING:
      // Back to menu
      currentState = STATE_MENU;
      drawMainMenu();
      break;
      
    case STATE_SIDEQUEST:
      if (currentSidequest.active) {
        if (y >= 400 && y <= 430) {
          // Navigate to sidequest
          currentTarget.name = currentSidequest.title;
          currentTarget.latitude = currentSidequest.targetLat;
          currentTarget.longitude = currentSidequest.targetLng;
          currentTarget.active = true;
          currentState = STATE_POINTING;
          updateCompass();
        }
      } else {
        if (y >= 250 && y <= 290) {
          // Generate new sidequest
          generateSidequest();
        }
      }
      // Any other touch goes back to menu
      if (y < 250 || y > 430) {
        currentState = STATE_MENU;
        drawMainMenu();
      }
      break;
  }
}

void showMessage(String message, uint16_t color, int duration) {
  tft.fillRect(50, 200, 380, 80, COLOR_BACKGROUND);
  tft.drawRect(50, 200, 380, 80, color);
  tft.setTextSize(2);
  tft.setTextColor(color);
  tft.setCursor(70, 230);
  tft.println(message);
  delay(duration);
  
  // Refresh current screen
  switch (currentState) {
    case STATE_MENU:
      drawMainMenu();
      break;
    case STATE_POINTING:
      drawCompass();
      break;
    case STATE_SAFETY_WARNING:
      drawSafetyScreen();
      break;
    case STATE_SIDEQUEST:
      drawSidequestScreen();
      break;
  }
}

// BACKEND API CALLS
void testBackendConnectivity() {
  if (!wifiConnected) {
    backendReachable = false;
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/health";
  http.begin(url);
  http.setTimeout(5000);
  
  int httpCode = http.GET();
  backendReachable = (httpCode == 200);
  
  // Backend status logged only on change
  
  http.end();
}

void sendGPSToBackend() {
  if (!wifiConnected || !backendReachable || !currentGPS.valid) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/gps";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  StaticJsonDocument<300> doc;
  doc["latitude"] = currentGPS.latitude;
  doc["longitude"] = currentGPS.longitude;
  doc["altitude"] = currentGPS.altitude;
  doc["accuracy"] = currentGPS.accuracy;
  doc["source"] = "ble";
  doc["deviceId"] = currentGPS.deviceId;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  // GPS send status omitted to save space
  
  http.end();
}

void saveCurrentLocation() {
  if (!currentGPS.valid) {
    showMessage("GPS data required!", COLOR_DANGER, 2000);
    return;
  }
  
  if (!wifiConnected || !backendReachable) {
    showMessage("Backend offline!", COLOR_DANGER, 2000);
    return;
  }
  
  showMessage("Saving location...", COLOR_WARNING, 1000);
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/locations";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  StaticJsonDocument<400> doc;
  doc["name"] = "ESP32 Waypoint " + String(millis() / 1000);
  doc["description"] = "Saved from WaypointCompass ESP32 device";
  doc["latitude"] = currentGPS.latitude;
  doc["longitude"] = currentGPS.longitude;
  doc["category"] = "waypoint";
  doc["source"] = "esp32";
  doc["deviceId"] = currentGPS.deviceId;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200 || httpCode == 201) {
    showMessage("Location saved!", COLOR_SAFE, 2000);
  } else {
    showMessage("Save failed", COLOR_DANGER, 2000);
  }
  
  http.end();
}

void selectTargetLocation() {
  if (!wifiConnected || !backendReachable) {
    showMessage("Backend offline!", COLOR_DANGER, 2000);
    return;
  }
  
  showMessage("Fetching locations...", COLOR_WARNING, 1000);
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/locations";
  http.begin(url);
  http.setTimeout(10000);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      showMessage("Parse error!", COLOR_DANGER, 2000);
      return;
    }
    
    JsonArray locations;
    if (doc.containsKey("data")) {
      locations = doc["data"].as<JsonArray>();
    } else {
      locations = doc.as<JsonArray>();
    }
    
    if (locations.size() > 0) {
      // For now, use the first available location
      // TODO: Implement location selection screen
      JsonObject loc = locations[0];
      currentTarget.name = loc["name"].as<String>();
      currentTarget.id = loc["_id"].as<String>();
      currentTarget.latitude = loc["latitude"];
      currentTarget.longitude = loc["longitude"];
      currentTarget.active = true;
      

      
      currentState = STATE_POINTING;
      updateCompass();
      drawCompass();
    } else {
      showMessage("No saved locations!", COLOR_WARNING, 2000);
    }
  } else {
    showMessage("Fetch failed: " + String(httpCode), COLOR_DANGER, 2000);
  }
  
  http.end();
}

void generateSidequest() {
  if (!currentGPS.valid) {
    showMessage("GPS required for sidequest!", COLOR_DANGER, 2000);
    return;
  }
  
  if (!wifiConnected || !backendReachable) {
    showMessage("Backend offline!", COLOR_DANGER, 2000);
    return;
  }
  
  showMessage("Generating adventure...", COLOR_SIDEQUEST, 2000);
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/locations/sidequest";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);
  
  StaticJsonDocument<300> doc;
  doc["latitude"] = currentGPS.latitude;
  doc["longitude"] = currentGPS.longitude;
  doc["radius"] = 2000; // 2km radius
  doc["difficulty"] = "moderate";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument responseDoc(2048);
    DeserializationError error = deserializeJson(responseDoc, payload);
    
    if (!error) {
      JsonObject data = responseDoc["data"];
      currentSidequest.title = data["title"].as<String>();
      currentSidequest.description = data["description"].as<String>();
      currentSidequest.location = data["location"]["name"].as<String>();
      currentSidequest.targetLat = data["location"]["latitude"];
      currentSidequest.targetLng = data["location"]["longitude"];
      currentSidequest.difficulty = data["difficulty"].as<String>();
      currentSidequest.active = true;
      

      drawSidequestScreen();
    } else {
      showMessage("Parse error!", COLOR_DANGER, 2000);
    }
  } else {
    showMessage("Generation failed: " + String(httpCode), COLOR_DANGER, 2000);
  }
  
  http.end();
}

// completeSidequest function removed - handled inline to save space

void checkLocationSafety() {
  if (!currentGPS.valid) {
    showMessage("GPS required for safety check!", COLOR_DANGER, 2000);
    return;
  }
  
  if (!wifiConnected || !backendReachable) {
    showMessage("Backend offline!", COLOR_DANGER, 2000);
    return;
  }
  
  showMessage("Analyzing safety...", COLOR_WARNING, 1000);
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/safety/analyze-location";
  url += "?lat=" + String(currentGPS.latitude, 6);
  url += "&lng=" + String(currentGPS.longitude, 6);
  http.begin(url);
  http.setTimeout(15000);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument responseDoc(3072);
    DeserializationError error = deserializeJson(responseDoc, payload);
    
    if (!error) {
      JsonObject data = responseDoc["data"];
      currentSafety.riskScore = data["riskScore"];
      currentSafety.timeRisk = data["timeRisk"];
      currentSafety.warnings = data["warnings"].as<String>();
      currentSafety.hazards = data["hazards"].as<String>();
      currentSafety.hasEmergencyServices = data["emergencyServices"]["nearby"];
      currentSafety.lastCheck = millis();
      

      drawSafetyScreen();
    } else {
      showMessage("Parse error!", COLOR_DANGER, 2000);
    }
  } else {
    showMessage("Safety check failed: " + String(httpCode), COLOR_DANGER, 2000);
  }
  
  http.end();
}

// Emergency services function removed to save space

void updateCompass() {
  if (!currentGPS.valid || !currentTarget.active) return;
  
  // Calculate bearing and distance locally (more responsive)
  compass.bearing = calculateBearing(currentGPS.latitude, currentGPS.longitude,
                                   currentTarget.latitude, currentTarget.longitude);
  compass.distance = calculateDistance(currentGPS.latitude, currentGPS.longitude,
                                     currentTarget.latitude, currentTarget.longitude);
  

  
  drawCompass();
}

// HELPER FUNCTIONS
double toRadians(double degrees) {
  return degrees * PI / 180.0;
}

double toDegrees(double radians) {
  return radians * 180.0 / PI;
}

// Haversine distance calculation
float calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371.0; // Earth's radius in kilometers
  
  double dLat = toRadians(lat2 - lat1);
  double dLon = toRadians(lon2 - lon1);
  
  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(toRadians(lat1)) * cos(toRadians(lat2)) *
             sin(dLon / 2) * sin(dLon / 2);
  
  double c = 2 * atan2(sqrt(a), sqrt(1 - a));
  
  return R * c; // Distance in kilometers
}

// Calculate bearing to target
float calculateBearing(double lat1, double lon1, double lat2, double lon2) {
  double dLon = toRadians(lon2 - lon1);
  double lat1Rad = toRadians(lat1);
  double lat2Rad = toRadians(lat2);
  
  double y = sin(dLon) * cos(lat2Rad);
  double x = cos(lat1Rad) * sin(lat2Rad) - sin(lat1Rad) * cos(lat2Rad) * cos(dLon);
  
  double bearingRad = atan2(y, x);
  double bearingDeg = toDegrees(bearingRad);
  
  // Normalize 0-360
  return fmod((bearingDeg + 360.0), 360.0);
}

