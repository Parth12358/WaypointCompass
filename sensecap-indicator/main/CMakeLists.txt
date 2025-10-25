idf_component_register(SRCS "sensecap_waypoint_main.cpp"
                       INCLUDE_DIRS "."
                       REQUIRES nvs_flash wifi_provisioning bt esp_http_client json lvgl)