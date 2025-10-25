// Simple Safety Feature Test
const axios = require('axios');

async function testBasicSafety() {
    try {
        console.log('🧭 Testing WaypointCompass Safety Features');
        console.log('='.repeat(50));
        
        // Test 1: Health Check
        console.log('\n1. Server Health Check...');
        const health = await axios.get('http://localhost:3000/health');
        console.log('✅ Server is running:', health.data);
        
        // Test 2: Basic Safety Analysis
        console.log('\n2. Testing Location Safety Analysis...');
        const safetyResponse = await axios.post('http://localhost:3000/api/safety/analyze-location', {
            latitude: 37.7694,
            longitude: -122.4862
        });
        
        console.log('✅ Safety Analysis Result:');
        console.log(`   Risk Score: ${safetyResponse.data.data.riskScore}/5`);
        console.log(`   Risk Level: ${safetyResponse.data.data.riskLevel}`);
        console.log(`   Location: Golden Gate Park, San Francisco`);
        
        // Test 3: Emergency Services
        console.log('\n3. Testing Emergency Services Lookup...');
        const emergencyResponse = await axios.get('http://localhost:3000/api/safety/emergency-services', {
            params: {
                lat: 37.7694,
                lng: -122.4862,
                radius: 1000
            }
        });
        
        console.log('✅ Emergency Services Found:');
        console.log(`   Total Services: ${emergencyResponse.data.data.count}`);
        emergencyResponse.data.data.services.slice(0, 3).forEach(service => {
            console.log(`   ${service.type}: ${service.name} (${service.distance}m away)`);
        });
        
        console.log('\n🎉 Basic Safety Features Working Successfully!');
        
    } catch (error) {
        console.log('❌ Error testing safety features:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testBasicSafety();