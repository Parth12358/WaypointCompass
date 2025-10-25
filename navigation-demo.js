// Navigation Simulation Demo
// This demonstrates how TTS provides audio feedback during navigation

const navigationTrackingService = require('./src/services/navigationTrackingService');

async function navigationDemo() {
  console.log('🧭 Navigation TTS Demo Starting...\n');

  const deviceId = 'DEMO_ESP32_001';
  
  // Define a destination (like a coffee shop)
  const destination = {
    name: 'Central Coffee Shop',
    latitude: 37.7849,  // Target location
    longitude: -122.4094
  };

  // Start at some distance from the destination (about 1.1 km away)
  let currentLocation = {
    latitude: 37.7749,  // Starting point (south of target)
    longitude: -122.4194
  };

  console.log('📍 Starting navigation simulation...');
  console.log(`   From: ${currentLocation.latitude}, ${currentLocation.longitude}`);
  console.log(`   To: ${destination.name} (${destination.latitude}, ${destination.longitude})\n`);

  // Step 1: Start navigation (this will announce the start)
  console.log('🟢 STEP 1: Starting navigation...');
  const navigation = navigationTrackingService.startNavigation(deviceId, destination, currentLocation);
  console.log(`   Initial distance: ${Math.round(navigation.lastDistance * 1000)}m`);
  await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for TTS

  // Step 2: Move closer to destination
  console.log('🟡 STEP 2: Moving closer to destination...');
  currentLocation = {
    latitude: 37.7799,  // Halfway point
    longitude: -122.4144
  };
  
  const update1 = await navigationTrackingService.updateLocation(deviceId, currentLocation);
  console.log(`   New distance: ${Math.round(update1.currentDistance * 1000)}m`);
  console.log(`   Distance change: ${Math.round(update1.distanceChange * 1000)}m closer`);
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for TTS

  // Step 3: Continue getting closer
  console.log('🟡 STEP 3: Getting even closer...');
  currentLocation = {
    latitude: 37.7824,  // Very close now
    longitude: -122.4069
  };
  
  const update2 = await navigationTrackingService.updateLocation(deviceId, currentLocation);
  console.log(`   New distance: ${Math.round(update2.currentDistance * 1000)}m`);
  console.log(`   Distance change: ${Math.round(update2.distanceChange * 1000)}m closer`);
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for TTS

  // Step 4: Arrive at destination (within 20m threshold)
  console.log('🔴 STEP 4: Arriving at destination...');
  currentLocation = {
    latitude: 37.7849,  // At the destination
    longitude: -122.4094
  };
  
  const arrival = await navigationTrackingService.updateLocation(deviceId, currentLocation);
  console.log(`   Final distance: ${Math.round(arrival.currentDistance * 1000)}m`);
  console.log(`   Navigation status: ${arrival.status}`);
  await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for arrival announcement

  console.log('\n✅ Navigation demo completed!');
  console.log('📊 Final navigation status:', navigationTrackingService.getStatus());
  
  // Demonstrate getting further away scenario
  console.log('\n🔄 Testing "getting further" scenario...');
  
  // Start a new navigation
  const newDestination = {
    name: 'Park Entrance',
    latitude: 37.7899,
    longitude: -122.4044
  };
  
  currentLocation = {
    latitude: 37.7879,  // Close to destination
    longitude: -122.4064
  };
  
  console.log('🟢 Starting second navigation (close to destination)...');
  navigationTrackingService.startNavigation(deviceId, newDestination, currentLocation);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Move away from destination
  console.log('🔵 Moving away from destination...');
  currentLocation = {
    latitude: 37.7859,  // Moving further away
    longitude: -122.4084
  };
  
  const awayUpdate = await navigationTrackingService.updateLocation(deviceId, currentLocation);
  console.log(`   Distance increased by: ${Math.round(Math.abs(awayUpdate.distanceChange) * 1000)}m`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n🏁 Full navigation demo completed!');
}

// Run demo if this file is executed directly
if (require.main === module) {
  navigationDemo().then(() => {
    console.log('\n👋 Demo finished. The TTS system is ready for your ESP32!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { navigationDemo };