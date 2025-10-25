#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "compass_display.h" // For gps_data_t

#ifdef __cplusplus
extern "C" {
#endif

// BLE GPS Service UUIDs (Nordic UART Service for nRF Connect compatibility)
#define GPS_SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define GPS_CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

// Function declarations
void gps_handler_init(void);
gps_data_t gps_handler_get_data(void);
bool gps_handler_is_connected(void);
void gps_handler_start_scan(void);
void gps_handler_stop_scan(void);

#ifdef __cplusplus
}
#endif