#include "gps_handler.h"
#include "esp_bt.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_bt_main.h"
#include "esp_gatt_common_api.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <string.h>
#include <stdlib.h>

static const char *TAG = "GPS_HANDLER";

// BLE configuration
#define GPS_APP_ID          0
#define GPS_DEVICE_NAME     "WaypointCompass"
#define GPS_SVC_INST_ID     0

// Global variables
static gps_data_t current_gps_data = {0};
static bool ble_connected = false;
static SemaphoreHandle_t gps_data_mutex;
static uint16_t gps_conn_id = 0;
static uint16_t gps_gatts_if = 0;

// BLE service and characteristic handles
static uint16_t gps_service_handle = 0;
static uint16_t gps_char_handle = 0;

// Function prototypes
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param);
static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param);
static void parse_gps_data(const char *data, size_t len);
static bool parse_nmea_sentence(const char *sentence);

// Service UUID (128-bit UUID for Nordic UART Service)
static uint8_t gps_service_uuid128[16] = {
    0x9E, 0xCA, 0xDC, 0x24, 0x0E, 0xE5, 0xA9, 0xE0,
    0x93, 0xF3, 0xA3, 0xB5, 0x01, 0x00, 0x40, 0x6E
};

// Characteristic UUID
static uint8_t gps_char_uuid128[16] = {
    0x9E, 0xCA, 0xDC, 0x24, 0x0E, 0xE5, 0xA9, 0xE0,
    0x93, 0xF3, 0xA3, 0xB5, 0x02, 0x00, 0x40, 0x6E
};

void gps_handler_init(void)
{
    ESP_LOGI(TAG, "Initializing BLE GPS handler...");
    
    // Create mutex for GPS data protection
    gps_data_mutex = xSemaphoreCreateMutex();
    
    // Initialize BLE
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));
    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());
    
    // Register BLE callbacks
    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event_handler));
    ESP_ERROR_CHECK(esp_ble_gatts_register_callback(gatts_event_handler));
    ESP_ERROR_CHECK(esp_ble_gatts_app_register(GPS_APP_ID));
    
    ESP_LOGI(TAG, "BLE GPS handler initialized");
}

gps_data_t gps_handler_get_data(void)
{
    gps_data_t data = {0};
    
    if (xSemaphoreTake(gps_data_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        data = current_gps_data;
        xSemaphoreGive(gps_data_mutex);
    }
    
    return data;
}

bool gps_handler_is_connected(void)
{
    return ble_connected;
}

void gps_handler_start_scan(void)
{
    ESP_LOGI(TAG, "Starting BLE scan for GPS devices...");
    
    esp_ble_gap_set_scan_params_complete_evt_t scan_params = {
        .status = ESP_BT_STATUS_SUCCESS,
        .scan_type = BLE_SCAN_TYPE_ACTIVE,
        .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
        .scan_filter_policy = BLE_SCAN_FILTER_ALLOW_ALL,
        .scan_interval = 0x50,
        .scan_window = 0x30,
        .scan_duplicate = BLE_SCAN_DUPLICATE_DISABLE
    };
    
    esp_ble_gap_start_scanning(30); // Scan for 30 seconds
}

void gps_handler_stop_scan(void)
{
    esp_ble_gap_stop_scanning();
}

// BLE advertising parameters
static esp_ble_adv_params_t gps_adv_params = {
    .adv_int_min        = 0x20,
    .adv_int_max        = 0x40,
    .adv_type           = ADV_TYPE_IND,
    .own_addr_type      = BLE_ADDR_TYPE_PUBLIC,
    .channel_map        = ADV_CHNL_ALL,
    .adv_filter_policy  = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

// Service ID structure
static esp_gatt_srvc_id_t gps_service_id = {
    .is_primary = true,
    .id.inst_id = GPS_SVC_INST_ID,
    .id.uuid.len = ESP_UUID_LEN_128,
};

static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
        case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
            esp_ble_gap_start_advertising(&gps_adv_params);
            break;
            
        case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
            esp_ble_gap_start_advertising(&gps_adv_params);
            break;
            
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            if (param->adv_start_cmpl.status != ESP_BT_STATUS_SUCCESS) {
                ESP_LOGE(TAG, "Advertising start failed");
            } else {
                ESP_LOGI(TAG, "Advertising started successfully");
            }
            break;
            
        case ESP_GAP_BLE_ADV_STOP_COMPLETE_EVT:
            if (param->adv_stop_cmpl.status != ESP_BT_STATUS_SUCCESS) {
                ESP_LOGE(TAG, "Advertising stop failed");
            } else {
                ESP_LOGI(TAG, "Advertising stopped successfully");
            }
            break;
            
        case ESP_GAP_BLE_SCAN_RESULT_EVT: {
            esp_ble_gap_cb_param_t *scan_result = (esp_ble_gap_cb_param_t *)param;
            switch (scan_result->scan_rst.search_evt) {
                case ESP_GAP_SEARCH_INQ_RES_EVT:
                    // Check if this is a GPS device (nRF Connect or similar)
                    ESP_LOGI(TAG, "Found BLE device: %02x:%02x:%02x:%02x:%02x:%02x",
                             scan_result->scan_rst.bda[0], scan_result->scan_rst.bda[1],
                             scan_result->scan_rst.bda[2], scan_result->scan_rst.bda[3],
                             scan_result->scan_rst.bda[4], scan_result->scan_rst.bda[5]);
                    break;
                case ESP_GAP_SEARCH_INQ_CMPL_EVT:
                    ESP_LOGI(TAG, "BLE scan complete");
                    break;
                default:
                    break;
            }
            break;
        }
        
        default:
            break;
    }
}

