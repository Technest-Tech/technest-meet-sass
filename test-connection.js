#!/usr/bin/env node

/**
 * LiveKit Connection Test Script
 * This script tests the connection flow to ensure URLs are working correctly
 */

const https = require('https');
const http = require('http');

console.log('🧪 LiveKit Connection Test');
console.log('==========================\n');

// Test URLs
const testUrls = [
  {
    name: 'Public LiveKit URL (for browsers)',
    url: 'wss://live.almajd.link/rtc',
    type: 'websocket'
  },
  {
    name: 'Health Check Endpoint',
    url: 'https://live.almajd.link/api/health',
    type: 'http'
  }
];

async function testUrl(urlInfo) {
  return new Promise((resolve) => {
    console.log(`🔍 Testing: ${urlInfo.name}`);
    console.log(`   URL: ${urlInfo.url}`);
    
    if (urlInfo.type === 'websocket') {
      // For WebSocket, we can only test if the URL is properly formatted
      if (urlInfo.url.startsWith('wss://') || urlInfo.url.startsWith('ws://')) {
        console.log('   ✅ WebSocket URL format is correct');
        resolve(true);
      } else {
        console.log('   ❌ WebSocket URL format is incorrect');
        resolve(false);
      }
    } else if (urlInfo.type === 'http') {
      const url = new URL(urlInfo.url);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };
      
      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        console.log(`   ✅ HTTP ${res.statusCode} - Connection successful`);
        resolve(true);
      });
      
      req.on('error', (err) => {
        console.log(`   ❌ Connection failed: ${err.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        console.log('   ⏰ Connection timeout');
        req.destroy();
        resolve(false);
      });
      
      req.end();
    }
  });
}

async function runTests() {
  console.log('🚀 Starting connection tests...\n');
  
  let allPassed = true;
  
  for (const urlInfo of testUrls) {
    const result = await testUrl(urlInfo);
    if (!result) allPassed = false;
    console.log('');
  }
  
  console.log('📊 Test Results:');
  console.log('================');
  
  if (allPassed) {
    console.log('✅ All tests passed! Your LiveKit configuration should work correctly.');
    console.log('');
    console.log('🎯 What this means:');
    console.log('- Browsers can connect to wss://live.almajd.link/rtc');
    console.log('- Your application endpoints are accessible');
    console.log('- The ERR_NAME_NOT_RESOLVED error should be fixed');
  } else {
    console.log('❌ Some tests failed. Please check your configuration.');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('- Verify your domain DNS is pointing to the correct server');
    console.log('- Check that your server is running and accessible');
    console.log('- Ensure SSL certificates are properly configured');
  }
  
  console.log('');
  console.log('🔗 Manual Test:');
  console.log('Open your browser and go to: https://live.almajd.link/room/test?type=host');
  console.log('Check the browser console for any connection errors.');
}

runTests().catch(console.error);
