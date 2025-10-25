# The following lines of boilerplate have to be in your project's
# CMakeLists.txt, the file in the root of the project:
cmake_minimum_required(VERSION 3.16)

# Include the ESP-IDF build system
include($ENV{IDF_PATH}/tools/cmake/project.cmake)

# Set the project name
project(waypoint_compass)