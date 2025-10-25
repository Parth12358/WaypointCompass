#include "compass_display.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>
#include <math.h>

static const char *TAG = "COMPASS_DISPLAY";

// TFT Display pins (adjust for your hardware)
#define TFT_MISO    19
#define TFT_MOSI    23
#define TFT_SCLK    18
#define TFT_CS      15
#define TFT_DC      2
#define TFT_RST     4
#define TFT_BL      21

// SPI configuration
static spi_device_handle_t spi_handle;

// Display buffer
static uint16_t display_buffer[DISPLAY_WIDTH * DISPLAY_HEIGHT];

// Internal functions
static void tft_init_pins(void);
static void tft_init_spi(void);
static void tft_send_command(uint8_t cmd);
static void tft_send_data(uint8_t data);
static void tft_send_data16(uint16_t data);
static void tft_set_addr_window(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);
static void tft_fill_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color);
static void tft_draw_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color);
static void tft_draw_pixel(uint16_t x, uint16_t y, uint16_t color);
static void tft_draw_line(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
static void tft_draw_circle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
static void tft_fill_circle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
static void tft_print_text(uint16_t x, uint16_t y, const char *text, uint16_t color, uint8_t size);
static void tft_clear_screen(uint16_t color);

void compass_display_init(void)
{
    ESP_LOGI(TAG, "Initializing TFT display...");
    
    tft_init_pins();
    tft_init_spi();
    
    // Reset display
    gpio_set_level(TFT_RST, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(TFT_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(120));
    
    // Initialize display (ILI9341 commands)
    tft_send_command(0x01); // Software reset
    vTaskDelay(pdMS_TO_TICKS(5));
    
    tft_send_command(0x11); // Sleep out
    vTaskDelay(pdMS_TO_TICKS(120));
    
    tft_send_command(0x3A); // Pixel format
    tft_send_data(0x55);    // 16-bit color
    
    tft_send_command(0x36); // Memory access control
    tft_send_data(0x08);    // Row/column exchange
    
    tft_send_command(0x29); // Display on
    vTaskDelay(pdMS_TO_TICKS(100));
    
    // Turn on backlight
    gpio_set_level(TFT_BL, 1);
    
    // Clear screen
    tft_clear_screen(COLOR_BACKGROUND);
    
    ESP_LOGI(TAG, "TFT display initialized");
}

void compass_display_show_startup(void)
{
    tft_clear_screen(COLOR_BACKGROUND);
    
    // Draw startup logo/text
    tft_print_text(140, 100, "WaypointCompass", COLOR_TEXT, 3);
    tft_print_text(180, 140, "ESP-IDF", COLOR_SAFE, 2);
    tft_print_text(160, 180, "Initializing...", COLOR_WARNING, 2);
    
    // Draw a simple compass icon
    tft_draw_circle(240, 220, 30, COLOR_TEXT);
    tft_fill_circle(240, 220, 25, COLOR_BACKGROUND);
    tft_draw_line(240, 195, 240, 245, COLOR_DANGER); // N-S line
    tft_draw_line(215, 220, 265, 220, COLOR_TEXT);   // E-W line
    tft_print_text(235, 185, "N", COLOR_DANGER, 2);
}

void compass_display_draw_menu(void)
{
    tft_clear_screen(COLOR_BACKGROUND);
    
    // Title
    tft_print_text(160, 30, "WAYPOINT COMPASS", COLOR_TEXT, 2);
    tft_print_text(200, 60, "Main Menu", COLOR_TEXT, 1);
    
    // Menu items
    tft_draw_rect(50, 120, 380, 40, COLOR_MENU);
    tft_print_text(70, 135, "Save Current Location", COLOR_TEXT, 2);
    
    tft_draw_rect(50, 170, 380, 40, COLOR_MENU);
    tft_print_text(70, 185, "Navigate to Saved Location", COLOR_TEXT, 2);
    
    tft_draw_rect(50, 220, 380, 40, COLOR_WARNING);
    tft_print_text(70, 235, "Safety Check", COLOR_TEXT, 2);
    
    tft_draw_rect(50, 270, 380, 40, COLOR_SIDEQUEST);
    tft_print_text(70, 285, "Generate Sidequest", COLOR_TEXT, 2);
}

void compass_display_draw_compass(const compass_data_t *compass, const target_data_t *target)
{
    if (!compass || !target) return;
    
    tft_clear_screen(COLOR_BACKGROUND);
    
    // Title
    tft_print_text(160, 20, "NAVIGATION", COLOR_TEXT, 2);
    
    // Target information
    char info_text[64];
    snprintf(info_text, sizeof(info_text), "Target: %.16s", target->name);
    tft_print_text(50, 50, info_text, COLOR_SAFE, 1);
    
    snprintf(info_text, sizeof(info_text), "Distance: %.2f km", compass->distance);
    tft_print_text(50, 70, info_text, COLOR_TEXT, 1);
    
    snprintf(info_text, sizeof(info_text), "Bearing: %.0f°", compass->bearing);
    tft_print_text(50, 90, info_text, COLOR_TEXT, 1);
    
    // Draw compass
    int center_x = 240;
    int center_y = 180;
    int radius = 80;
    
    // Outer circle
    tft_draw_circle(center_x, center_y, radius, COLOR_TEXT);
    
    // Cardinal directions
    tft_print_text(center_x - 5, center_y - radius - 20, "N", COLOR_DANGER, 2);
    tft_print_text(center_x + radius + 10, center_y - 5, "E", COLOR_TEXT, 2);
    tft_print_text(center_x - 5, center_y + radius + 10, "S", COLOR_TEXT, 2);
    tft_print_text(center_x - radius - 15, center_y - 5, "W", COLOR_TEXT, 2);
    
    // Bearing arrow
    float bearing_rad = compass->bearing * M_PI / 180.0;
    int arrow_x = center_x + (radius - 10) * sin(bearing_rad);
    int arrow_y = center_y - (radius - 10) * cos(bearing_rad);
    
    tft_draw_line(center_x, center_y, arrow_x, arrow_y, COLOR_SAFE);
    tft_fill_circle(arrow_x, arrow_y, 5, COLOR_SAFE);
    
    // Center dot
    tft_fill_circle(center_x, center_y, 3, COLOR_TEXT);
    
    // Instructions
    tft_print_text(160, 280, "Touch to return to menu", COLOR_TEXT, 1);
}

void compass_display_draw_safety(const safety_data_t *safety)
{
    if (!safety) return;
    
    tft_clear_screen(COLOR_BACKGROUND);
    
    // Title
    tft_print_text(180, 20, "SAFETY ANALYSIS", COLOR_DANGER, 2);
    
    // Risk score
    char risk_text[64];
    snprintf(risk_text, sizeof(risk_text), "Risk Score: %.1f/10", safety->risk_score);
    uint16_t risk_color = safety->risk_score < 3.0 ? COLOR_SAFE : 
                         (safety->risk_score < 7.0 ? COLOR_WARNING : COLOR_DANGER);
    tft_print_text(50, 60, risk_text, risk_color, 2);
    
    // Time risk
    snprintf(risk_text, sizeof(risk_text), "Time Risk: %s", safety->time_risk);
    tft_print_text(50, 90, risk_text, COLOR_TEXT, 1);
    
    // Emergency services
    const char *emergency_text = safety->has_emergency_services ? 
                                "Emergency services nearby" : 
                                "No emergency services nearby";
    uint16_t emergency_color = safety->has_emergency_services ? COLOR_SAFE : COLOR_WARNING;
    tft_print_text(50, 110, emergency_text, emergency_color, 1);
    
    // Warnings (truncated for display)
    tft_print_text(50, 140, "Warnings:", COLOR_WARNING, 1);
    char warning_display[100];
    strncpy(warning_display, safety->warnings, 99);
    warning_display[99] = '\0';
    tft_print_text(50, 160, warning_display, COLOR_TEXT, 1);
    
    // Hazards (truncated for display)
    tft_print_text(50, 200, "Hazards:", COLOR_DANGER, 1);
    char hazard_display[100];
    strncpy(hazard_display, safety->hazards, 99);
    hazard_display[99] = '\0';
    tft_print_text(50, 220, hazard_display, COLOR_TEXT, 1);
    
    // Instructions
    tft_print_text(160, 280, "Touch to return to menu", COLOR_TEXT, 1);
}

void compass_display_draw_sidequest(const sidequest_data_t *sidequest)
{
    if (!sidequest) return;
    
    tft_clear_screen(COLOR_BACKGROUND);
    
    // Title
    tft_print_text(180, 20, "SIDEQUEST", COLOR_SIDEQUEST, 2);
    
    if (sidequest->active) {
        // Quest title
        char title_display[50];
        strncpy(title_display, sidequest->title, 49);
        title_display[49] = '\0';
        tft_print_text(50, 60, title_display, COLOR_SIDEQUEST, 1);
        
        // Location
        char location_display[50];
        strncpy(location_display, sidequest->location, 49);
        location_display[49] = '\0';
        tft_print_text(50, 80, location_display, COLOR_TEXT, 1);
        
        // Difficulty
        char difficulty_text[32];
        snprintf(difficulty_text, sizeof(difficulty_text), "Difficulty: %s", sidequest->difficulty);
        tft_print_text(50, 100, difficulty_text, COLOR_WARNING, 1);
        
        // Description (truncated)
        tft_print_text(50, 130, "Description:", COLOR_TEXT, 1);
        char desc_line1[60], desc_line2[60];
        strncpy(desc_line1, sidequest->description, 59);
        desc_line1[59] = '\0';
        
        if (strlen(sidequest->description) > 59) {
            strncpy(desc_line2, sidequest->description + 59, 59);
            desc_line2[59] = '\0';
            tft_print_text(50, 150, desc_line2, COLOR_TEXT, 1);
        }
        tft_print_text(50, 170, desc_line1, COLOR_TEXT, 1);
        
        // Navigate button
        tft_draw_rect(50, 200, 380, 40, COLOR_SAFE);
        tft_print_text(180, 215, "Navigate to Sidequest", COLOR_TEXT, 1);
    } else {
        tft_print_text(100, 100, "No active sidequest", COLOR_TEXT, 2);
        tft_draw_rect(50, 150, 380, 40, COLOR_SIDEQUEST);
        tft_print_text(160, 165, "Generate New Sidequest", COLOR_TEXT, 1);
    }
    
    // Instructions
    tft_print_text(160, 280, "Touch to return to menu", COLOR_TEXT, 1);
}

void compass_display_show_message(const char *message, uint16_t color, int duration_ms)
{
    if (!message) return;
    
    // Save area behind message
    // (In a full implementation, you'd save the screen area)
    
    // Draw message box
    tft_fill_rect(50, 200, 380, 80, COLOR_BACKGROUND);
    tft_draw_rect(50, 200, 380, 80, color);
    tft_print_text(70, 230, message, color, 2);
    
    // Wait for duration
    vTaskDelay(pdMS_TO_TICKS(duration_ms));
    
    // Clear message area
    tft_fill_rect(50, 200, 380, 80, COLOR_BACKGROUND);
}

// Internal TFT functions
static void tft_init_pins(void)
{
    gpio_config_t io_conf = {};
    
    // Configure control pins
    io_conf.intr_type = GPIO_INTR_DISABLE;
    io_conf.mode = GPIO_MODE_OUTPUT;
    io_conf.pin_bit_mask = (1ULL << TFT_DC) | (1ULL << TFT_RST) | (1ULL << TFT_BL);
    io_conf.pull_down_en = 0;
    io_conf.pull_up_en = 0;
    gpio_config(&io_conf);
    
    // Set initial states
    gpio_set_level(TFT_RST, 1);
    gpio_set_level(TFT_DC, 0);
    gpio_set_level(TFT_BL, 0);
}

static void tft_init_spi(void)
{
    spi_bus_config_t buscfg = {
        .miso_io_num = TFT_MISO,
        .mosi_io_num = TFT_MOSI,
        .sclk_io_num = TFT_SCLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = DISPLAY_WIDTH * DISPLAY_HEIGHT * 2
    };
    
    spi_device_interface_config_t devcfg = {
        .clock_speed_hz = 26 * 1000 * 1000, // 26 MHz
        .mode = 0,
        .spics_io_num = TFT_CS,
        .queue_size = 7,
        .flags = 0,
    };
    
    ESP_ERROR_CHECK(spi_bus_initialize(SPI2_HOST, &buscfg, SPI_DMA_CH_AUTO));
    ESP_ERROR_CHECK(spi_bus_add_device(SPI2_HOST, &devcfg, &spi_handle));
}

static void tft_send_command(uint8_t cmd)
{
    gpio_set_level(TFT_DC, 0); // Command mode
    
    spi_transaction_t trans = {
        .length = 8,
        .tx_buffer = &cmd,
    };
    spi_device_transmit(spi_handle, &trans);
}

static void tft_send_data(uint8_t data)
{
    gpio_set_level(TFT_DC, 1); // Data mode
    
    spi_transaction_t trans = {
        .length = 8,
        .tx_buffer = &data,
    };
    spi_device_transmit(spi_handle, &trans);
}

static void tft_send_data16(uint16_t data)
{
    gpio_set_level(TFT_DC, 1); // Data mode
    
    uint8_t data_bytes[2] = {(data >> 8) & 0xFF, data & 0xFF};
    spi_transaction_t trans = {
        .length = 16,
        .tx_buffer = data_bytes,
    };
    spi_device_transmit(spi_handle, &trans);
}

static void tft_set_addr_window(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1)
{
    tft_send_command(0x2A); // Column address set
    tft_send_data(x0 >> 8);
    tft_send_data(x0 & 0xFF);
    tft_send_data(x1 >> 8);
    tft_send_data(x1 & 0xFF);
    
    tft_send_command(0x2B); // Row address set
    tft_send_data(y0 >> 8);
    tft_send_data(y0 & 0xFF);
    tft_send_data(y1 >> 8);
    tft_send_data(y1 & 0xFF);
    
    tft_send_command(0x2C); // Memory write
}

static void tft_fill_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color)
{
    if (x >= DISPLAY_WIDTH || y >= DISPLAY_HEIGHT) return;
    if (x + w > DISPLAY_WIDTH) w = DISPLAY_WIDTH - x;
    if (y + h > DISPLAY_HEIGHT) h = DISPLAY_HEIGHT - y;
    
    tft_set_addr_window(x, y, x + w - 1, y + h - 1);
    
    gpio_set_level(TFT_DC, 1); // Data mode
    
    uint32_t pixels = w * h;
    uint8_t color_bytes[2] = {(color >> 8) & 0xFF, color & 0xFF};
    
    for (uint32_t i = 0; i < pixels; i++) {
        spi_transaction_t trans = {
            .length = 16,
            .tx_buffer = color_bytes,
        };
        spi_device_transmit(spi_handle, &trans);
    }
}

static void tft_draw_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color)
{
    // Draw four lines to form rectangle
    for (uint16_t i = 0; i < w; i++) {
        tft_draw_pixel(x + i, y, color);         // Top
        tft_draw_pixel(x + i, y + h - 1, color); // Bottom
    }
    for (uint16_t i = 0; i < h; i++) {
        tft_draw_pixel(x, y + i, color);         // Left
        tft_draw_pixel(x + w - 1, y + i, color); // Right
    }
}

