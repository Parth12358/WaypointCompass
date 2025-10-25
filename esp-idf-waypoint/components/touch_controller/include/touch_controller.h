#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Touch event structure
typedef struct {
    uint16_t x;
    uint16_t y;
    bool pressed;
    uint32_t timestamp;
} touch_event_t;

// Function declarations
void touch_controller_init(void);
bool touch_controller_get_event(touch_event_t *event);
bool touch_controller_is_touched(void);

#ifdef __cplusplus
}
#endif