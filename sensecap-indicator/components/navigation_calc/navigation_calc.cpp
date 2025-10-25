#include "navigation_calc.h"
#include <math.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

double navigation_calc_to_radians(double degrees)
{
    return degrees * M_PI / 180.0;
}

double navigation_calc_to_degrees(double radians)
{
    return radians * 180.0 / M_PI;
}

float navigation_calc_distance(double lat1, double lon1, double lat2, double lon2)
{
    const double R = 6371.0; // Earth's radius in kilometers
    
    double dLat = navigation_calc_to_radians(lat2 - lat1);
    double dLon = navigation_calc_to_radians(lon2 - lon1);
    
    double a = sin(dLat / 2) * sin(dLat / 2) +
               cos(navigation_calc_to_radians(lat1)) * cos(navigation_calc_to_radians(lat2)) *
               sin(dLon / 2) * sin(dLon / 2);
    
    double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    
    return (float)(R * c); // Distance in kilometers
}

float navigation_calc_bearing(double lat1, double lon1, double lat2, double lon2)
{
    double dLon = navigation_calc_to_radians(lon2 - lon1);
    double lat1Rad = navigation_calc_to_radians(lat1);
    double lat2Rad = navigation_calc_to_radians(lat2);
    
    double y = sin(dLon) * cos(lat2Rad);
    double x = cos(lat1Rad) * sin(lat2Rad) - sin(lat1Rad) * cos(lat2Rad) * cos(dLon);
    
    double bearingRad = atan2(y, x);
    double bearingDeg = navigation_calc_to_degrees(bearingRad);
    
    // Normalize to 0-360 degrees
    return (float)fmod((bearingDeg + 360.0), 360.0);
}