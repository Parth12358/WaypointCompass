#include "touch_controller.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include <string.h>

static const char *TAG = "TOUCH_CONTROLLER";

// Touch controller pins (XPT2046 compatible)
#define TOUCH_CS_PIN     5
#define TOUCH_IRQ_PIN    25
#define TOUCH_MISO_PIN   19
#define TOUCH_MOSI_PIN   23
#define TOUCH_CLK_PIN    18

// Touch commands
#define TOUCH_CMD_X      0x90
#define TOUCH_CMD_Y      0xD0

// Calibration values (adjust for your specific display)
#define TOUCH_X_MIN      200
#define TOUCH_X_MAX      3900
#define TOUCH_Y_MIN      200
#define TOUCH_Y_MAX      3900

// Display dimensions
#define DISPLAY_WIDTH    480
#define DISPLAY_HEIGHT   320

// Global variables
static spi_device_handle_t touch_spi_handle;
static QueueHandle_t touch_event_queue;
static bool touch_initialized = false;

// Internal functions
static void touch_init_spi(void);
static void IRAM_ATTR touch_isr_handler(void *arg);
static void touch_task(void *pvParameters);
static uint16_t touch_read_raw(uint8_t command);
static void touch_read_coordinates(uint16_t *x, uint16_t *y);
static uint16_t touch_map_coordinate(uint16_t raw, uint16_t raw_min, uint16_t raw_max, uint16_t display_max);

void touch_controller_init(void)
{
    ESP_LOGI(TAG, "Initializing touch controller...");
    
    // Initialize SPI for touch controller
    touch_init_spi();
    
    // Configure IRQ pin
    gpio_config_t io_conf = {};
    io_conf.intr_type = GPIO_INTR_NEGEDGE;
    io_conf.mode = GPIO_MODE_INPUT;
    io_conf.pin_bit_mask = (1ULL << TOUCH_IRQ_PIN);
    io_conf.pull_up_en = GPIO_PULLUP_ENABLE;
    gpio_config(&io_conf);
    
    // Create event queue
    touch_event_queue = xQueueCreate(10, sizeof(touch_event_t));
    
    // Install GPIO ISR service
    gpio_install_isr_service(0);
    gpio_isr_handler_add(TOUCH_IRQ_PIN, touch_isr_handler, NULL);
    
    // Create touch task
    xTaskCreate(touch_task, "touch_task", 4096, NULL, 5, NULL);
    
    touch_initialized = true;
    ESP_LOGI(TAG, "Touch controller initialized");
}

bool touch_controller_get_event(touch_event_t *event)
{
    if (!touch_initialized || !event) {
        return false;
    }
    
    return xQueueReceive(touch_event_queue, event, 0) == pdTRUE;
}

bool touch_controller_is_touched(void)
{
    if (!touch_initialized) {
        return false;
    }
    
    return gpio_get_level(TOUCH_IRQ_PIN) == 0;
}

static void touch_init_spi(void)
{
    spi_device_interface_config_t devcfg = {
        .clock_speed_hz = 2 * 1000 * 1000, // 2 MHz
        .mode = 0,
        .spics_io_num = TOUCH_CS_PIN,
        .queue_size = 1,
        .flags = 0,
    };
    
    ESP_ERROR_CHECK(spi_bus_add_device(SPI2_HOST, &devcfg, &touch_spi_handle));
}

static void IRAM_ATTR touch_isr_handler(void *arg)
{
    // Touch interrupt occurred - wake up touch task
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // Send a notification to touch task
    // (In a real implementation, you might use a more sophisticated approach)
    
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

static void touch_task(void *pvParameters)
{
    touch_event_t event;
    uint16_t last_x = 0, last_y = 0;
    bool was_touched = false;
    
    while (1) {
        bool is_touched = touch_controller_is_touched();
        
        if (is_touched) {
            uint16_t raw_x, raw_y;
            touch_read_coordinates(&raw_x, &raw_y);
            
            // Map raw coordinates to display coordinates
            uint16_t x = touch_map_coordinate(raw_x, TOUCH_X_MIN, TOUCH_X_MAX, DISPLAY_WIDTH);
            uint16_t y = touch_map_coordinate(raw_y, TOUCH_Y_MIN, TOUCH_Y_MAX, DISPLAY_HEIGHT);
            
            // Only report if coordinates changed significantly or this is a new touch
            if (!was_touched || abs(x - last_x) > 5 || abs(y - last_y) > 5) {
                event.x = x;
                event.y = y;
                event.pressed = true;
                event.timestamp = esp_log_timestamp();
                
                xQueueSend(touch_event_queue, &event, 0);
                
                ESP_LOGI(TAG, "Touch at (%d, %d)", x, y);
                
                last_x = x;
                last_y = y;
            }
            
            was_touched = true;
        } else {
            if (was_touched) {
                // Touch released
                event.x = last_x;
                event.y = last_y;
                event.pressed = false;
                event.timestamp = esp_log_timestamp();
                
                xQueueSend(touch_event_queue, &event, 0);
                
                ESP_LOGI(TAG, "Touch released at (%d, %d)", last_x, last_y);
            }
            
            was_touched = false;
        }
        
        vTaskDelay(pdMS_TO_TICKS(50)); // 20 Hz polling rate
    }
}

static uint16_t touch_read_raw(uint8_t command)
{
    uint8_t tx_data[3] = {command, 0x00, 0x00};
    uint8_t rx_data[3] = {0};
    
    spi_transaction_t trans = {
        .length = 24,
        .tx_buffer = tx_data,
        .rx_buffer = rx_data,
    };
    
    esp_err_t ret = spi_device_transmit(touch_spi_handle, &trans);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI transmission failed: %s", esp_err_to_name(ret));
        return 0;
    }
    
    // Combine the received bytes into a 12-bit value
    uint16_t result = ((rx_data[1] << 8) | rx_data[2]) >> 3;
    return result;
}

static void touch_read_coordinates(uint16_t *x, uint16_t *y)
{
    if (!x || !y) return;
    
    *x = touch_read_raw(TOUCH_CMD_X);
    vTaskDelay(pdMS_TO_TICKS(1)); // Small delay between readings
    *y = touch_read_raw(TOUCH_CMD_Y);
}

static uint16_t touch_map_coordinate(uint16_t raw, uint16_t raw_min, uint16_t raw_max, uint16_t display_max)
{
    if (raw < raw_min) raw = raw_min;
    if (raw > raw_max) raw = raw_max;
    
    return (uint16_t)(((uint32_t)(raw - raw_min) * display_max) / (raw_max - raw_min));
}