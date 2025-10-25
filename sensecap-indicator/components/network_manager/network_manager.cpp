#include "network_manager.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "cJSON.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "NETWORK_MANAGER";

// Global variables
static char backend_base_url[256] = {0};
static char http_response_buffer[4096] = {0};
static int http_response_len = 0;

// HTTP event handler
static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            if (http_response_len + evt->data_len < sizeof(http_response_buffer)) {
                memcpy(http_response_buffer + http_response_len, evt->data, evt->data_len);
                http_response_len += evt->data_len;
                http_response_buffer[http_response_len] = '\0';
            }
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGI(TAG, "HTTP Response: %s", http_response_buffer);
            break;
        default:
            break;
    }
    return ESP_OK;
}

void network_manager_init(const char *backend_url)
{
    if (backend_url) {
        strncpy(backend_base_url, backend_url, sizeof(backend_base_url) - 1);
        backend_base_url[sizeof(backend_base_url) - 1] = '\0';
        ESP_LOGI(TAG, "Network manager initialized with backend: %s", backend_base_url);
    }
}

bool network_manager_test_connectivity(void)
{
    if (strlen(backend_base_url) == 0) {
        ESP_LOGE(TAG, "Backend URL not configured");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/health", backend_base_url);
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 5000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    bool success = (err == ESP_OK && status_code == 200);
    ESP_LOGI(TAG, "Backend connectivity test: %s (status: %d)", success ? "OK" : "FAILED", status_code);
    
    return success;
}

bool network_manager_send_gps_data(const gps_data_t *gps_data)
{
    if (!gps_data || !gps_data->valid) {
        ESP_LOGE(TAG, "Invalid GPS data");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/api/gps", backend_base_url);
    
    // Create JSON payload
    cJSON *json = cJSON_CreateObject();
    cJSON *lat = cJSON_CreateNumber(gps_data->latitude);
    cJSON *lng = cJSON_CreateNumber(gps_data->longitude);
    cJSON *alt = cJSON_CreateNumber(gps_data->altitude);
    cJSON *acc = cJSON_CreateNumber(gps_data->accuracy);
    cJSON *source = cJSON_CreateString("ble");
    cJSON *device_id = cJSON_CreateString(gps_data->device_id);
    
    cJSON_AddItemToObject(json, "latitude", lat);
    cJSON_AddItemToObject(json, "longitude", lng);
    cJSON_AddItemToObject(json, "altitude", alt);
    cJSON_AddItemToObject(json, "accuracy", acc);
    cJSON_AddItemToObject(json, "source", source);
    cJSON_AddItemToObject(json, "deviceId", device_id);
    
    char *json_string = cJSON_Print(json);
    cJSON_Delete(json);
    
    if (!json_string) {
        ESP_LOGE(TAG, "Failed to create JSON payload");
        return false;
    }
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 10000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_string, strlen(json_string));
    
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    free(json_string);
    
    bool success = (err == ESP_OK && (status_code == 200 || status_code == 201));
    ESP_LOGI(TAG, "GPS data send: %s (status: %d)", success ? "OK" : "FAILED", status_code);
    
    return success;
}

bool network_manager_save_location(const gps_data_t *gps_data)
{
    if (!gps_data || !gps_data->valid) {
        ESP_LOGE(TAG, "Invalid GPS data for location save");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/api/locations", backend_base_url);
    
    // Create JSON payload
    cJSON *json = cJSON_CreateObject();
    char location_name[64];
    snprintf(location_name, sizeof(location_name), "ESP32 Waypoint %lu", esp_log_timestamp());
    
    cJSON_AddItemToObject(json, "name", cJSON_CreateString(location_name));
    cJSON_AddItemToObject(json, "description", cJSON_CreateString("Saved from WaypointCompass ESP32 device"));
    cJSON_AddItemToObject(json, "latitude", cJSON_CreateNumber(gps_data->latitude));
    cJSON_AddItemToObject(json, "longitude", cJSON_CreateNumber(gps_data->longitude));
    cJSON_AddItemToObject(json, "category", cJSON_CreateString("waypoint"));
    cJSON_AddItemToObject(json, "source", cJSON_CreateString("esp32"));
    cJSON_AddItemToObject(json, "deviceId", cJSON_CreateString(gps_data->device_id));
    
    char *json_string = cJSON_Print(json);
    cJSON_Delete(json);
    
    if (!json_string) {
        ESP_LOGE(TAG, "Failed to create location JSON payload");
        return false;
    }
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 10000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_string, strlen(json_string));
    
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    free(json_string);
    
    bool success = (err == ESP_OK && (status_code == 200 || status_code == 201));
    ESP_LOGI(TAG, "Location save: %s (status: %d)", success ? "OK" : "FAILED", status_code);
    
    return success;
}

bool network_manager_select_target_location(target_data_t *target)
{
    if (!target) {
        ESP_LOGE(TAG, "Invalid target pointer");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/api/locations", backend_base_url);
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 10000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    if (err != ESP_OK || status_code != 200) {
        ESP_LOGE(TAG, "Failed to fetch locations (status: %d)", status_code);
        return false;
    }
    
    // Parse JSON response
    cJSON *json = cJSON_Parse(http_response_buffer);
    if (!json) {
        ESP_LOGE(TAG, "Failed to parse locations JSON");
        return false;
    }
    
    cJSON *locations = NULL;
    if (cJSON_HasObjectItem(json, "data")) {
        locations = cJSON_GetObjectItem(json, "data");
    } else {
        locations = json;
    }
    
    if (!cJSON_IsArray(locations) || cJSON_GetArraySize(locations) == 0) {
        ESP_LOGW(TAG, "No saved locations found");
        cJSON_Delete(json);
        return false;
    }
    
    // Use the first location (TODO: implement location selection screen)
    cJSON *first_location = cJSON_GetArrayItem(locations, 0);
    if (first_location) {
        cJSON *name = cJSON_GetObjectItem(first_location, "name");
        cJSON *id = cJSON_GetObjectItem(first_location, "_id");
        cJSON *lat = cJSON_GetObjectItem(first_location, "latitude");
        cJSON *lng = cJSON_GetObjectItem(first_location, "longitude");
        
        if (name && id && lat && lng) {
            strncpy(target->name, cJSON_GetStringValue(name), sizeof(target->name) - 1);
            strncpy(target->id, cJSON_GetStringValue(id), sizeof(target->id) - 1);
            target->latitude = cJSON_GetNumberValue(lat);
            target->longitude = cJSON_GetNumberValue(lng);
            target->active = true;
            
            ESP_LOGI(TAG, "Selected target: %s at %.6f, %.6f", target->name, target->latitude, target->longitude);
            cJSON_Delete(json);
            return true;
        }
    }
    
    cJSON_Delete(json);
    return false;
}

bool network_manager_check_location_safety(const gps_data_t *gps_data, safety_data_t *safety)
{
    if (!gps_data || !gps_data->valid || !safety) {
        ESP_LOGE(TAG, "Invalid parameters for safety check");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/api/safety/analyze-location?lat=%.6f&lng=%.6f", 
             backend_base_url, gps_data->latitude, gps_data->longitude);
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 15000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    if (err != ESP_OK || status_code != 200) {
        ESP_LOGE(TAG, "Safety check failed (status: %d)", status_code);
        return false;
    }
    
    // Parse JSON response
    cJSON *json = cJSON_Parse(http_response_buffer);
    if (!json) {
        ESP_LOGE(TAG, "Failed to parse safety JSON");
        return false;
    }
    
    cJSON *data = cJSON_GetObjectItem(json, "data");
    if (data) {
        cJSON *risk_score = cJSON_GetObjectItem(data, "riskScore");
        cJSON *time_risk = cJSON_GetObjectItem(data, "timeRisk");
        cJSON *warnings = cJSON_GetObjectItem(data, "warnings");
        cJSON *hazards = cJSON_GetObjectItem(data, "hazards");
        cJSON *emergency_services = cJSON_GetObjectItem(data, "emergencyServices");
        
        if (risk_score) safety->risk_score = cJSON_GetNumberValue(risk_score);
        if (time_risk) strncpy(safety->time_risk, cJSON_GetStringValue(time_risk), sizeof(safety->time_risk) - 1);
        if (warnings) strncpy(safety->warnings, cJSON_GetStringValue(warnings), sizeof(safety->warnings) - 1);
        if (hazards) strncpy(safety->hazards, cJSON_GetStringValue(hazards), sizeof(safety->hazards) - 1);
        
        if (emergency_services) {
            cJSON *nearby = cJSON_GetObjectItem(emergency_services, "nearby");
            if (nearby) safety->has_emergency_services = cJSON_IsTrue(nearby);
        }
        
        safety->last_check = esp_log_timestamp();
        
        ESP_LOGI(TAG, "Safety analysis complete: risk=%.1f", safety->risk_score);
        cJSON_Delete(json);
        return true;
    }
    
    cJSON_Delete(json);
    return false;
}

bool network_manager_generate_sidequest(const gps_data_t *gps_data, sidequest_data_t *sidequest)
{
    if (!gps_data || !gps_data->valid || !sidequest) {
        ESP_LOGE(TAG, "Invalid parameters for sidequest generation");
        return false;
    }
    
    char url[512];
    snprintf(url, sizeof(url), "%s/api/locations/sidequest", backend_base_url);
    
    // Create JSON payload
    cJSON *json = cJSON_CreateObject();
    cJSON_AddItemToObject(json, "latitude", cJSON_CreateNumber(gps_data->latitude));
    cJSON_AddItemToObject(json, "longitude", cJSON_CreateNumber(gps_data->longitude));
    cJSON_AddItemToObject(json, "radius", cJSON_CreateNumber(2000)); // 2km radius
    cJSON_AddItemToObject(json, "difficulty", cJSON_CreateString("moderate"));
    
    char *json_string = cJSON_Print(json);
    cJSON_Delete(json);
    
    if (!json_string) {
        ESP_LOGE(TAG, "Failed to create sidequest JSON payload");
        return false;
    }
    
    http_response_len = 0;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));
    
    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .timeout_ms = 15000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_string, strlen(json_string));
    
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    
    free(json_string);
    
    if (err != ESP_OK || status_code != 200) {
        ESP_LOGE(TAG, "Sidequest generation failed (status: %d)", status_code);
        return false;
    }
    
    // Parse JSON response
    cJSON *response_json = cJSON_Parse(http_response_buffer);
    if (!response_json) {
        ESP_LOGE(TAG, "Failed to parse sidequest JSON");
        return false;
    }
    
    cJSON *data = cJSON_GetObjectItem(response_json, "data");
    if (data) {
        cJSON *title = cJSON_GetObjectItem(data, "title");
        cJSON *description = cJSON_GetObjectItem(data, "description");
        cJSON *difficulty = cJSON_GetObjectItem(data, "difficulty");
        cJSON *location = cJSON_GetObjectItem(data, "location");
        
        if (title) strncpy(sidequest->title, cJSON_GetStringValue(title), sizeof(sidequest->title) - 1);
        if (description) strncpy(sidequest->description, cJSON_GetStringValue(description), sizeof(sidequest->description) - 1);
        if (difficulty) strncpy(sidequest->difficulty, cJSON_GetStringValue(difficulty), sizeof(sidequest->difficulty) - 1);
        
        if (location) {
            cJSON *loc_name = cJSON_GetObjectItem(location, "name");
            cJSON *loc_lat = cJSON_GetObjectItem(location, "latitude");
            cJSON *loc_lng = cJSON_GetObjectItem(location, "longitude");
            
            if (loc_name) strncpy(sidequest->location, cJSON_GetStringValue(loc_name), sizeof(sidequest->location) - 1);
            if (loc_lat) sidequest->target_lat = cJSON_GetNumberValue(loc_lat);
            if (loc_lng) sidequest->target_lng = cJSON_GetNumberValue(loc_lng);
        }
        
        sidequest->active = true;
        
        ESP_LOGI(TAG, "Sidequest generated: %s", sidequest->title);
        cJSON_Delete(response_json);
        return true;
    }
    
    cJSON_Delete(response_json);
    return false;
}