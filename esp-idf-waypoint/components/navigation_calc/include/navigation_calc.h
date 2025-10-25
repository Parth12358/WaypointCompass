#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// Function declarations
double navigation_calc_to_radians(double degrees);
double navigation_calc_to_degrees(double radians);
float navigation_calc_distance(double lat1, double lon1, double lat2, double lon2);
float navigation_calc_bearing(double lat1, double lon1, double lat2, double lon2);

#ifdef __cplusplus
}
#endif