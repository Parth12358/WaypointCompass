/*
 * ESP32 Compass BLE + HTTP Example
 * 
 * This demonstrates how the ESP32 would:
 * 1. Receive GPS coordinates from iPhone via BLE (using nRF Connect)
 * 2. Send coordinates to backend and get compass bearing
 * 3. Display compass on 480x480 screen
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend server
const char* serverURL = "http://your-backend-url.com/api/gps/compass";

// GPS Update Configuration (in milliseconds)
const int GPS_UPDATE_INTERVAL = 500;    // 500ms = 2 updates per second (high frequency)
const int GPS_CHECK_INTERVAL = 100;     // Check for new GPS data every 100ms
const bool ENABLE_CONTINUOUS_UPDATES = true; // Send updates even if GPS hasn't changed

// Timing variables
unsigned long lastGPSUpdate = 0;
unsigned long lastGPSCheck = 0;

// BLE setup for GPS data from iPhone
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
double currentLatitude = 0.0;
double currentLongitude = 0.0;
bool hasValidGPS = false;

// BLE Service and Characteristic UUIDs (you can generate your own)
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "87654321-4321-4321-4321-cba987654321"

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("BLE Device connected");
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("BLE Device disconnected");
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue();
      
      if (value.length() > 0) {
        Serial.println("Received GPS data: " + value);
        
        // Parse GPS data (expected format: "lat,lng")
        int commaIndex = value.indexOf(',');
        if (commaIndex > 0) {
          double newLat = value.substring(0, commaIndex).toDouble();
          double newLng = value.substring(commaIndex + 1).toDouble();
          
          // Check if GPS coordinates have changed significantly (optional optimization)
          double latDiff = abs(newLat - currentLatitude);
          double lngDiff = abs(newLng - currentLongitude);
          
          if (latDiff > 0.00001 || lngDiff > 0.00001 || ENABLE_CONTINUOUS_UPDATES) {
            currentLatitude = newLat;
            currentLongitude = newLng;
            hasValidGPS = true;
            
            Serial.printf("GPS Updated: %.6f, %.6f\n", currentLatitude, currentLongitude);
          }
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  // Initialize WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("WiFi connected!");
  Serial.println("IP address: " + WiFi.localIP().toString());
  
  // Initialize BLE
  BLEDevice::init("ESP32-Compass");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_WRITE
                    );
  
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE server started. Ready to receive GPS data from iPhone!");
  Serial.println("Connect with nRF Connect app and send GPS coordinates as 'lat,lng'");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check for new GPS data frequently
  if (currentTime - lastGPSCheck >= GPS_CHECK_INTERVAL) {
    lastGPSCheck = currentTime;
    
    // Process GPS if we have valid data and WiFi is connected
    if (hasValidGPS && WiFi.status() == WL_CONNECTED) {
      // Check if enough time has passed since last update
      if (currentTime - lastGPSUpdate >= GPS_UPDATE_INTERVAL) {
        getCompassData();
        lastGPSUpdate = currentTime;
        
        if (!ENABLE_CONTINUOUS_UPDATES) {
          hasValidGPS = false; // Reset flag if not doing continuous updates
        }
      }
    }
  }
  
  // Small delay to prevent excessive CPU usage
  delay(10);
}

void getCompassData() {
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["latitude"] = currentLatitude;
  doc["longitude"] = currentLongitude;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending GPS to backend: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Backend response: " + response);
    
    // Parse response
    DynamicJsonDocument responseDoc(2048);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"]) {
      bool hasTarget = responseDoc["data"]["hasTarget"];
      
      if (hasTarget) {
        int bearing = responseDoc["data"]["compass"]["bearing"];
        int distance = responseDoc["data"]["compass"]["distance"];
        String targetName = responseDoc["data"]["target"]["name"];
        bool canComplete = responseDoc["data"]["compass"]["canComplete"];
        
        Serial.printf("Target: %s\n", targetName.c_str());
        Serial.printf("Bearing: %d degrees\n", bearing);
        Serial.printf("Distance: %d meters\n", distance);
        
        if (canComplete) {
          Serial.println("*** TARGET REACHED! ***");
          // You could call completion endpoint here
        }
        
        // Display compass on your 480x480 screen
        displayCompass(bearing, distance, targetName, canComplete);
        
      } else {
        Serial.println("No target set");
        displayNoTarget();
      }
    } else {
      Serial.println("Error from backend: " + String(responseDoc["error"].as<const char*>()));
    }
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
  }
  
  http.end();
}

void displayCompass(int bearing, int distance, String targetName, bool canComplete) {
  // This is where you'd draw the compass on your 480x480 display
  Serial.println("=== COMPASS DISPLAY ===");
  Serial.printf("Target: %s\n", targetName.c_str());
  Serial.printf("Direction: %d°\n", bearing);
  Serial.printf("Distance: %dm\n", distance);
  
  if (canComplete) {
    Serial.println("🎯 TARGET REACHED!");
  }
  
  // TODO: Implement actual display drawing
  // - Draw compass rose
  // - Draw arrow pointing at bearing
  // - Display distance and target name
  // - Show completion status if close enough
}

void displayNoTarget() {
  Serial.println("=== NO TARGET ===");
  Serial.println("Set a target using the backend API");
  
  // TODO: Display "No Target" message on screen
}