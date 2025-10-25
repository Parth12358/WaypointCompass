// TTS Test Script
// Run this script to test the TTS functionality independently

const ttsService = require('./src/services/ttsService');
const navigationTrackingService = require('./src/services/navigationTrackingService');

async function testTTS() {
  console.log('🔊 Testing TTS Service...\n');

  try {
    // Test 1: Basic speech
    console.log('Test 1: Basic speech');
    await ttsService.speak('Hello! This is the WaypointCompass TTS system test.');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Navigation announcements
    console.log('Test 2: Navigation announcements');
    await ttsService.announceNavigation('Navigation started to Central Park', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await ttsService.announceNavigation('You are getting closer to your destination', 'progress');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await ttsService.announceNavigation('Congratulations! You have reached your destination!', 'success');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Pre-generated phrases
    console.log('Test 3: Pre-generated phrases');
    console.log('Generating common phrases...');
    await ttsService.preGenerateCommonPhrases();
    
    console.log('Playing pre-generated phrases...');
    await ttsService.playCommonPhrase('getting_closer');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await ttsService.playCommonPhrase('destination_reached');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Navigation simulation
    console.log('Test 4: Navigation tracking simulation');
    
    const deviceId = 'TEST_DEVICE_001';
    const target = {
      name: 'Coffee Shop',
      latitude: 37.7849,
      longitude: -122.4094
    };
    
    // Start at some distance from target
    let currentLocation = {
      latitude: 37.7749,  // About 1.1 km south
      longitude: -122.4194
    };

    // Start navigation
    navigationTrackingService.startNavigation(deviceId, target, currentLocation);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate moving closer
    console.log('Simulating movement closer to target...');
    currentLocation = {
      latitude: 37.7799,  // Halfway
      longitude: -122.4144
    };
    await navigationTrackingService.updateLocation(deviceId, currentLocation);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate arrival
    console.log('Simulating arrival at destination...');
    currentLocation = {
      latitude: 37.7849,  // At target
      longitude: -122.4094
    };
    await navigationTrackingService.updateLocation(deviceId, currentLocation);
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n✅ TTS Test completed successfully!');
    console.log('🔊 TTS Status:', ttsService.getStatus());
    console.log('🧭 Navigation Status:', navigationTrackingService.getStatus());

  } catch (error) {
    console.error('❌ TTS Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testTTS().then(() => {
    console.log('\n🏁 Test finished. Exiting...');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
}

module.exports = { testTTS };