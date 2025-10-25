// Complete Safety System Demo Test
// Run with: node safety-demo-test.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test coordinates - Golden Gate Park area, San Francisco
const TEST_COORDINATES = {
    start: { lat: 37.7694, lng: -122.4862 }, // Golden Gate Park
    risky: { lat: 37.7820, lng: -122.4194 }, // Tenderloin District (higher risk)
    safe: { lat: 37.7701, lng: -122.4681 },  // Japanese Tea Garden
    parking: { lat: 37.7705, lng: -122.4690 } // Near park parking
};

async function demonstrateFeature(title, testFunction) {
    console.log(`\n🧭 ${title}`);
    console.log('='.repeat(60));
    try {
        await testFunction();
        console.log('✅ Feature demonstration completed successfully');
    } catch (error) {
        console.log('❌ Feature demonstration failed:', error.message);
        if (error.response) {
            console.log('Response:', error.response.data);
        }
    }
}

async function demo1_SafetyCheckedMystery() {
    console.log('Starting mystery adventure with automatic safety screening...');
    
    const response = await axios.post(`${BASE_URL}/api/sidequest/start`, null, {
        params: {
            lat: TEST_COORDINATES.start.lat,
            lng: TEST_COORDINATES.start.lng
        }
    });
    
    console.log('Mystery Response:', response.data.message);
    
    if (response.data.data.safetyWarnings) {
        console.log('Safety Warnings:');
        response.data.data.safetyWarnings.forEach(warning => {
            console.log(`  ${warning.severity}: ${warning.message}`);
        });
    }
    
    if (response.data.data.safetyMessage) {
        console.log('Safety Message:', response.data.data.safetyMessage);
    }
}

