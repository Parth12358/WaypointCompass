const LandmarkService = require('./src/services/landmarkService');

async function testLandmarkService() {
  console.log('🧪 Testing Landmark Service...');
  
  const landmarkService = new LandmarkService();
  
  try {
    // Test San Francisco coordinates
    const landmarks = await landmarkService.discoverLandmarks(37.7749, -122.4194, 1000, ['monuments']);
    console.log('✅ Landmarks found:', landmarks.length);
    
    if (landmarks.length > 0) {
      console.log('First landmark:', landmarks[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLandmarkService();