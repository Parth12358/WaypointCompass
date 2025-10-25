const ttsService = require('./ttsService');

class NavigationTrackingService {
  constructor() {
    this.activeNavigations = new Map(); // deviceId -> navigation data
    this.distanceThreshold = 10; // meters
    this.announceInterval = 30000; // 30 seconds
    this.destinationThreshold = 20; // meters to consider "arrived"
  }

  // Start tracking navigation for a device
  startNavigation(deviceId, targetLocation, currentLocation) {
    const navigationData = {
      deviceId,
      target: targetLocation,
      startLocation: currentLocation,
      lastLocation: currentLocation,
      lastDistance: this.calculateDistance(currentLocation, targetLocation),
      lastAnnouncement: Date.now(),
      startTime: Date.now(),
      isActive: true,
      hasArrived: false,
      totalDistanceTraveled: 0
    };

    this.activeNavigations.set(deviceId, navigationData);
    
    console.log(`🧭 Navigation started for device ${deviceId} to ${targetLocation.name}`);
    
    // Announce navigation start
    ttsService.announceNavigation(
      `Navigation started to ${targetLocation.name}. Distance: ${Math.round(navigationData.lastDistance * 1000)} meters.`,
      'info'
    );

    return navigationData;
  }

  // Update location and provide navigation feedback
  async updateLocation(deviceId, currentLocation) {
    const nav = this.activeNavigations.get(deviceId);
    if (!nav || !nav.isActive) return null;

    const currentDistance = this.calculateDistance(currentLocation, nav.target);
    const distanceChange = nav.lastDistance - currentDistance;
    const timeSinceLastAnnouncement = Date.now() - nav.lastAnnouncement;
    
    // Calculate distance traveled since last update
    const distanceTraveled = this.calculateDistance(nav.lastLocation, currentLocation);
    nav.totalDistanceTraveled += distanceTraveled;

    // Check if arrived at destination
    if (currentDistance <= this.destinationThreshold / 1000 && !nav.hasArrived) {
      nav.hasArrived = true;
      nav.isActive = false;
      
      const journeyTime = (Date.now() - nav.startTime) / 1000 / 60; // minutes
      
      console.log(`🎉 Destination reached! Device ${deviceId} arrived at ${nav.target.name}`);
      
      await ttsService.announceNavigation(
        `Congratulations! You have reached your destination: ${nav.target.name}. Journey completed in ${Math.round(journeyTime)} minutes.`,
        'success'
      );

      // Also play the pre-generated phrase for faster response
      setTimeout(() => {
        ttsService.playCommonPhrase('destination_reached');
      }, 2000);

      this.activeNavigations.delete(deviceId);
      return { status: 'arrived', navigationData: nav };
    }

    // Provide periodic updates if enough time has passed
    if (timeSinceLastAnnouncement >= this.announceInterval) {
      let announceUpdate = false;
      let message = '';

      // Determine if getting closer or further
      if (Math.abs(distanceChange) > this.distanceThreshold / 1000) { // Convert to km
        if (distanceChange > 0) {
          // Getting closer
          message = `You are getting closer to your destination. ${Math.round(currentDistance * 1000)} meters remaining.`;
          announceUpdate = true;
          
          // Quick phrase first, then detailed info
          ttsService.playCommonPhrase('getting_closer');
        } else {
          // Getting further
          message = `You are moving away from your destination. Current distance: ${Math.round(currentDistance * 1000)} meters.`;
          announceUpdate = true;
          
          // Quick phrase first, then detailed info
          ttsService.playCommonPhrase('getting_further');
        }
      } else {
        // General progress update
        message = `Navigation update: ${Math.round(currentDistance * 1000)} meters to destination.`;
        announceUpdate = true;
      }

      if (announceUpdate) {
        console.log(`📍 Navigation update for ${deviceId}: ${message}`);
        
        // Announce after a small delay to let the quick phrase play first
        setTimeout(() => {
          ttsService.announceNavigation(message, 'progress');
        }, 1500);
        
        nav.lastAnnouncement = Date.now();
      }
    }

    // Update navigation data
    nav.lastLocation = currentLocation;
    nav.lastDistance = currentDistance;

    return {
      status: 'navigating',
      currentDistance: currentDistance,
      distanceChange: distanceChange,
      totalDistanceTraveled: nav.totalDistanceTraveled,
      navigationData: nav
    };
  }

  // Stop navigation for a device
  stopNavigation(deviceId, reason = 'manual') {
    const nav = this.activeNavigations.get(deviceId);
    if (nav) {
      nav.isActive = false;
      this.activeNavigations.delete(deviceId);
      
      console.log(`🛑 Navigation stopped for device ${deviceId}: ${reason}`);
      
      if (reason === 'manual') {
        ttsService.announceNavigation('Navigation cancelled.', 'info');
      }
    }
  }

  // Get active navigation for a device
  getNavigation(deviceId) {
    return this.activeNavigations.get(deviceId);
  }

  // Get all active navigations
  getAllNavigations() {
    return Array.from(this.activeNavigations.values());
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in kilometers
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Configure thresholds
  setThresholds(options = {}) {
    if (options.distanceThreshold) this.distanceThreshold = options.distanceThreshold;
    if (options.announceInterval) this.announceInterval = options.announceInterval;
    if (options.destinationThreshold) this.destinationThreshold = options.destinationThreshold;
    
    console.log('🔧 Navigation thresholds updated:', {
      distanceThreshold: this.distanceThreshold,
      announceInterval: this.announceInterval,
      destinationThreshold: this.destinationThreshold
    });
  }

  // Get service status
  getStatus() {
    return {
      activeNavigations: this.activeNavigations.size,
      thresholds: {
        distanceThreshold: this.distanceThreshold,
        announceInterval: this.announceInterval,
        destinationThreshold: this.destinationThreshold
      },
      navigations: Array.from(this.activeNavigations.entries()).map(([deviceId, nav]) => ({
        deviceId,
        target: nav.target.name,
        currentDistance: nav.lastDistance,
        isActive: nav.isActive,
        startTime: nav.startTime
      }))
    };
  }
}

module.exports = new NavigationTrackingService();