static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    switch (event) {
        case ESP_GATTS_REG_EVT:
            ESP_LOGI(TAG, "GATTS register event, app_id %04x", param->reg.app_id);
            gps_gatts_if = gatts_if;
            
            // Set device name
            esp_ble_gap_set_device_name(GPS_DEVICE_NAME);
            
            // Create GPS service
            memcpy(gps_service_id.id.uuid.uuid.uuid128, gps_service_uuid128, 16);
            esp_ble_gatts_create_service(gatts_if, &gps_service_id, GPS_SVC_INST_ID);
            break;
            
        case ESP_GATTS_CREATE_EVT:
            ESP_LOGI(TAG, "GPS service created, service_handle %d", param->create.service_handle);
            gps_service_handle = param->create.service_handle;
            
            // Add GPS characteristic
            esp_bt_uuid_t char_uuid;
            char_uuid.len = ESP_UUID_LEN_128;
            memcpy(char_uuid.uuid.uuid128, gps_char_uuid128, 16);
            
            esp_ble_gatts_add_char(gps_service_handle, &char_uuid,
                                   ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE,
                                   ESP_GATT_CHAR_PROP_BIT_READ | ESP_GATT_CHAR_PROP_BIT_WRITE | ESP_GATT_CHAR_PROP_BIT_NOTIFY,
                                   NULL, NULL);
            break;
            
        case ESP_GATTS_ADD_CHAR_EVT:
            ESP_LOGI(TAG, "GPS characteristic added, char_handle %d", param->add_char.attr_handle);
            gps_char_handle = param->add_char.attr_handle;
            
            // Start service
            esp_ble_gatts_start_service(gps_service_handle);
            break;
            
        case ESP_GATTS_START_EVT:
            ESP_LOGI(TAG, "GPS service started");
            break;
            
        case ESP_GATTS_CONNECT_EVT:
            ESP_LOGI(TAG, "BLE client connected, conn_id %d", param->connect.conn_id);
            gps_conn_id = param->connect.conn_id;
            ble_connected = true;
            break;
            
        case ESP_GATTS_DISCONNECT_EVT:
            ESP_LOGI(TAG, "BLE client disconnected");
            ble_connected = false;
            gps_conn_id = 0;
            
            // Restart advertising
            esp_ble_gap_start_advertising(&gps_adv_params);
            break;
            
        case ESP_GATTS_WRITE_EVT:
            if (param->write.handle == gps_char_handle) {
                ESP_LOGI(TAG, "Received GPS data: %.*s", param->write.len, param->write.value);
                parse_gps_data((char*)param->write.value, param->write.len);
                
                // Send response
                esp_ble_gatts_send_response(gatts_if, param->write.conn_id, param->write.trans_id,
                                            ESP_GATT_OK, NULL);
            }
            break;
            
        default:
            break;
    }
}

