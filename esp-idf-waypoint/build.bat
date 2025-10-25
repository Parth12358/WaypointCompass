@echo off
echo WaypointCompass ESP-IDF Build Script
echo =====================================

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
echo Building project...
idf.py build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Build successful!
    echo.
    echo To flash to device, connect ESP32-S3 and run:
    echo   idf.py -p COMx flash monitor
    echo.
    echo Replace COMx with your device's COM port
) else (
    echo.
    echo ✗ Build failed!
    echo Check the output above for error details
)

pause