const axios = require('axios');

class LandmarkService {
  constructor() {
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    // Define interesting landmark categories with proper Overpass QL syntax
    this.landmarkTypes = {
      monuments: {
        query: 'historic',
        description: 'Historical monuments and memorials'
      },
      nature: {
        query: 'leisure=park',
        description: 'Parks and natural features'
      },
      culture: {
        query: 'tourism~"^(museum|gallery|attraction|artwork|viewpoint)$"',
        description: 'Museums, galleries, and cultural attractions'
      },
      architecture: {
        query: 'building~"^(cathedral|church|mosque|temple|synagogue)$"',
        description: 'Notable architectural structures'
      },
      food: {
        query: 'amenity~"^(restaurant|cafe|pub|bar)$"',
        description: 'Restaurants and cafes'
      },
      shopping: {
        query: 'shop',
        description: 'Specialty shops'
      }
    };
  }

  /**
   * Discover landmarks within radius of given coordinates
   * @param {number} latitude - User's latitude
   * @param {number} longitude - User's longitude
   * @param {number} radiusMeters - Search radius in meters (default 500m)
   * @param {string[]} categories - Landmark categories to include
   * @returns {Promise<Array>} Array of landmark objects
   */
  async discoverLandmarks(latitude, longitude, radiusMeters = 500, categories = null) {
    try {
      // If no categories specified, use a curated mix
      const selectedCategories = categories || ['monuments', 'culture', 'nature', 'architecture'];
      
      // Build Overpass query for multiple landmark types
      const queries = selectedCategories.map(category => {
        const landmarkType = this.landmarkTypes[category];
        if (!landmarkType) return null;
        
        return `(
          node[${landmarkType.query}](around:${radiusMeters},${latitude},${longitude});
          way[${landmarkType.query}](around:${radiusMeters},${latitude},${longitude});
          relation[${landmarkType.query}](around:${radiusMeters},${latitude},${longitude});
        );`;
      }).filter(q => q !== null).join('\n');

      const overpassQuery = `
        [out:json][timeout:25];
        (
          ${queries}
        );
        out center meta;
      `;

      console.log('Overpass Query:', overpassQuery);

      const response = await axios.post(this.overpassUrl, overpassQuery, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000
      });

      const landmarks = this.processOverpassResponse(response.data, latitude, longitude);
      
      // Filter and rank landmarks
      const filteredLandmarks = this.filterAndRankLandmarks(landmarks, latitude, longitude, radiusMeters);
      
      console.log(`Found ${filteredLandmarks.length} landmarks within ${radiusMeters}m`);
      return filteredLandmarks;

    } catch (error) {
      console.error('Landmark discovery error:', error.message);
      throw new Error('Failed to discover landmarks: ' + error.message);
    }
  }

  /**
   * Process raw Overpass API response into landmark objects
   */
  processOverpassResponse(data, userLat, userLng) {
    if (!data.elements || !Array.isArray(data.elements)) {
      return [];
    }

    return data.elements.map(element => {
      // Get coordinates (nodes have lat/lon, ways/relations use center)
      const lat = element.lat || (element.center && element.center.lat);
      const lng = element.lon || (element.center && element.center.lon);
      
      if (!lat || !lng) return null;

      // Extract name and description
      const name = element.tags?.name || 
                  element.tags?.['name:en'] || 
                  element.tags?.historic || 
                  element.tags?.tourism || 
                  element.tags?.amenity || 
                  'Unknown Location';

      // Calculate distance from user
      const distance = this.calculateDistance(userLat, userLng, lat, lng);

      // Determine landmark category and difficulty
      const category = this.categorizeLandmark(element.tags);
      const difficulty = this.calculateDifficulty(distance, category);

      return {
        id: `osm_${element.type}_${element.id}`,
        name: name,
        description: this.generateDescription(element.tags, category),
        latitude: lat,
        longitude: lng,
        distance: Math.round(distance),
        category: category,
        difficulty: difficulty,
        completionRadius: this.getCompletionRadius(category, element.tags),
        tags: element.tags,
        source: 'openstreetmap',
        osm_type: element.type,
        osm_id: element.id
      };
    }).filter(landmark => landmark !== null);
  }

  /**
   * Filter landmarks and rank by interestingness
   */
  filterAndRankLandmarks(landmarks, userLat, userLng, maxRadius) {
    return landmarks
      .filter(landmark => {
        // Basic filters
        if (landmark.distance > maxRadius) return false;
        if (!landmark.name || landmark.name === 'Unknown Location') return false;
        
        // Skip very common/boring places
        const boringKeywords = ['parking', 'toilet', 'atm', 'bench', 'waste_basket'];
        const nameLower = landmark.name.toLowerCase();
        if (boringKeywords.some(keyword => nameLower.includes(keyword))) return false;
        
        return true;
      })
      .map(landmark => ({
        ...landmark,
        interestScore: this.calculateInterestScore(landmark)
      }))
      .sort((a, b) => {
        // Sort by interest score (higher is better), then by distance (closer is better)
        if (Math.abs(a.interestScore - b.interestScore) > 0.1) {
          return b.interestScore - a.interestScore;
        }
        return a.distance - b.distance;
      })
      .slice(0, 10); // Return top 10 most interesting landmarks
  }

  /**
   * Categorize landmark based on OSM tags
   */
  categorizeLandmark(tags) {
    if (tags.historic) return 'monuments';
    if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'culture';
    if (tags.leisure === 'park' || tags.natural) return 'nature';
    if (tags.building && ['cathedral', 'church', 'mosque', 'temple'].includes(tags.building)) return 'architecture';
    if (tags.amenity && ['restaurant', 'cafe', 'pub'].includes(tags.amenity)) return 'food';
    if (tags.shop) return 'shopping';
    return 'general';
  }

  /**
   * Calculate landmark interestingness score (0-1)
   */
  calculateInterestScore(landmark) {
    let score = 0.5; // Base score
    
    // Category bonuses
    const categoryBonus = {
      monuments: 0.3,
      culture: 0.25,
      architecture: 0.2,
      nature: 0.15,
      food: 0.1,
      shopping: 0.05,
      general: 0.0
    };
    score += categoryBonus[landmark.category] || 0;

    // Distance penalty (closer is more interesting for walking)
    if (landmark.distance < 100) score += 0.2;
    else if (landmark.distance < 200) score += 0.1;
    else if (landmark.distance > 400) score -= 0.1;

    // Name quality bonus (longer, more descriptive names are often more interesting)
    if (landmark.name.length > 20) score += 0.1;
    if (landmark.name.includes('Historic') || landmark.name.includes('Museum')) score += 0.15;

    // Tags bonus (more tags usually means more notable)
    const tagCount = Object.keys(landmark.tags).length;
    if (tagCount > 5) score += 0.1;
    if (tagCount > 10) score += 0.1;

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Generate human-readable description
   */
  generateDescription(tags, category) {
    const descriptions = {
      monuments: `Discover this historical ${tags.historic || 'monument'}`,
      culture: `Visit this cultural attraction`,
      nature: `Explore this natural area`,
      architecture: `Admire this architectural structure`,
      food: `Try this local ${tags.cuisine ? tags.cuisine + ' ' : ''}establishment`,
      shopping: `Browse this specialty shop`,
      general: `Explore this local point of interest`
    };

    let description = descriptions[category] || descriptions.general;
    
    // Add specific details if available
    if (tags.description) {
      description += ` - ${tags.description}`;
    } else if (tags.tourism) {
      description += ` (${tags.tourism})`;
    }

    return description;
  }

  /**
   * Calculate appropriate completion radius based on landmark type
   */
  getCompletionRadius(category, tags) {
    // Larger landmarks need bigger completion radius
    if (tags.building === 'cathedral' || tags.leisure === 'park') return 50;
    if (category === 'monuments' || category === 'architecture') return 30;
    if (category === 'nature') return 40;
    return 20; // Default for shops, cafes, etc.
  }

  /**
   * Calculate difficulty based on distance and category
   */
  calculateDifficulty(distance, category) {
    const baseDifficulty = {
      monuments: 'medium',
      culture: 'easy',
      nature: 'medium',
      architecture: 'easy',
      food: 'easy',
      shopping: 'easy',
      general: 'easy'
    };

    let difficulty = baseDifficulty[category] || 'easy';
    
    // Increase difficulty for distant landmarks
    if (distance > 300) {
      if (difficulty === 'easy') difficulty = 'medium';
      else if (difficulty === 'medium') difficulty = 'hard';
    }

    return difficulty;
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const earthRadius = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return earthRadius * c;
  }

  /**
   * Get random landmark for sidequest
   */
  async getRandomSidequest(latitude, longitude, radiusMeters = 800) {
    const landmarks = await this.discoverLandmarks(latitude, longitude, radiusMeters);
    
    if (landmarks.length === 0) {
      return null; // Return null instead of throwing error to allow fallback
    }

    // Weight selection toward more interesting landmarks
    const weightedLandmarks = landmarks.filter(l => l.interestScore > 0.4);
    const selectedLandmarks = weightedLandmarks.length > 0 ? weightedLandmarks : landmarks;
    
    const randomIndex = Math.floor(Math.random() * Math.min(5, selectedLandmarks.length));
    return selectedLandmarks[randomIndex];
  }
}

module.exports = LandmarkService;