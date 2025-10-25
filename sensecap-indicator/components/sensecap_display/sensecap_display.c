#include "sensecap_display.h"
#include "driver/gpio.h"
#include "esp_lcd_panel_rgb.h"
#include "esp_lcd_panel_ops.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "SENSECAP_DISPLAY";

// LVGL display objects
static lv_disp_draw_buf_t disp_buf;
static lv_disp_drv_t disp_drv;
static lv_color_t *buf1;
static lv_color_t *buf2;
static esp_lcd_panel_handle_t panel_handle = NULL;

void sensecap_display_init(void)
{
    ESP_LOGI(TAG, "Initializing SenseCAP Indicator display...");
    
    // Configure RGB LCD panel
    esp_lcd_rgb_panel_config_t panel_config = {
        .data_width = SENSECAP_LCD_DATA_WIDTH,
        .psram_trans_align = 64,
        .num_fbs = 2,
        .clk_src = LCD_CLK_SRC_PLL160M,
        .disp_gpio_num = SENSECAP_LCD_DISP_GPIO,
        .pclk_gpio_num = SENSECAP_LCD_PCLK_GPIO,
        .vsync_gpio_num = SENSECAP_LCD_VSYNC_GPIO,
        .hsync_gpio_num = SENSECAP_LCD_HSYNC_GPIO,
        .de_gpio_num = SENSECAP_LCD_DE_GPIO,
        .data_gpio_nums = {
            SENSECAP_LCD_DATA0_GPIO, SENSECAP_LCD_DATA1_GPIO, SENSECAP_LCD_DATA2_GPIO, SENSECAP_LCD_DATA3_GPIO,
            SENSECAP_LCD_DATA4_GPIO, SENSECAP_LCD_DATA5_GPIO, SENSECAP_LCD_DATA6_GPIO, SENSECAP_LCD_DATA7_GPIO,
            SENSECAP_LCD_DATA8_GPIO, SENSECAP_LCD_DATA9_GPIO, SENSECAP_LCD_DATA10_GPIO, SENSECAP_LCD_DATA11_GPIO,
            SENSECAP_LCD_DATA12_GPIO, SENSECAP_LCD_DATA13_GPIO, SENSECAP_LCD_DATA14_GPIO, SENSECAP_LCD_DATA15_GPIO,
        },
        .timings = {
            .pclk_hz = SENSECAP_LCD_PIXEL_CLOCK,
            .h_res = SENSECAP_LCD_WIDTH,
            .v_res = SENSECAP_LCD_HEIGHT,
            .hsync_back_porch = 8,
            .hsync_front_porch = 8,
            .hsync_pulse_width = 4,
            .vsync_back_porch = 8,
            .vsync_front_porch = 8,
            .vsync_pulse_width = 4,
            .flags.pclk_active_neg = false,
        },
        .flags.fb_in_psram = true,
    };
    
    ESP_ERROR_CHECK(esp_lcd_new_rgb_panel(&panel_config, &panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel_handle));
    
    // Configure backlight GPIO
    gpio_config_t bk_gpio_config = {
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = 1ULL << SENSECAP_LCD_BL_GPIO
    };
    ESP_ERROR_CHECK(gpio_config(&bk_gpio_config));
    
    // Turn on backlight
    sensecap_display_set_backlight(255);
    
    // Initialize LVGL display buffer
    buf1 = heap_caps_malloc(SENSECAP_LCD_WIDTH * 50 * sizeof(lv_color_t), MALLOC_CAP_DMA);
    assert(buf1);
    buf2 = heap_caps_malloc(SENSECAP_LCD_WIDTH * 50 * sizeof(lv_color_t), MALLOC_CAP_DMA);
    assert(buf2);
    
    lv_disp_draw_buf_init(&disp_buf, buf1, buf2, SENSECAP_LCD_WIDTH * 50);
    
    // Initialize LVGL display driver
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = SENSECAP_LCD_WIDTH;
    disp_drv.ver_res = SENSECAP_LCD_HEIGHT;
    disp_drv.flush_cb = sensecap_display_flush;
    disp_drv.draw_buf = &disp_buf;
    disp_drv.user_data = panel_handle;
    
    lv_disp_t *disp = lv_disp_drv_register(&disp_drv);
    
    ESP_LOGI(TAG, "SenseCAP display initialized successfully");
}

void sensecap_display_show_startup(void)
{
    ESP_LOGI(TAG, "Showing startup screen...");
    
    // Create startup screen
    lv_obj_t *startup_screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(startup_screen, lv_color_black(), 0);
    
    // SenseCAP logo/title
    lv_obj_t *title = lv_label_create(startup_screen);
    lv_label_set_text(title, "SenseCAP\nWAYPOINT COMPASS");
    lv_obj_set_style_text_color(title, lv_color_white(), 0);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_32, 0);
    lv_obj_set_style_text_align(title, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(title, LV_ALIGN_CENTER, 0, -50);
    
    // Version info
    lv_obj_t *version = lv_label_create(startup_screen);
    lv_label_set_text(version, "ESP-IDF Version\nInitializing...");
    lv_obj_set_style_text_color(version, lv_color_make(0, 255, 255), 0);
    lv_obj_set_style_text_font(version, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_align(version, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(version, LV_ALIGN_CENTER, 0, 50);
    
    // Simple compass icon
    lv_obj_t *compass_icon = lv_obj_create(startup_screen);
    lv_obj_set_size(compass_icon, 80, 80);
    lv_obj_set_style_radius(compass_icon, 40, 0);
    lv_obj_set_style_bg_color(compass_icon, lv_color_make(255, 0, 0), 0);
    lv_obj_set_style_border_width(compass_icon, 2, 0);
    lv_obj_set_style_border_color(compass_icon, lv_color_white(), 0);
    lv_obj_align(compass_icon, LV_ALIGN_CENTER, 0, -150);
    
    // North indicator
    lv_obj_t *north = lv_label_create(compass_icon);
    lv_label_set_text(north, "N");
    lv_obj_set_style_text_color(north, lv_color_white(), 0);
    lv_obj_set_style_text_font(north, &lv_font_montserrat_20, 0);
    lv_obj_align(north, LV_ALIGN_TOP_MID, 0, 5);
    
    // Load startup screen
    lv_scr_load(startup_screen);
}

void sensecap_display_set_backlight(uint8_t brightness)
{
    // Simple on/off control (PWM would be better for dimming)
    gpio_set_level(SENSECAP_LCD_BL_GPIO, brightness > 128 ? 1 : 0);
}

void sensecap_display_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p)
{
    esp_lcd_panel_handle_t panel = (esp_lcd_panel_handle_t) disp_drv->user_data;
    int offsetx1 = area->x1;
    int offsety1 = area->y1;
    int offsetx2 = area->x2;
    int offsety2 = area->y2;
    
    // Draw bitmap to panel
    esp_lcd_panel_draw_bitmap(panel, offsetx1, offsety1, offsetx2 + 1, offsety2 + 1, color_p);
    
    // Inform LVGL that flushing is done
    lv_disp_flush_ready(disp_drv);
}