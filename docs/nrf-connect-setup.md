# iPhone GPS via nRF Connect Setup Guide

This guide explains how to use the nRF Connect app on iPhone to send GPS coordinates to your ESP32 Compass.

## Prerequisites
- iPhone with nRF Connect app installed (free from App Store)
- ESP32 running the compass firmware
- Backend server running

## Step 1: Download nRF Connect
1. Open App Store on iPhone
2. Search for "nRF Connect for Mobile"
3. Download and install the Nordic Semiconductor app

## Step 2: ESP32 Setup
1. Flash the ESP32 with the compass firmware
2. The ESP32 will advertise as "ESP32-Compass"
3. Note the BLE service UUID: `12345678-1234-1234-1234-123456789abc`

## Step 3: Connect to ESP32
1. Open nRF Connect app
2. Tap "SCAN" at the bottom
3. Look for "ESP32-Compass" in the device list
4. Tap "CONNECT" next to your ESP32

## Step 4: Find the GPS Characteristic
1. Once connected, you'll see the services list
2. Look for service UUID: `12345678-1234-1234-1234-123456789abc`
3. Expand the service
4. Find characteristic: `87654321-4321-4321-4321-cba987654321`

## Step 5: Send GPS Coordinates
1. Tap the "↑" (write) button next to the characteristic
2. Select "TEXT" format
3. Enter your GPS coordinates in format: `latitude,longitude`
   - Example: `37.7749,-122.4194` (San Francisco)
4. Tap "SEND"

## Step 6: Verify Data Flow
1. Check ESP32 serial monitor - should show received GPS data
2. ESP32 will automatically send coordinates to backend
3. Backend returns compass bearing and distance
4. Compass display updates on ESP32 screen

## GPS Coordinate Sources
You can get your iPhone's GPS coordinates from:

### Option A: iPhone Settings
1. Settings > Privacy & Security > Location Services
2. System Services > Significant Locations
3. Find recent locations with coordinates

### Option B: Maps App
1. Open Apple Maps
2. Long-press on your current location
3. Tap the dropped pin
4. Coordinates will be shown at the bottom

### Option C: GPS Apps
- Install a GPS coordinate app from App Store
- Many show live lat/lng coordinates
- Copy/paste into nRF Connect

### Option D: Automated Script (Advanced)
You could create an iPhone Shortcut to:
1. Get current GPS coordinates
2. Format as "lat,lng"
3. Copy to clipboard
4. Paste into nRF Connect

## Data Format
- Format: `latitude,longitude`
- Latitude: -90 to +90 (negative = South)
- Longitude: -180 to +180 (negative = West)
- Use decimal degrees (not degrees/minutes/seconds)
- Examples:
  - `40.7128,-74.0060` (New York City)
  - `51.5074,-0.1278` (London)
  - `35.6762,139.6503` (Tokyo)

## Troubleshooting

### ESP32 Not Appearing
- Ensure ESP32 is powered on and running
- Check serial monitor for "BLE server started" message
- Try restarting nRF Connect app

### Connection Issues
- Make sure you're close to the ESP32 (within ~10 meters)
- Restart both ESP32 and nRF Connect if needed
- Check ESP32 serial monitor for connection messages

### GPS Data Not Working
- Verify coordinate format: `lat,lng` with comma separator
- Check ESP32 serial output for parsing errors
- Ensure backend server is running and accessible

### No Compass Response
- Check ESP32 WiFi connection
- Verify backend server URL in ESP32 code
- Check backend logs for incoming requests
- Ensure you have an active target set via backend API

## Tips for Best Experience
1. **Update Frequently**: Send new GPS coordinates every few seconds while moving
2. **Stay Connected**: Keep nRF Connect app open and connected
3. **Battery Optimization**: BLE uses minimal power but keep devices charged
4. **Range**: Stay within BLE range (~10m) of ESP32
5. **Accuracy**: iPhone GPS is accurate to ~3-5 meters outdoors

## Security Notes
- This setup transmits GPS coordinates over BLE (short range)
- Data is sent to your own backend server
- No third-party services involved in GPS transmission
- Consider encryption for sensitive applications