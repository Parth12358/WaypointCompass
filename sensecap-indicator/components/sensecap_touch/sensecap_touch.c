#include "sensecap_touch.h"
#include "driver/i2c.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "SENSECAP_TOUCH";

// I2C configuration
#define I2C_MASTER_SCL_IO          SENSECAP_TOUCH_SCL_GPIO
#define I2C_MASTER_SDA_IO          SENSECAP_TOUCH_SDA_GPIO
#define I2C_MASTER_NUM             SENSECAP_TOUCH_I2C_PORT
#define I2C_MASTER_FREQ_HZ         400000
#define I2C_MASTER_TX_BUF_DISABLE  0
#define I2C_MASTER_RX_BUF_DISABLE  0
#define I2C_MASTER_TIMEOUT_MS      1000

// Touch state
typedef struct {
    bool touched;
    uint16_t x;
    uint16_t y;
} touch_data_t;

static touch_data_t touch_data = {0};

// Internal functions
static esp_err_t ft6336u_read_reg(uint8_t reg_addr, uint8_t *data, size_t len);
static esp_err_t ft6336u_write_reg(uint8_t reg_addr, uint8_t data);

void sensecap_touch_init(void)
{
    ESP_LOGI(TAG, "Initializing SenseCAP touch controller...");
    
    // Configure I2C
    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ_HZ,
    };
    
    esp_err_t ret = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C param config failed: %s", esp_err_to_name(ret));
        return;
    }
    
    ret = i2c_driver_install(I2C_MASTER_NUM, conf.mode, I2C_MASTER_RX_BUF_DISABLE, I2C_MASTER_TX_BUF_DISABLE, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C driver install failed: %s", esp_err_to_name(ret));
        return;
    }
    
    // Test communication with FT6336U
    uint8_t test_data;
    ret = ft6336u_read_reg(FT6336U_REG_NUM_TOUCHES, &test_data, 1);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "FT6336U touch controller detected");
    } else {
        ESP_LOGE(TAG, "Failed to communicate with FT6336U: %s", esp_err_to_name(ret));
    }
    
    // Register touch input device with LVGL
    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = sensecap_touch_read;
    lv_indev_drv_register(&indev_drv);
    
    ESP_LOGI(TAG, "SenseCAP touch controller initialized");
}

void sensecap_touch_read(lv_indev_drv_t *indev_drv, lv_indev_data_t *data)
{
    uint8_t touch_count = 0;
    esp_err_t ret = ft6336u_read_reg(FT6336U_REG_NUM_TOUCHES, &touch_count, 1);
    
    data->state = LV_INDEV_STATE_REL;
    
    if (ret == ESP_OK && touch_count > 0) {
        // Read first touch point coordinates
        uint8_t touch_regs[4];
        ret = ft6336u_read_reg(FT6336U_REG_P1_XH, touch_regs, 4);
        
        if (ret == ESP_OK) {
            uint16_t x = ((touch_regs[0] & 0x0F) << 8) | touch_regs[1];
            uint16_t y = ((touch_regs[2] & 0x0F) << 8) | touch_regs[3];
            
            // Check if coordinates are valid
            if (x < 480 && y < 480) {
                data->point.x = x;
                data->point.y = y;
                data->state = LV_INDEV_STATE_PR;
                
                touch_data.touched = true;
                touch_data.x = x;
                touch_data.y = y;
                
                ESP_LOGD(TAG, "Touch detected at (%d, %d)", x, y);
            }
        }
    } else {
        touch_data.touched = false;
    }
}

static esp_err_t ft6336u_read_reg(uint8_t reg_addr, uint8_t *data, size_t len)
{
    return i2c_master_write_read_device(I2C_MASTER_NUM, SENSECAP_TOUCH_I2C_ADDR, 
                                        &reg_addr, 1, data, len, 
                                        I2C_MASTER_TIMEOUT_MS / portTICK_PERIOD_MS);
}

static esp_err_t ft6336u_write_reg(uint8_t reg_addr, uint8_t data)
{
    uint8_t write_buf[2] = {reg_addr, data};
    return i2c_master_write_to_device(I2C_MASTER_NUM, SENSECAP_TOUCH_I2C_ADDR, 
                                      write_buf, sizeof(write_buf), 
                                      I2C_MASTER_TIMEOUT_MS / portTICK_PERIOD_MS);
}