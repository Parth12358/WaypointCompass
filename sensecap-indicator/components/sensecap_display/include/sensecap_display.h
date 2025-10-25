#pragma once

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

// SenseCAP Indicator display pins
#define SENSECAP_LCD_DATA_WIDTH    16
#define SENSECAP_LCD_PCLK_GPIO     42
#define SENSECAP_LCD_HSYNC_GPIO    39
#define SENSECAP_LCD_VSYNC_GPIO    40
#define SENSECAP_LCD_DE_GPIO       41
#define SENSECAP_LCD_DISP_GPIO     38
#define SENSECAP_LCD_BL_GPIO       45

// Data pins (16-bit parallel)
#define SENSECAP_LCD_DATA0_GPIO    8
#define SENSECAP_LCD_DATA1_GPIO    9
#define SENSECAP_LCD_DATA2_GPIO    10
#define SENSECAP_LCD_DATA3_GPIO    11
#define SENSECAP_LCD_DATA4_GPIO    12
#define SENSECAP_LCD_DATA5_GPIO    13
#define SENSECAP_LCD_DATA6_GPIO    14
#define SENSECAP_LCD_DATA7_GPIO    15
#define SENSECAP_LCD_DATA8_GPIO    16
#define SENSECAP_LCD_DATA9_GPIO    17
#define SENSECAP_LCD_DATA10_GPIO   18
#define SENSECAP_LCD_DATA11_GPIO   19
#define SENSECAP_LCD_DATA12_GPIO   20
#define SENSECAP_LCD_DATA13_GPIO   21
#define SENSECAP_LCD_DATA14_GPIO   22
#define SENSECAP_LCD_DATA15_GPIO   23

// Display specifications
#define SENSECAP_LCD_WIDTH         480
#define SENSECAP_LCD_HEIGHT        480
#define SENSECAP_LCD_PIXEL_CLOCK   (10 * 1000 * 1000)

// Function declarations
void sensecap_display_init(void);
void sensecap_display_show_startup(void);
void sensecap_display_set_backlight(uint8_t brightness);
void sensecap_display_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p);

#ifdef __cplusplus
}
#endif