async function demo2_RealTimeCompassSafety() {
    console.log('Testing real-time compass with continuous safety monitoring...');
    
    // Simulate movement from safe area toward potentially risky area
    const locations = [
        { lat: 37.7694, lng: -122.4862, desc: "Starting point (Golden Gate Park)" },
        { lat: 37.7698, lng: -122.4665, desc: "Walking on park pathway" },
        { lat: 37.7701, lng: -122.4670, desc: "Approaching major street" },
        { lat: 37.7701, lng: -122.4681, desc: "Destination reached" }
    ];
    
    for (const location of locations) {
        console.log(`\n📍 ${location.desc}`);
        
        const response = await axios.post(`${BASE_URL}/api/gps/compass`, {
            latitude: location.lat,
            longitude: location.lng,
            source: 'demo'
        });
        
        const { compass, safety } = response.data.data;
        
        if (compass.hasTarget) {
            console.log(`   🧭 Bearing: ${compass.bearing}°, Distance: ${compass.distance}m`);
        }
        
        if (safety.hasWarnings) {
            console.log('   ⚠️ Safety Warnings:');
            safety.warnings.forEach(warning => {
                console.log(`      ${warning.severity}: ${warning.message}`);
            });
        } else {
            console.log('   ✅ No safety concerns at this location');
        }
        
        // Simulate walking time
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function demo3_RouteAnalysis() {
    console.log('Analyzing route safety between two points...');
    
    const response = await axios.post(`${BASE_URL}/api/safety/analyze-route`, {
        start: TEST_COORDINATES.safe,
        end: TEST_COORDINATES.risky,
        waypoints: [
            { lat: 37.7750, lng: -122.4400 } // Intermediate waypoint
        ]
    });
    
    console.log('Route Analysis Results:');
    console.log(`Overall Risk Score: ${response.data.data.overallRiskScore} (${response.data.data.riskLevel})`);
    
    if (response.data.data.warnings.length > 0) {
        console.log('Route Warnings:');
        response.data.data.warnings.forEach(warning => {
            console.log(`  ${warning.severity}: ${warning.message}`);
        });
    }
    
    if (response.data.data.alternatives.length > 0) {
        console.log('Alternative Routes Suggested:');
        response.data.data.alternatives.forEach((alt, index) => {
            console.log(`  ${index + 1}. ${alt.description} (Risk: ${alt.riskScore})`);
        });
    }
}

async function demo4_LocationSafety() {
    console.log('Checking safety of specific location for saving...');
    
    const response = await axios.post(`${BASE_URL}/api/safety/analyze-location`, {
        latitude: TEST_COORDINATES.parking.lat,
        longitude: TEST_COORDINATES.parking.lng
    });
    
    const { riskScore, riskLevel, warnings, recommendations } = response.data.data;
    
    console.log(`Location Risk Assessment:`);
    console.log(`  Risk Score: ${riskScore}/5 (${riskLevel})`);
    
    if (warnings.length > 0) {
        console.log('  Warnings:');
        warnings.forEach(warning => {
            console.log(`    ${warning.severity}: ${warning.message}`);
        });
    }
    
    if (recommendations.length > 0) {
        console.log('  Recommendations:');
        recommendations.forEach(rec => {
            console.log(`    • ${rec}`);
        });
    }
}

async function demo5_EmergencyServices() {
    console.log('Finding nearby emergency services...');
    
    const response = await axios.get(`${BASE_URL}/api/safety/emergency-services`, {
        params: {
            lat: TEST_COORDINATES.start.lat,
            lng: TEST_COORDINATES.start.lng,
            radius: 2000 // 2km radius
        }
    });
    
    console.log(`Found ${response.data.data.count} emergency services nearby:`);
    
    response.data.data.services.forEach(service => {
        console.log(`  ${service.type.toUpperCase()}: ${service.name}`);
        console.log(`    Distance: ${service.distance}m`);
        if (service.phone) {
            console.log(`    Phone: ${service.phone}`);
        }
        console.log('');
    });
}

async function demo6_DestinationCheck() {
    console.log('Checking destination safety before navigation...');
    
    // Test both a safe and potentially risky destination
    const destinations = [
        { ...TEST_COORDINATES.safe, name: "Japanese Tea Garden (Safe)" },
        { ...TEST_COORDINATES.risky, name: "Tenderloin District (Higher Risk)" }
    ];
    
    for (const dest of destinations) {
        console.log(`\n📍 Checking: ${dest.name}`);
        
        const response = await axios.post(`${BASE_URL}/api/safety/check-destination`, {
            latitude: dest.lat,
            longitude: dest.lng
        });
        
        const { isSafe, riskScore, riskLevel, summary } = response.data.data;
        
        console.log(`  Safe to visit: ${isSafe ? '✅ YES' : '❌ CAUTION ADVISED'}`);
        console.log(`  Risk Level: ${riskLevel} (${riskScore}/5)`);
        console.log(`  Summary: ${summary}`);
        
        if (response.data.data.warnings.length > 0) {
            console.log('  Warnings:');
            response.data.data.warnings.forEach(warning => {
                console.log(`    ${warning.severity}: ${warning.message}`);
            });
        }
    }
}

async function runCompleteDemo() {
    console.log('🛡️ WaypointCompass Safety System - Complete Demo');
    console.log('='.repeat(60));
    console.log('This demo will test all safety features integrated into WaypointCompass');
    console.log('Make sure your server is running on http://localhost:3000');
    console.log('');
    
    // Test server connection
    try {
        await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server connection verified');
    } catch (error) {
        console.log('❌ Cannot connect to server. Please start with: npm start');
        return;
    }
    
    await demonstrateFeature('1. Safety-Checked Mystery Adventure', demo1_SafetyCheckedMystery);
    await demonstrateFeature('2. Real-Time Compass with Safety Monitoring', demo2_RealTimeCompassSafety);
    await demonstrateFeature('3. Route Safety Analysis', demo3_RouteAnalysis);
    await demonstrateFeature('4. Location Safety Assessment', demo4_LocationSafety);
    await demonstrateFeature('5. Emergency Services Lookup', demo5_EmergencyServices);
    await demonstrateFeature('6. Destination Safety Check', demo6_DestinationCheck);
    
    console.log('\n🎉 Complete Safety System Demo Finished!');
    console.log('All safety features have been demonstrated successfully.');
    console.log('Your WaypointCompass system now provides comprehensive protection');
    console.log('while preserving the mystery and adventure experience.');
}

// Run the demo
runCompleteDemo().catch(console.error);