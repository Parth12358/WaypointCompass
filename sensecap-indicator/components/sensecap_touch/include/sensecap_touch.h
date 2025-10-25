#pragma once

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

// SenseCAP Indicator touch pins (I2C)
#define SENSECAP_TOUCH_SDA_GPIO     6
#define SENSECAP_TOUCH_SCL_GPIO     7
#define SENSECAP_TOUCH_I2C_PORT     I2C_NUM_0
#define SENSECAP_TOUCH_I2C_ADDR     0x38

// FT6336U register addresses
#define FT6336U_REG_NUM_TOUCHES     0x02
#define FT6336U_REG_P1_XH           0x03
#define FT6336U_REG_P1_XL           0x04
#define FT6336U_REG_P1_YH           0x05
#define FT6336U_REG_P1_YL           0x06

// Function declarations
void sensecap_touch_init(void);
void sensecap_touch_read(lv_indev_drv_t *indev_drv, lv_indev_data_t *data);

#ifdef __cplusplus
}
#endif