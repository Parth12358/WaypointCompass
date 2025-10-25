const axios = require('axios');

class SafetyService {
  constructor() {
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    // Define safety-related tags and risk levels
    this.safetyTags = {
      // High risk areas
      highRisk: {
        'landuse': ['industrial', 'military', 'quarry'],
        'man_made': ['wastewater_plant', 'water_treatment', 'tower'],
        'military': ['*'],
        'railway': ['rail', 'subway', 'tram'],
        'power': ['line', 'substation', 'tower'],
        'highway': ['motorway', 'trunk', 'primary'],
        'natural': ['cliff', 'water'],
        'tourism': ['attraction'], // Some attractions can be dangerous
        'amenity': ['hospital', 'police', 'fire_station'] // Emergency areas
      },
      
      // Medium risk areas
      mediumRisk: {
        'highway': ['secondary', 'tertiary', 'unclassified'],
        'landuse': ['construction', 'brownfield'],
        'building': ['industrial', 'warehouse'],
        'amenity': ['fuel', 'parking'],
        'leisure': ['track']
      },
      
      // Areas typically considered safer
      safeAreas: {
        'landuse': ['residential', 'commercial', 'retail'],
        'amenity': ['school', 'university', 'library', 'community_centre', 'park'],
        'leisure': ['park', 'playground', 'garden'],
        'tourism': ['hotel', 'museum', 'information']
      }
    };
    
    // Crime data APIs (these would need API keys in production)
    this.crimeDataSources = {
      // US Crime data
      fbi: 'https://api.usa.gov/crime/fbi/sapi/api',
      // UK Crime data
      ukPolice: 'https://data.police.uk/api',
      // Generic crime mapping services would go here
    };
  }

  /**
   * Analyze safety along a route to a destination
   * @param {number} currentLat - Current latitude
   * @param {number} currentLng - Current longitude
   * @param {number} targetLat - Target latitude
   * @param {number} targetLng - Target longitude
   * @returns {Promise<Object>} Safety analysis with warnings
   */
  async analyzeSafetyRoute(currentLat, currentLng, targetLat, targetLng) {
    try {
      console.log(`Analyzing safety route from ${currentLat}, ${currentLng} to ${targetLat}, ${targetLng}`);
      
      // Create waypoints along the route for analysis
      const waypoints = this.generateRouteWaypoints(currentLat, currentLng, targetLat, targetLng);
      
      // Analyze each section of the route
      const safetyAnalysis = await Promise.all(
        waypoints.map(point => this.analyzeSafetyAtLocation(point.lat, point.lng, point.section))
      );
      
      // Aggregate results
      const overallSafety = this.aggregateSafetyResults(safetyAnalysis);
      
      return {
        success: true,
        overall: overallSafety,
        warnings: this.generateSafetyWarnings(safetyAnalysis),
        recommendations: this.generateSafetyRecommendations(safetyAnalysis),
        analysis: safetyAnalysis
      };
      
    } catch (error) {
      console.error('Safety analysis error:', error.message);
      return {
        success: false,
        error: 'Unable to analyze route safety',
        warnings: [{
          type: 'system',
          severity: 'info',
          message: 'Safety analysis unavailable - proceed with normal caution'
        }]
      };
    }
  }

  /**
   * Analyze safety at a specific location
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} section - Route section identifier
   * @returns {Promise<Object>} Safety analysis for location
   */
  async analyzeSafetyAtLocation(latitude, longitude, section = 'unknown') {
    try {
      // Get OSM features around location
      const osmFeatures = await this.getOSMFeaturesForSafety(latitude, longitude, 200);
      
      // Analyze time-based risk (night vs day)
      const timeRisk = this.analyzeTimeBasedRisk();
      
      // Calculate risk score
      const riskScore = this.calculateLocationRiskScore(osmFeatures, timeRisk);
      const locationWarnings = this.generateLocationWarnings(osmFeatures, riskScore, timeRisk);
      
      return {
        section,
        latitude,
        longitude,
        riskScore,
        timeRisk,
        features: osmFeatures,
        warnings: locationWarnings
      };
      
    } catch (error) {
      console.error(`Safety analysis error at ${latitude}, ${longitude}:`, error.message);
      return {
        section,
        latitude,
        longitude,
        riskScore: 2, // Medium risk when unable to analyze
        warnings: [{
          type: 'analysis_error',
          severity: 'info',
          message: 'Unable to analyze this area - exercise normal caution'
        }]
      };
    }
  }

