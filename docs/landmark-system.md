# OpenStreetMap Landmark Discovery Implementation

## How It Works

The landmark discovery system uses **OpenStreetMap's Overpass API** to find interesting real-world locations near the user for sidequests. Here's how it's implemented:

## Architecture

```
User Location → Overpass API Query → OSM Data → Filtering → Ranked Landmarks → Mystery Sidequest
```

## Landmark Categories

### 1. **Monuments & History** (High Interest)
- `historic=monument|memorial|castle|ruins|archaeological_site`
- Examples: War memorials, historical markers, old buildings, ruins
- **Why Better**: Real historical significance vs fake "Historic Marker"

### 2. **Culture & Tourism** (High Interest)  
- `tourism=museum|gallery|attraction|artwork|viewpoint`
- Examples: Local museums, art galleries, scenic viewpoints, public art
- **Why Better**: Actual cultural attractions vs generic "Art Gallery"

### 3. **Nature & Parks** (Medium Interest)
- `leisure=park|garden|nature_reserve` or `natural=peak|waterfall|beach|cave`
- Examples: City parks, botanical gardens, natural landmarks
- **Why Better**: Real parks with names and features vs "Hidden Park"

### 4. **Architecture** (Medium Interest)
- `building=cathedral|church|mosque|temple|synagogue` or `man_made=tower|lighthouse|windmill`
- Examples: Notable religious buildings, towers, unique structures
- **Why Better**: Actual architectural landmarks vs "Old Building"

### 5. **Food & Culture** (Lower Interest)
- `amenity=restaurant|cafe|pub|bar` with `cuisine` tag
- Examples: Restaurants with specific cuisines, historic pubs
- **Why Better**: Real establishments vs "Corner Cafe"

## Sample Overpass Query

```overpass
[out:json][timeout:25];
(
  node[historic~"^(monument|memorial|castle|ruins)$"](around:500,37.7749,-122.4194);
  way[historic~"^(monument|memorial|castle|ruins)$"](around:500,37.7749,-122.4194);
  node[tourism~"^(museum|gallery|attraction|viewpoint)$"](around:500,37.7749,-122.4194);
  way[tourism~"^(museum|gallery|attraction|viewpoint)$"](around:500,37.7749,-122.4194);
);
out center meta;
```

## Interest Scoring Algorithm

Each landmark gets scored 0.0-1.0 based on:

- **Category Bonus**: Monuments (+0.3), Culture (+0.25), Architecture (+0.2)
- **Distance Penalty**: <100m (+0.2), <200m (+0.1), >400m (-0.1) 
- **Name Quality**: Longer, descriptive names (+0.1-0.15)
- **Tag Richness**: More OSM tags = more notable (+0.1-0.2)

## Example API Usage

### Discover Landmarks
```bash
GET /api/landmarks/discover?lat=37.7749&lng=-122.4194&radius=500
```

Response:
```json
{
  "success": true,
  "message": "Found 8 landmarks within 500m",
  "data": {
    "searchLocation": {"latitude": 37.7749, "longitude": -122.4194},
    "landmarks": [
      {
        "name": "Coit Tower",
        "description": "Discover this historical monument",
        "latitude": 37.8024,
        "longitude": -122.4058,
        "distance": 287,
        "category": "monuments",
        "difficulty": "medium",
        "interestScore": 0.85,
        "completionRadius": 30
      },
      {
        "name": "Saints Peter and Paul Church",
        "description": "Admire this architectural structure",
        "latitude": 37.8007,
        "longitude": -122.4103,
        "distance": 312,
        "category": "architecture", 
        "difficulty": "easy",
        "interestScore": 0.72,
        "completionRadius": 30
      }
    ]
  }
}
```

### Start Real Landmark Sidequest
```bash
POST /api/sidequest/start?lat=37.7749&lng=-122.4194
```

Response:
```json
{
  "success": true,
  "message": "Mystery adventure started! Follow the compass to discover what awaits...",
  "data": {
    "type": "sidequest",
    "message": "Destination unknown - follow your compass!",
    "estimatedDistance": "287 meters away"
  }
}
```

### Complete Sidequest (Revelation!)
```bash
POST /api/target/reached
Content: {"latitude": 37.8024, "longitude": -122.4058}
```

Response:
```json
{
  "success": true,
  "message": "Mystery Solved! You discovered: Coit Tower",
  "data": {
    "targetName": "Coit Tower",
    "targetType": "sidequest", 
    "completedAt": "2024-10-24T15:30:00.000Z",
    "realName": "Coit Tower",
    "description": "Discover this historical monument - A 1933 tower offering panoramic views of San Francisco",
    "category": "monuments",
    "difficulty": "medium",
    "type": "landmark_discovery"
  }
}
```

## Advantages Over Alternatives

### vs Google Places API
- ✅ **Free**: No per-request costs
- ✅ **Rich Data**: Historical, cultural, architectural details
- ✅ **Global**: Works everywhere, not region-restricted
- ✅ **Open**: No vendor lock-in or rate limits

### vs Foursquare/Yelp
- ✅ **Historical Focus**: Monuments, landmarks, not just businesses
- ✅ **Cultural Data**: Museums, art, architecture
- ✅ **Natural Features**: Parks, peaks, caves, beaches
- ✅ **No Commercial Bias**: Not focused on restaurants/shops

## Filtering & Quality

The system filters out:
- Boring locations (parking, toilets, ATMs)
- Unnamed or poorly tagged locations  
- Overly distant landmarks
- Duplicate or low-quality entries

## Fallback Strategy

If no landmarks found (rural areas):
1. Try larger radius (800m → 1500m)
2. Reduce category requirements
3. Fall back to random mystery location
4. Use GPS coordinates from different time periods

## Real-World Example: San Francisco

Near Fisherman's Wharf, the system discovers:
- **Coit Tower** (monument, 287m away)
- **Saints Peter & Paul Church** (architecture, 312m)  
- **Washington Square Park** (nature, 198m)
- **North Beach Museum** (culture, 445m)

User starts sidequest → "Mystery Location" → Walks to Coit Tower → **"Mystery Solved! You discovered: Coit Tower"**

## Implementation Benefits

1. **Educational**: Users learn about real local history and culture
2. **Exploration**: Encourages visiting actual points of interest
3. **Scalable**: Works in any city worldwide with OSM data
4. **Dynamic**: Always fresh discoveries as OSM data updates
5. **Authentic**: Real places with genuine significance

This creates a much more engaging and educational experience than random fake locations!