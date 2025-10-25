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

// Component includes
#include "compass_display.h"
#include "gps_handler.h"
#include "network_manager.h"
#include "navigation_calc.h"
#include "touch_controller.h"

static const char *TAG = "WAYPOINT_COMPASS";

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
static TaskHandle_t gps_task_handle = NULL;
static TaskHandle_t network_task_handle = NULL;

// Event group for synchronization
static EventGroupHandle_t app_event_group;
#define WIFI_CONNECTED_BIT    BIT0
#define GPS_DATA_READY_BIT    BIT1
#define TOUCH_EVENT_BIT       BIT2
#define BACKEND_READY_BIT     BIT3

// Function prototypes
static void app_main_task(void *pvParameters);
static void wifi_init_sta(void);
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                              int32_t event_id, void* event_data);
static void handle_touch_event(touch_event_t touch_event);
static void update_compass_display(void);
static void backend_connectivity_task(void *pvParameters);

extern "C" void app_main(void)
{
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Create event group
    app_event_group = xEventGroupCreate();

    // Initialize components
    ESP_LOGI(TAG, "Initializing display...");
    compass_display_init();
    
    ESP_LOGI(TAG, "Initializing touch controller...");
    touch_controller_init();
    
    ESP_LOGI(TAG, "Initializing BLE GPS handler...");
    gps_handler_init();
    
    ESP_LOGI(TAG, "Initializing WiFi...");
    wifi_init_sta();
    
    ESP_LOGI(TAG, "Initializing network manager...");
    network_manager_init(BACKEND_URL);

    // Show startup screen
    compass_display_show_startup();
    vTaskDelay(pdMS_TO_TICKS(2000));

    // Create main application task
    xTaskCreate(app_main_task, "app_main", 8192, NULL, 5, &main_task_handle);
    
    // Create background tasks
    xTaskCreate(backend_connectivity_task, "backend_check", 4096, NULL, 3, NULL);
    
    ESP_LOGI(TAG, "WaypointCompass ESP-IDF started!");
}

static void app_main_task(void *pvParameters)
{
    EventBits_t bits;
    touch_event_t touch_event;
    
    // Wait for initial WiFi connection
    ESP_LOGI(TAG, "Waiting for WiFi connection...");
    xEventGroupWaitBits(app_event_group, WIFI_CONNECTED_BIT, false, true, portMAX_DELAY);
    
    // Show main menu
    compass_display_draw_menu();
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
        
        if (bits & TOUCH_EVENT_BIT) {
            // Get touch event
            if (touch_controller_get_event(&touch_event)) {
                handle_touch_event(touch_event);
            }
        }
        
        // Periodic updates
        if (current_state == STATE_POINTING && current_target.active) {
            update_compass_display();
        }
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

static void handle_touch_event(touch_event_t touch_event)
{
    int x = touch_event.x;
    int y = touch_event.y;
    
    ESP_LOGI(TAG, "Touch event at (%d, %d) in state %d", x, y, current_state);
    
    switch (current_state) {
        case STATE_MENU:
            if (y >= 150 && y <= 190) {
                // Save Location
                network_manager_save_location(&current_gps);
            } else if (y >= 200 && y <= 240) {
                // Navigate To
                network_manager_select_target_location(&current_target);
                if (current_target.active) {
                    current_state = STATE_POINTING;
                    update_compass_display();
                }
            } else if (y >= 250 && y <= 290) {
                // Safety Check
                current_state = STATE_SAFETY_WARNING;
                network_manager_check_location_safety(&current_gps, &safety_data);
                compass_display_draw_safety(&safety_data);
            } else if (y >= 270 && y <= 310) {
                // Sidequest
                current_state = STATE_SIDEQUEST;
                if (!sidequest_data.active) {
                    network_manager_generate_sidequest(&current_gps, &sidequest_data);
                }
                compass_display_draw_sidequest(&sidequest_data);
            }
            break;
            
        case STATE_POINTING:
            // Back to menu
            current_state = STATE_MENU;
            current_target.active = false;
            compass_display_draw_menu();
            break;
            
        case STATE_SAFETY_WARNING:
            // Back to menu
            current_state = STATE_MENU;
            compass_display_draw_menu();
            break;
            
        case STATE_SIDEQUEST:
            if (sidequest_data.active && y >= 400 && y <= 430) {
                // Navigate to sidequest
                strcpy(current_target.name, sidequest_data.title);
                current_target.latitude = sidequest_data.target_lat;
                current_target.longitude = sidequest_data.target_lng;
                current_target.active = true;
                current_state = STATE_POINTING;
                update_compass_display();
            } else if (!sidequest_data.active && y >= 250 && y <= 290) {
                // Generate new sidequest
                network_manager_generate_sidequest(&current_gps, &sidequest_data);
                compass_display_draw_sidequest(&sidequest_data);
            } else {
                // Back to menu
                current_state = STATE_MENU;
                compass_display_draw_menu();
            }
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
    
    // Update display
    compass_display_draw_compass(&compass_data, &current_target);
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