  /**
   * Get OSM features relevant to safety analysis
   */
  async getOSMFeaturesForSafety(latitude, longitude, radiusMeters = 200) {
    const overpassQuery = `
      [out:json][timeout:15];
      (
        // High risk infrastructure
        node[landuse~"^(industrial|military|quarry)$"](around:${radiusMeters},${latitude},${longitude});
        way[landuse~"^(industrial|military|quarry)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Transportation infrastructure
        node[highway~"^(motorway|trunk|primary|secondary)$"](around:${radiusMeters},${latitude},${longitude});
        way[highway~"^(motorway|trunk|primary|secondary)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Railway infrastructure
        node[railway~"^(rail|subway|tram)$"](around:${radiusMeters},${latitude},${longitude});
        way[railway~"^(rail|subway|tram)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Power infrastructure
        node[power](around:${radiusMeters},${latitude},${longitude});
        way[power](around:${radiusMeters},${latitude},${longitude});
        
        // Natural hazards
        node[natural~"^(cliff|water|wetland)$"](around:${radiusMeters},${latitude},${longitude});
        way[natural~"^(cliff|water|wetland)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Emergency services (good to know about)
        node[amenity~"^(hospital|police|fire_station)$"](around:${radiusMeters},${latitude},${longitude});
        way[amenity~"^(hospital|police|fire_station)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Safe areas
        node[amenity~"^(school|university|library|community_centre)$"](around:${radiusMeters},${latitude},${longitude});
        way[amenity~"^(school|university|library|community_centre)$"](around:${radiusMeters},${latitude},${longitude});
        
        // Lighting (street lights indicate safer areas)
        node[highway=street_lamp](around:${radiusMeters},${latitude},${longitude});
      );
      out center meta;
    `;

    console.log('Safety analysis query:', overpassQuery);

    const response = await axios.post(this.overpassUrl, overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 20000
    });

