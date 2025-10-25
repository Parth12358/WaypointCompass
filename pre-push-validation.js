// Pre-push validation test to ensure everything works
const http = require('http');
const ttsService = require('./src/services/ttsService');
const navigationTrackingService = require('./src/services/navigationTrackingService');

async function validateSystemForPush() {
  console.log('🔍 PRE-PUSH VALIDATION TEST');
  console.log('============================\n');

  let allTestsPassed = true;
  const errors = [];

  // Test 1: TTS Service
  console.log('🔊 Test 1: TTS Service');
  try {
    await ttsService.speakSystem('System validation test');
    console.log('✅ TTS Service: WORKING\n');
  } catch (error) {
    console.log('❌ TTS Service: FAILED');
    console.log('   Error:', error.message);
    errors.push('TTS Service failed');
    allTestsPassed = false;
  }

  // Test 2: Navigation Tracking
  console.log('🧭 Test 2: Navigation Tracking');
  try {
    const deviceId = 'VALIDATION_TEST';
    const target = { name: 'Test Target', latitude: 37.7849, longitude: -122.4094 };
    const currentLocation = { latitude: 37.7749, longitude: -122.4194 };
    
    const nav = navigationTrackingService.startNavigation(deviceId, target, currentLocation);
    
    if (nav && nav.deviceId === deviceId) {
      console.log('✅ Navigation Tracking: WORKING');
      console.log(`   Distance calculation: ${Math.round(nav.lastDistance * 1000)}m\n`);
      navigationTrackingService.stopNavigation(deviceId, 'test_cleanup');
    } else {
      throw new Error('Navigation service returned invalid data');
    }
  } catch (error) {
    console.log('❌ Navigation Tracking: FAILED');
    console.log('   Error:', error.message);
    errors.push('Navigation Tracking failed');
    allTestsPassed = false;
  }

  // Test 3: Server Health
  console.log('🌐 Test 3: Server Health');
  try {
    await testServerHealth();
    console.log('✅ Server Health: WORKING\n');
  } catch (error) {
    console.log('❌ Server Health: FAILED');
    console.log('   Error:', error.message);
    errors.push('Server health check failed');
    allTestsPassed = false;
  }

  // Final validation
  console.log('============================');
  console.log('🏁 VALIDATION RESULTS');
  console.log('============================');

  if (allTestsPassed) {
    console.log('🎉 ALL SYSTEMS OPERATIONAL! ✅');
    console.log('✅ SAFE TO PUSH TO MAIN BRANCH');
    console.log('\n🚀 System is ready for production use!');
    return true;
  } else {
    console.log('❌ VALIDATION FAILED! ⚠️');
    console.log('❌ DO NOT PUSH TO MAIN BRANCH');
    console.log('\n🔧 Issues found:');
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    return false;
  }
}

function testServerHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          if (health.status === 'healthy') {
            resolve(health);
          } else {
            reject(new Error('Unhealthy server status'));
          }
        } catch (error) {
          reject(new Error('Invalid health response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Server not responding: ${error.message}`));
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
  });
}

if (require.main === module) {
  validateSystemForPush().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('💥 Validation crashed:', error);
    process.exit(1);
  });
}

module.exports = { validateSystemForPush };