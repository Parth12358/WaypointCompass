#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "compass_display.h" // For data structures

#ifdef __cplusplus
extern "C" {
#endif

// Function declarations
void network_manager_init(const char *backend_url);
bool network_manager_test_connectivity(void);
bool network_manager_send_gps_data(const gps_data_t *gps_data);
bool network_manager_save_location(const gps_data_t *gps_data);
bool network_manager_select_target_location(target_data_t *target);
bool network_manager_check_location_safety(const gps_data_t *gps_data, safety_data_t *safety);
bool network_manager_generate_sidequest(const gps_data_t *gps_data, sidequest_data_t *sidequest);

#ifdef __cplusplus
}
#endif