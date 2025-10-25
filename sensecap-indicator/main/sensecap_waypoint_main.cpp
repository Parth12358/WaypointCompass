#include <stdio.h>
#include <string.h>
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_bt_main.h"
#include "esp_gatt_common_api.h"
#include "esp_http_client.h"
#include "cJSON.h"

// LVGL includes
#include "lvgl.h"

// SenseCAP Indicator components
#include "sensecap_display.h"
#include "sensecap_touch.h"
#include "gps_handler.h"
#include "network_manager.h"
#include "navigation_calc.h"

static const char *TAG = "SENSECAP_WAYPOINT";

// WiFi Configuration
#define WIFI_SSID "La Luna"
#define WIFI_PASS "1011997MG"
#define BACKEND_URL "https://waypointcompass-production.up.railway.app"

// Application States
typedef enum {
    STATE_MENU,
    STATE_POINTING,
    STATE_SAFETY_WARNING,
    STATE_SIDEQUEST
} app_state_t;

// Data structures (same as ESP-IDF version)
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

// Global State
static app_state_t current_state = STATE_MENU;
static gps_data_t current_gps = {0};
static target_data_t current_target = {0};
static compass_data_t compass_data = {0};
static safety_data_t safety_data = {0};
static sidequest_data_t sidequest_data = {0};
static bool wifi_connected = false;
static bool backend_reachable = false;

// Task handles
static TaskHandle_t main_task_handle = NULL;
static TaskHandle_t lvgl_task_handle = NULL;

// Event group for synchronization
static EventGroupHandle_t app_event_group;
#define WIFI_CONNECTED_BIT    BIT0
#define GPS_DATA_READY_BIT    BIT1
#define TOUCH_EVENT_BIT       BIT2
#define BACKEND_READY_BIT     BIT3

// LVGL objects
static lv_obj_t *main_screen;
static lv_obj_t *menu_screen;
static lv_obj_t *compass_screen;
static lv_obj_t *safety_screen;
static lv_obj_t *sidequest_screen;

// Function prototypes
static void app_main_task(void *pvParameters);
static void lvgl_tick_task(void *pvParameters);
static void wifi_init_sta(void);
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                              int32_t event_id, void* event_data);
static void create_ui_screens(void);
static void show_menu_screen(void);
static void show_compass_screen(void);
static void show_safety_screen(void);
static void show_sidequest_screen(void);
static void handle_button_events(lv_event_t *e);
static void update_compass_display(void);
static void backend_connectivity_task(void *pvParameters);

extern "C" void app_main(void)
{
    ESP_LOGI(TAG, "SenseCAP WaypointCompass starting...");
    
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Create event group
    app_event_group = xEventGroupCreate();

    // Initialize LVGL
    lv_init();
    
    // Initialize SenseCAP display
    ESP_LOGI(TAG, "Initializing SenseCAP display...");
    sensecap_display_init();
    
    // Initialize SenseCAP touch
    ESP_LOGI(TAG, "Initializing SenseCAP touch...");
    sensecap_touch_init();
    
    // Initialize BLE GPS handler
    ESP_LOGI(TAG, "Initializing BLE GPS handler...");
    gps_handler_init();
    
    // Initialize WiFi
    ESP_LOGI(TAG, "Initializing WiFi...");
    wifi_init_sta();
    
    // Initialize network manager
    ESP_LOGI(TAG, "Initializing network manager...");
    network_manager_init(BACKEND_URL);

    // Create UI screens
    create_ui_screens();
    
    // Show startup animation
    sensecap_display_show_startup();
    vTaskDelay(pdMS_TO_TICKS(3000));

    // Create tasks
    xTaskCreate(app_main_task, "app_main", 8192, NULL, 5, &main_task_handle);
    xTaskCreate(lvgl_tick_task, "lvgl_tick", 4096, NULL, 4, &lvgl_task_handle);
    xTaskCreate(backend_connectivity_task, "backend_check", 4096, NULL, 3, NULL);
    
    ESP_LOGI(TAG, "SenseCAP WaypointCompass started!");
}