static void tft_draw_pixel(uint16_t x, uint16_t y, uint16_t color)
{
    if (x >= DISPLAY_WIDTH || y >= DISPLAY_HEIGHT) return;
    
    tft_set_addr_window(x, y, x, y);
    tft_send_data16(color);
}

static void tft_draw_line(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color)
{
    // Bresenham's line algorithm
    int16_t dx = abs(x1 - x0);
    int16_t dy = abs(y1 - y0);
    int16_t sx = x0 < x1 ? 1 : -1;
    int16_t sy = y0 < y1 ? 1 : -1;
    int16_t err = dx - dy;
    
    while (true) {
        tft_draw_pixel(x0, y0, color);
        
        if (x0 == x1 && y0 == y1) break;
        
        int16_t e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
}

static void tft_draw_circle(int16_t x0, int16_t y0, int16_t r, uint16_t color)
{
    int16_t x = r;
    int16_t y = 0;
    int16_t err = 0;
    
    while (x >= y) {
        tft_draw_pixel(x0 + x, y0 + y, color);
        tft_draw_pixel(x0 + y, y0 + x, color);
        tft_draw_pixel(x0 - y, y0 + x, color);
        tft_draw_pixel(x0 - x, y0 + y, color);
        tft_draw_pixel(x0 - x, y0 - y, color);
        tft_draw_pixel(x0 - y, y0 - x, color);
        tft_draw_pixel(x0 + y, y0 - x, color);
        tft_draw_pixel(x0 + x, y0 - y, color);
        
        if (err <= 0) {
            y += 1;
            err += 2 * y + 1;
        }
        if (err > 0) {
            x -= 1;
            err -= 2 * x + 1;
        }
    }
}

static void tft_fill_circle(int16_t x0, int16_t y0, int16_t r, uint16_t color)
{
    for (int16_t y = -r; y <= r; y++) {
        for (int16_t x = -r; x <= r; x++) {
            if (x * x + y * y <= r * r) {
                tft_draw_pixel(x0 + x, y0 + y, color);
            }
        }
    }
}

static void tft_print_text(uint16_t x, uint16_t y, const char *text, uint16_t color, uint8_t size)
{
    // Simple 8x8 font rendering (simplified implementation)
    // In a full implementation, you would include a proper font renderer
    uint16_t char_width = 8 * size;
    uint16_t char_height = 8 * size;
    
    for (int i = 0; text[i] != '\0'; i++) {
        // Draw character background
        tft_fill_rect(x + i * char_width, y, char_width, char_height, COLOR_BACKGROUND);
        
        // Simple character rendering (just rectangles for demo)
        // In real implementation, use proper font bitmaps
        if (text[i] != ' ') {
            tft_fill_rect(x + i * char_width + 1, y + 1, char_width - 2, char_height - 2, color);
        }
    }
}

static void tft_clear_screen(uint16_t color)
{
    tft_fill_rect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT, color);
}