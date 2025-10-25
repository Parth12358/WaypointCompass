@echo off
echo SenseCAP Indicator WaypointCompass Build Script
echo ==============================================

echo Checking ESP-IDF environment...
if "%IDF_PATH%"=="" (
    echo ERROR: ESP-IDF environment not set up!
    echo Please run install.bat and export.bat from ESP-IDF installation
    pause
    exit /b 1
)

echo IDF_PATH: %IDF_PATH%
echo.

echo Setting target to ESP32-S3...
idf.py set-target esp32s3

echo.
echo Copying SenseCAP configuration...
copy sdkconfig.sensecap sdkconfig

echo.
echo Building SenseCAP WaypointCompass...
idf.py build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build successful!
    echo.
    echo SenseCAP Indicator WaypointCompass is ready!
    echo.
    echo To flash to SenseCAP Indicator:
    echo   1. Connect SenseCAP Indicator via USB-C
    echo   2. Put device in download mode (if needed)
    echo   3. Run: idf.py -p COMx flash monitor
    echo.
    echo Replace COMx with your device's COM port
    echo.
    echo SenseCAP Indicator Features:
    echo ✅ 4-inch 480x480 IPS display
    echo ✅ Capacitive touch screen
    echo ✅ LVGL professional UI
    echo ✅ Built-in battery and charging
    echo ✅ IP54 weatherproof rating
    echo ✅ LoRa radio for long-range communication
    echo ✅ Grove connector for sensors
) else (
    echo.
    echo ❌ Build failed!
    echo Check the output above for error details
    echo.
    echo Common issues:
    echo - ESP-IDF not properly set up
    echo - Missing LVGL component
    echo - Incorrect target configuration
)

pause