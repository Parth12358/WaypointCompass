const LandmarkService = require('./src/services/landmarkService');

async function testLandmarkService() {
  const service = new LandmarkService();
  try {
    console.log('Testing landmark discovery...');
    const landmarks = await service.discoverLandmarks(37.7849, -122.4094, 800);
    console.log(' Found landmarks:', landmarks.length);
    
    console.log('Testing random sidequest...');
    const sidequest = await service.getRandomSidequest(37.7849, -122.4094, 800);
    console.log(' Random sidequest:', sidequest.name);
  } catch (error) {
    console.error(' Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLandmarkService();
