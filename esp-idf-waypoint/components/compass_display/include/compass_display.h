#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Color definitions (RGB565 format)
#define COLOR_BACKGROUND    0x0000  // Black
#define COLOR_TEXT          0xFFFF  // White
#define COLOR_SAFE          0x07E0  // Green
#define COLOR_WARNING       0xFFE0  // Yellow
#define COLOR_DANGER        0xF800  // Red
#define COLOR_SIDEQUEST     0x7FF   // Cyan
#define COLOR_MENU          0x841F  // Purple

// Display dimensions
#define DISPLAY_WIDTH       480
#define DISPLAY_HEIGHT      320

// Data structures
typedef struct {
    double latitude;
    double longitude;
    double altitude;
    float accuracy;
    bool valid;
    char device_id[32];
} gps_data_t;

typedef struct {
    char name[64];
    char id[32];
    double latitude;
    double longitude;
    bool active;
} target_data_t;

typedef struct {
    float bearing;
    float distance;
    bool valid;
} compass_data_t;

typedef struct {
    float risk_score;
    char time_risk[32];
    char warnings[256];
    char hazards[256];
    bool has_emergency_services;
    uint32_t last_check;
} safety_data_t;

typedef struct {
    char title[128];
    char description[256];
    char location[128];
    double target_lat;
    double target_lng;
    char difficulty[32];
    bool active;
} sidequest_data_t;

// Function declarations
void compass_display_init(void);
void compass_display_show_startup(void);
void compass_display_draw_menu(void);
void compass_display_draw_compass(const compass_data_t *compass, const target_data_t *target);
void compass_display_draw_safety(const safety_data_t *safety);
void compass_display_draw_sidequest(const sidequest_data_t *sidequest);
void compass_display_show_message(const char *message, uint16_t color, int duration_ms);

#ifdef __cplusplus
}
#endif