static void app_main_task(void *pvParameters)
{
    EventBits_t bits;
    
    // Wait for initial WiFi connection
    ESP_LOGI(TAG, "Waiting for WiFi connection...");
    xEventGroupWaitBits(app_event_group, WIFI_CONNECTED_BIT, false, true, portMAX_DELAY);
    
    // Show main menu
    show_menu_screen();
    current_state = STATE_MENU;
    
    while (1) {
        // Wait for events
        bits = xEventGroupWaitBits(app_event_group,
                                  GPS_DATA_READY_BIT | TOUCH_EVENT_BIT,
                                  true, // Clear bits on exit
                                  false, // Wait for any bit
                                  pdMS_TO_TICKS(1000));
        
        if (bits & GPS_DATA_READY_BIT) {
            // Get latest GPS data
            current_gps = gps_handler_get_data();
            
            // Update compass if in pointing mode
            if (current_state == STATE_POINTING && current_target.active) {
                update_compass_display();
            }
        }
        
        // Periodic updates
        if (current_state == STATE_POINTING && current_target.active) {
            update_compass_display();
        }
        
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

static void lvgl_tick_task(void *pvParameters)
{
    while (1) {
        lv_tick_inc(10);
        lv_task_handler();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

static void wifi_init_sta(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {};
    strcpy((char*)wifi_config.sta.ssid, WIFI_SSID);
    strcpy((char*)wifi_config.sta.password, WIFI_PASS);
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "WiFi initialization finished.");
}

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                              int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        esp_wifi_connect();
        wifi_connected = false;
        xEventGroupClearBits(app_event_group, WIFI_CONNECTED_BIT);
        ESP_LOGI(TAG, "WiFi disconnected, trying to reconnect...");
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        wifi_connected = true;
        xEventGroupSetBits(app_event_group, WIFI_CONNECTED_BIT);
    }
}

static void create_ui_screens(void)
{
    // Main container
    main_screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(main_screen, lv_color_black(), 0);
    
    // Menu screen
    menu_screen = lv_obj_create(main_screen);
    lv_obj_set_size(menu_screen, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_style_bg_color(menu_screen, lv_color_black(), 0);
    
    // Compass screen  
    compass_screen = lv_obj_create(main_screen);
    lv_obj_set_size(compass_screen, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_style_bg_color(compass_screen, lv_color_black(), 0);
    lv_obj_add_flag(compass_screen, LV_OBJ_FLAG_HIDDEN);
    
    // Safety screen
    safety_screen = lv_obj_create(main_screen);
    lv_obj_set_size(safety_screen, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_style_bg_color(safety_screen, lv_color_black(), 0);
    lv_obj_add_flag(safety_screen, LV_OBJ_FLAG_HIDDEN);
    
    // Sidequest screen
    sidequest_screen = lv_obj_create(main_screen);
    lv_obj_set_size(sidequest_screen, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_style_bg_color(sidequest_screen, lv_color_black(), 0);
    lv_obj_add_flag(sidequest_screen, LV_OBJ_FLAG_HIDDEN);
}

static void show_menu_screen(void)
{
    // Hide all screens
    lv_obj_add_flag(compass_screen, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(safety_screen, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(sidequest_screen, LV_OBJ_FLAG_HIDDEN);
    
    // Show menu screen  
    lv_obj_clear_flag(menu_screen, LV_OBJ_FLAG_HIDDEN);
    
    // Clear previous content
    lv_obj_clean(menu_screen);
    
    // Title
    lv_obj_t *title = lv_label_create(menu_screen);
    lv_label_set_text(title, "WAYPOINT COMPASS");
    lv_obj_set_style_text_color(title, lv_color_white(), 0);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_24, 0);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 20);
    
    // GPS Status
    lv_obj_t *gps_status = lv_label_create(menu_screen);
    if (current_gps.valid) {
        lv_label_set_text_fmt(gps_status, "GPS: %.6f, %.6f", current_gps.latitude, current_gps.longitude);
        lv_obj_set_style_text_color(gps_status, lv_color_make(0, 255, 0), 0);
    } else {
        lv_label_set_text(gps_status, "GPS: No Signal");
        lv_obj_set_style_text_color(gps_status, lv_color_make(255, 255, 0), 0);
    }
    lv_obj_align(gps_status, LV_ALIGN_TOP_MID, 0, 60);
    
    // Menu buttons
    lv_obj_t *btn_save = lv_btn_create(menu_screen);
    lv_obj_set_size(btn_save, 400, 50);
    lv_obj_align(btn_save, LV_ALIGN_CENTER, 0, -80);
    lv_obj_set_style_bg_color(btn_save, lv_color_make(128, 0, 128), 0);
    lv_obj_add_event_cb(btn_save, handle_button_events, LV_EVENT_CLICKED, (void*)1);
    
    lv_obj_t *label_save = lv_label_create(btn_save);
    lv_label_set_text(label_save, "Save Current Location");
    lv_obj_center(label_save);
    
    lv_obj_t *btn_navigate = lv_btn_create(menu_screen);
    lv_obj_set_size(btn_navigate, 400, 50);
    lv_obj_align(btn_navigate, LV_ALIGN_CENTER, 0, -20);
    lv_obj_set_style_bg_color(btn_navigate, lv_color_make(128, 0, 128), 0);
    lv_obj_add_event_cb(btn_navigate, handle_button_events, LV_EVENT_CLICKED, (void*)2);
    
    lv_obj_t *label_navigate = lv_label_create(btn_navigate);
    lv_label_set_text(label_navigate, "Navigate to Saved Location");
    lv_obj_center(label_navigate);
    
    lv_obj_t *btn_safety = lv_btn_create(menu_screen);
    lv_obj_set_size(btn_safety, 400, 50);
    lv_obj_align(btn_safety, LV_ALIGN_CENTER, 0, 40);
    lv_obj_set_style_bg_color(btn_safety, lv_color_make(255, 255, 0), 0);
    lv_obj_add_event_cb(btn_safety, handle_button_events, LV_EVENT_CLICKED, (void*)3);
    
    lv_obj_t *label_safety = lv_label_create(btn_safety);
    lv_label_set_text(label_safety, "Safety Check");
    lv_obj_set_style_text_color(label_safety, lv_color_black(), 0);
    lv_obj_center(label_safety);
    
    lv_obj_t *btn_sidequest = lv_btn_create(menu_screen);
    lv_obj_set_size(btn_sidequest, 400, 50);
    lv_obj_align(btn_sidequest, LV_ALIGN_CENTER, 0, 100);
    lv_obj_set_style_bg_color(btn_sidequest, lv_color_make(0, 255, 255), 0);
    lv_obj_add_event_cb(btn_sidequest, handle_button_events, LV_EVENT_CLICKED, (void*)4);
    
    lv_obj_t *label_sidequest = lv_label_create(btn_sidequest);
    lv_label_set_text(label_sidequest, "Generate Sidequest");
    lv_obj_set_style_text_color(label_sidequest, lv_color_black(), 0);
    lv_obj_center(label_sidequest);
    
    // Load screen
    lv_scr_load(main_screen);
}

static void show_compass_screen(void)
{
    // Implementation for compass screen
    // Hide other screens and show compass with navigation info
    lv_obj_add_flag(menu_screen, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(safety_screen, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(sidequest_screen, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(compass_screen, LV_OBJ_FLAG_HIDDEN);
    
    // Compass implementation would go here
    ESP_LOGI(TAG, "Showing compass screen");
}

static void show_safety_screen(void)
{
    // Implementation for safety screen
    ESP_LOGI(TAG, "Showing safety screen");
}

static void show_sidequest_screen(void)
{
    // Implementation for sidequest screen  
    ESP_LOGI(TAG, "Showing sidequest screen");
}

static void handle_button_events(lv_event_t *e)
{
    int button_id = (int)lv_event_get_user_data(e);
    
    ESP_LOGI(TAG, "Button %d pressed", button_id);
    
    switch (button_id) {
        case 1: // Save Location
            if (current_gps.valid) {
                network_manager_save_location(&current_gps);
            }
            break;
            
        case 2: // Navigate
            if (network_manager_select_target_location(&current_target)) {
                current_state = STATE_POINTING;
                show_compass_screen();
            }
            break;
            
        case 3: // Safety Check
            current_state = STATE_SAFETY_WARNING;
            network_manager_check_location_safety(&current_gps, &safety_data);
            show_safety_screen();
            break;
            
        case 4: // Sidequest
            current_state = STATE_SIDEQUEST;
            if (!sidequest_data.active) {
                network_manager_generate_sidequest(&current_gps, &sidequest_data);
            }
            show_sidequest_screen();
            break;
    }
}

static void update_compass_display(void)
{
    if (!current_gps.valid || !current_target.active) return;
    
    // Calculate bearing and distance
    compass_data.bearing = navigation_calc_bearing(current_gps.latitude, current_gps.longitude,
                                                  current_target.latitude, current_target.longitude);
    compass_data.distance = navigation_calc_distance(current_gps.latitude, current_gps.longitude,
                                                    current_target.latitude, current_target.longitude);
    
    // Update compass display (would implement LVGL compass here)
    ESP_LOGI(TAG, "Compass updated: bearing=%.0f°, distance=%.2fkm", 
             compass_data.bearing, compass_data.distance);
}

static void backend_connectivity_task(void *pvParameters)
{
    while (1) {
        if (wifi_connected) {
            bool reachable = network_manager_test_connectivity();
            if (reachable != backend_reachable) {
                backend_reachable = reachable;
                if (reachable) {
                    xEventGroupSetBits(app_event_group, BACKEND_READY_BIT);
                    ESP_LOGI(TAG, "Backend is reachable");
                } else {
                    xEventGroupClearBits(app_event_group, BACKEND_READY_BIT);
                    ESP_LOGI(TAG, "Backend is not reachable");
                }
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(10000)); // Check every 10 seconds
    }
}