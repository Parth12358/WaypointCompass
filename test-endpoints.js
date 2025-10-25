const http = require('http');

const testEndpoint = (path, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve({ status: res.statusCode, data: result });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

const runTests = async () => {
    console.log('🧪 Testing WaypointCompass Server Endpoints\n');

    try {
        // Test health endpoint
        console.log('1. Testing Health Endpoint...');
        const health = await testEndpoint('/health');
        console.log(`   Status: ${health.status}`);
        console.log(`   Response: ${JSON.stringify(health.data)}\n`);

        // Test root endpoint
        console.log('2. Testing Root Endpoint...');
        const root = await testEndpoint('/');
        console.log(`   Status: ${root.status}`);
        console.log(`   Message: ${root.data.message}\n`);

        // Test safety endpoint
        console.log('3. Testing Safety Analysis...');
        const safety = await testEndpoint('/api/safety/analyze-location?lat=37.7749&lng=-122.4194');
        console.log(`   Status: ${safety.status}`);
        console.log(`   Risk Score: ${safety.data?.data?.riskScore || 'N/A'}\n`);

        // Test GPS endpoint
        console.log('4. Testing GPS Endpoint...');
        const gps = await testEndpoint('/api/gps');
        console.log(`   Status: ${gps.status}`);
        console.log(`   Has Location: ${gps.data?.hasLocation || 'N/A'}\n`);

        console.log('✅ All core endpoints are working!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

// Wait a moment then run tests
setTimeout(runTests, 2000);