static void parse_gps_data(const char *data, size_t len)
{
    if (!data || len == 0) return;
    
    // Create null-terminated string
    char gps_string[512];
    size_t copy_len = len < sizeof(gps_string) - 1 ? len : sizeof(gps_string) - 1;
    memcpy(gps_string, data, copy_len);
    gps_string[copy_len] = '\0';
    
    ESP_LOGI(TAG, "Parsing GPS data: %s", gps_string);
    
    // Split into NMEA sentences
    char *sentence = strtok(gps_string, "\r\n");
    while (sentence != NULL) {
        if (parse_nmea_sentence(sentence)) {
            // Signal main task that new GPS data is available
            // (You would set an event group bit here)
        }
        sentence = strtok(NULL, "\r\n");
    }
}

static bool parse_nmea_sentence(const char *sentence)
{
    if (!sentence || strlen(sentence) < 6) return false;
    
    // Parse GPGGA sentence (GPS fix data)
    if (strncmp(sentence, "$GPGGA", 6) == 0 || strncmp(sentence, "$GNGGA", 6) == 0) {
        char *token;
        char *sentence_copy = strdup(sentence);
        int field = 0;
        double lat_deg = 0, lon_deg = 0;
        char lat_dir = 'N', lon_dir = 'E';
        float altitude = 0, accuracy = 0;
        int fix_quality = 0;
        
        token = strtok(sentence_copy, ",");
        while (token != NULL && field < 15) {
            switch (field) {
                case 2: // Latitude
                    if (strlen(token) > 0) {
                        lat_deg = atof(token);
                    }
                    break;
                case 3: // Latitude direction
                    lat_dir = token[0];
                    break;
                case 4: // Longitude
                    if (strlen(token) > 0) {
                        lon_deg = atof(token);
                    }
                    break;
                case 5: // Longitude direction
                    lon_dir = token[0];
                    break;
                case 6: // Fix quality
                    fix_quality = atoi(token);
                    break;
                case 9: // Altitude
                    if (strlen(token) > 0) {
                        altitude = atof(token);
                    }
                    break;
                case 8: // HDOP (accuracy indicator)
                    if (strlen(token) > 0) {
                        accuracy = atof(token);
                    }
                    break;
            }
            token = strtok(NULL, ",");
            field++;
        }
        
        free(sentence_copy);
        
        if (fix_quality > 0) {
            // Convert DDMM.MMMM to decimal degrees
            double lat_decimal = ((int)(lat_deg / 100)) + ((lat_deg - ((int)(lat_deg / 100)) * 100) / 60.0);
            double lon_decimal = ((int)(lon_deg / 100)) + ((lon_deg - ((int)(lon_deg / 100)) * 100) / 60.0);
            
            if (lat_dir == 'S') lat_decimal = -lat_decimal;
            if (lon_dir == 'W') lon_decimal = -lon_decimal;
            
            // Update GPS data
            if (xSemaphoreTake(gps_data_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                current_gps_data.latitude = lat_decimal;
                current_gps_data.longitude = lon_decimal;
                current_gps_data.altitude = altitude;
                current_gps_data.accuracy = accuracy;
                current_gps_data.valid = true;
                strcpy(current_gps_data.device_id, "ble_gps");
                
                xSemaphoreGive(gps_data_mutex);
                
                ESP_LOGI(TAG, "GPS fix: %.6f, %.6f, alt: %.1f, acc: %.1f",
                         lat_decimal, lon_decimal, altitude, accuracy);
                return true;
            }
        }
    }
    
    return false;
}