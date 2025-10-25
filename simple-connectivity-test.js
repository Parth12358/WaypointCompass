// Simple server connectivity test
const http = require('http');

console.log('🔍 Testing server connectivity...');

// Test localhost health endpoint
const req = http.get('http://localhost:3000/health', (res) => {
  console.log('✅ Server responded!');
  console.log('   Status Code:', res.statusCode);
  console.log('   Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('   Response:', data);
    console.log('🎉 HTTP connectivity test PASSED!');
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.log('❌ Server connection failed:');
  console.log('   Error:', error.message);
  console.log('   Code:', error.code);
  console.log('💡 This suggests the server HTTP listener is not working properly');
  process.exit(1);
});

req.setTimeout(3000, () => {
  console.log('❌ Server connection timeout');
  console.log('💡 Server might be starting up or not listening on port 3000');
  req.destroy();
  process.exit(1);
});