    return this.processSafetyFeatures(response.data, latitude, longitude);
  }

  /**
   * Process OSM features for safety analysis
   */
  processSafetyFeatures(data, userLat, userLng) {
    if (!data.elements || !Array.isArray(data.elements)) {
      return { safe: [], risky: [], emergency: [], lighting: [] };
    }

    const features = {
      safe: [],
      risky: [],
      emergency: [],
      lighting: [],
      transportation: []
    };

    data.elements.forEach(element => {
      const lat = element.lat || (element.center && element.center.lat);
      const lng = element.lon || (element.center && element.center.lon);
      
      if (!lat || !lng || !element.tags) return;

      const distance = this.calculateDistance(userLat, userLng, lat, lng);
      const feature = {
        id: element.id,
        type: element.type,
        distance,
        tags: element.tags
      };

      // Categorize features
      if (this.isHighRiskFeature(element.tags)) {
        features.risky.push(feature);
      } else if (this.isEmergencyService(element.tags)) {
        features.emergency.push(feature);
      } else if (this.isLighting(element.tags)) {
        features.lighting.push(feature);
      } else if (this.isTransportation(element.tags)) {
        features.transportation.push(feature);
      } else if (this.isSafeArea(element.tags)) {
        features.safe.push(feature);
      }
    });

    return features;
  }

  /**
   * Calculate location risk score (0 = very safe, 5 = very dangerous)
   */
  calculateLocationRiskScore(features, timeRisk) {
    let baseRisk = 1; // Neutral starting point
    
    // Risk factors (increase risk)
    const riskyFeatures = features.risky.length;
    const nearbyHighways = features.transportation.filter(f => 
      f.tags.highway && ['motorway', 'trunk', 'primary'].includes(f.tags.highway)
    ).length;
    
    // Safety factors (decrease risk)
    const safeFeatures = features.safe.length;
    const lighting = features.lighting.length;
    const emergencyServices = features.emergency.length;
    
    // Calculate risk adjustments
    const riskIncrease = (riskyFeatures * 0.5) + (nearbyHighways * 0.3);
    const riskDecrease = (safeFeatures * 0.2) + (lighting * 0.1) + (emergencyServices * 0.15);
    
    // Apply time-based risk
    const timeAdjustment = timeRisk.isNight ? 0.5 : 0;
    
    // Calculate final risk score
    let finalRisk = baseRisk + riskIncrease - riskDecrease + timeAdjustment;
    
    // Clamp to 0-5 range
    return Math.max(0, Math.min(5, Math.round(finalRisk * 10) / 10));
  }

  /**
   * Generate route waypoints for analysis
   */
  generateRouteWaypoints(startLat, startLng, endLat, endLng) {
    const waypoints = [];
    const segments = 5; // Analyze route in 5 segments
    
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const lat = startLat + (endLat - startLat) * progress;
      const lng = startLng + (endLng - startLng) * progress;
      
      waypoints.push({
        lat,
        lng,
        section: i === 0 ? 'start' : i === segments ? 'destination' : `segment_${i}`
      });
    }
    
    return waypoints;
  }

  /**
   * Analyze time-based risk factors
   */
  analyzeTimeBasedRisk() {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    // Night hours are generally riskier
    const isNight = hour < 6 || hour > 22;
    const isLateNight = hour < 4 || hour > 23;
    
    let riskLevel = 0;
    const factors = [];
    
    if (isNight) {
      riskLevel += 1;
      factors.push('Night time hours');
    }
    
    if (isLateNight) {
      riskLevel += 1;
      factors.push('Late night hours');
    }
    
    if (isWeekend && isNight) {
      riskLevel += 0.5;
      factors.push('Weekend night');
    }
    
    return {
      isNight,
      isLateNight,
      isWeekend,
      riskLevel,
      factors,
      recommendation: riskLevel > 1.5 ? 'Exercise extra caution during these hours' : null
    };
  }

  /**
   * Generate safety warnings based on analysis
   */
  generateSafetyWarnings(safetyAnalysis) {
    const warnings = [];
    
    // Check for high-risk sections
    const highRiskSections = safetyAnalysis.filter(section => section.riskScore >= 3.5);
    
    if (highRiskSections.length > 0) {
      warnings.push({
        type: 'high_risk_area',
        severity: 'warning',
        message: `⚠️ High risk area detected along your route. Exercise extra caution.`,
        details: `${highRiskSections.length} section(s) with elevated risk levels`,
        sections: highRiskSections.map(s => s.section)
      });
    }
    
    // Check for industrial/dangerous infrastructure
    const industrialAreas = safetyAnalysis.filter(section => 
      section.features.risky.some(f => f.tags.landuse === 'industrial')
    );
    
    if (industrialAreas.length > 0) {
      warnings.push({
        type: 'industrial_area',
        severity: 'caution',
        message: `🏭 Industrial area on route. Be aware of heavy vehicle traffic.`,
        recommendation: 'Stay on designated walkways and be extra alert for vehicles'
      });
    }
    
    // Check for transportation hazards
    const highwayAreas = safetyAnalysis.filter(section =>
      section.features.transportation.some(f => 
        f.tags.highway && ['motorway', 'trunk', 'primary'].includes(f.tags.highway)
      )
    );
    
    if (highwayAreas.length > 0) {
      warnings.push({
        type: 'major_road',
        severity: 'caution',
        message: `🛣️ Route crosses major roads. Use designated crossings only.`,
        recommendation: 'Look for pedestrian bridges, traffic lights, or crosswalks'
      });
    }
    
    // Check for time-based warnings
    const timeWarnings = safetyAnalysis.filter(section => section.timeRisk.riskLevel > 1);
    if (timeWarnings.length > 0 && timeWarnings[0].timeRisk.factors.length > 0) {
      warnings.push({
        type: 'time_based',
        severity: 'info',
        message: `🌙 ${timeWarnings[0].timeRisk.factors.join(', ')}`,
        recommendation: timeWarnings[0].timeRisk.recommendation || 'Consider traveling during daylight hours if possible'
      });
    }
    
    return warnings;
  }

  /**
   * Generate safety recommendations
   */
  generateSafetyRecommendations(safetyAnalysis) {
    const recommendations = [];
    
    // Check if route has good lighting
    const lightingCount = safetyAnalysis.reduce((sum, section) => 
      sum + section.features.lighting.length, 0
    );
    
    if (lightingCount < 2) {
      recommendations.push({
        type: 'lighting',
        message: 'Bring a flashlight or use phone light - limited street lighting detected',
        priority: 'medium'
      });
    }
    
    // Check for emergency services nearby
    const emergencyServices = safetyAnalysis.reduce((sum, section) => 
      sum + section.features.emergency.length, 0
    );
    
    if (emergencyServices > 0) {
      recommendations.push({
        type: 'emergency_services',
        message: 'Emergency services (police/hospital/fire) are nearby if needed',
        priority: 'info'
      });
    }
    
    // General safety recommendations
    recommendations.push({
      type: 'general',
      message: 'Stay aware of your surroundings and trust your instincts',
      priority: 'high'
    });
    
    recommendations.push({
      type: 'general',
      message: 'Share your location with someone you trust',
      priority: 'high'
    });
    
    return recommendations;
  }

  /**
   * Aggregate overall safety results
   */
  aggregateSafetyResults(safetyAnalysis) {
    const avgRiskScore = safetyAnalysis.reduce((sum, section) => 
      sum + section.riskScore, 0
    ) / safetyAnalysis.length;
    
    const maxRiskScore = Math.max(...safetyAnalysis.map(s => s.riskScore));
    
    let safetyLevel, color, message;
    
    if (avgRiskScore < 1.5) {
      safetyLevel = 'safe';
      color = 'green';
      message = '✅ Route appears generally safe';
    } else if (avgRiskScore < 2.5) {
      safetyLevel = 'moderate';
      color = 'yellow';
      message = '⚠️ Route has some areas requiring caution';
    } else if (avgRiskScore < 3.5) {
      safetyLevel = 'elevated';
      color = 'orange';
      message = '🚨 Route has elevated risk areas - exercise caution';
    } else {
      safetyLevel = 'high_risk';
      color = 'red';
      message = '⛔ High risk route detected - consider alternative path';
    }
    
    return {
      safetyLevel,
      color,
      message,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      maxRiskScore,
      totalSections: safetyAnalysis.length
    };
  }

  // Helper methods for feature classification
  isHighRiskFeature(tags) {
    const highRiskTags = this.safetyTags.highRisk;
    return Object.keys(highRiskTags).some(key => {
      if (!tags[key]) return false;
      const values = highRiskTags[key];
      return values.includes('*') || values.includes(tags[key]);
    });
  }

  isEmergencyService(tags) {
    return tags.amenity && ['hospital', 'police', 'fire_station'].includes(tags.amenity);
  }

  isLighting(tags) {
    return tags.highway === 'street_lamp';
  }

  isTransportation(tags) {
    return tags.highway || tags.railway;
  }

  isSafeArea(tags) {
    const safeAreaTags = this.safetyTags.safeAreas;
    return Object.keys(safeAreaTags).some(key => {
      if (!tags[key]) return false;
      const values = safeAreaTags[key];
      return values.includes(tags[key]);
    });
  }

  /**
   * Generate warnings for a specific location
   */
  generateLocationWarnings(features, riskScore, timeRisk) {
    const warnings = [];
    
    // High risk score warning
    if (riskScore >= 3.5) {
      warnings.push({
        type: 'high_risk_location',
        severity: 'warning',
        message: '⚠️ High risk area detected - exercise extreme caution'
      });
    } else if (riskScore >= 2.5) {
      warnings.push({
        type: 'moderate_risk_location',
        severity: 'caution',
        message: '🚨 Moderate risk area - stay alert'
      });
    }
    
    // Specific feature warnings
    if (features.risky && features.risky.length > 0) {
      const riskyTypes = features.risky.map(f => f.tags.landuse || f.tags.highway || f.tags.railway || 'hazard');
      warnings.push({
        type: 'infrastructure_hazard',
        severity: 'caution',
        message: `⚠️ Nearby hazards: ${riskyTypes.join(', ')}`
      });
    }
    
    // Transportation warnings
    if (features.transportation && features.transportation.length > 0) {
      const majorRoads = features.transportation.filter(f => 
        f.tags.highway && ['motorway', 'trunk', 'primary'].includes(f.tags.highway)
      );
      if (majorRoads.length > 0) {
        warnings.push({
          type: 'major_road_nearby',
          severity: 'caution',
          message: '🛣️ Major road nearby - use caution when crossing'
        });
      }
    }
    
    // Time-based warnings
    if (timeRisk && timeRisk.riskLevel > 1) {
      warnings.push({
        type: 'time_based_risk',
        severity: 'info',
        message: `🌙 ${timeRisk.factors.join(', ')} - extra caution advised`
      });
    }
    
    // Positive safety indicators
    if (features.emergency && features.emergency.length > 0) {
      warnings.push({
        type: 'emergency_services_nearby',
        severity: 'info',
        message: '🚑 Emergency services nearby'
      });
    }
    
    return warnings;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
}

module.exports = SafetyService;