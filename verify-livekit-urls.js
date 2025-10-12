#!/usr/bin/env node

/**
 * LiveKit URL Configuration Verification Script
 * This script verifies that all LiveKit URLs are correctly configured
 * for production deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 LiveKit URL Configuration Verification');
console.log('==========================================\n');

// Read environment files
const envFiles = ['.env', 'env.production', '.env.local'];
const envVars = {};

envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`📄 Reading ${file}...`);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      }
    });
  }
});

// Check critical environment variables
console.log('🔧 Environment Variables Check:');
console.log('--------------------------------');

const requiredVars = [
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET', 
  'LIVEKIT_URL',
  'NEXT_PUBLIC_LIVEKIT_URL'
];

let allVarsPresent = true;
requiredVars.forEach(varName => {
  if (envVars[varName]) {
    const value = varName.includes('SECRET') || varName.includes('KEY') 
      ? '***' + envVars[varName].slice(-4) 
      : envVars[varName];
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allVarsPresent = false;
  }
});

console.log('');

// Verify URL configuration
console.log('🌐 URL Configuration Check:');
console.log('----------------------------');

const livekitUrl = envVars['LIVEKIT_URL'];
const publicLivekitUrl = envVars['NEXT_PUBLIC_LIVEKIT_URL'];

if (livekitUrl && publicLivekitUrl) {
  console.log(`📡 Internal URL (server-side): ${livekitUrl}`);
  console.log(`🌍 Public URL (client-side): ${publicLivekitUrl}`);
  
  // Check if URLs are different (which is correct for production)
  if (livekitUrl !== publicLivekitUrl) {
    console.log('✅ URLs are correctly differentiated for production');
    
    // Check if internal URL uses Docker service name
    if (livekitUrl.includes('livekit-server')) {
      console.log('✅ Internal URL correctly uses Docker service name');
    } else {
      console.log('⚠️  Internal URL should use Docker service name (livekit-server:7880)');
    }
    
    // Check if public URL uses external domain
    if (publicLivekitUrl.includes('live.almajd.link') || publicLivekitUrl.includes('wss://')) {
      console.log('✅ Public URL correctly uses external domain with WSS');
    } else {
      console.log('⚠️  Public URL should use external domain with WSS protocol');
    }
  } else {
    console.log('❌ URLs are the same - this will cause connection issues in production!');
  }
} else {
  console.log('❌ Missing required URL environment variables');
}

console.log('');

// Check API endpoint configurations
console.log('🔌 API Endpoint Configuration Check:');
console.log('-------------------------------------');

const apiFiles = [
  'app/api/connection-details/route.ts',
  'app/api/livekit/token/route.ts'
];

apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    
    if (file.includes('connection-details')) {
      if (content.includes('PUBLIC_LIVEKIT_URL') && content.includes('clientLivekitUrl')) {
        console.log(`✅ ${file}: Correctly uses PUBLIC_LIVEKIT_URL for client connections`);
      } else {
        console.log(`❌ ${file}: Missing PUBLIC_LIVEKIT_URL configuration`);
      }
    }
    
    if (file.includes('livekit/token')) {
      if (content.includes('NEXT_PUBLIC_LIVEKIT_URL')) {
        console.log(`✅ ${file}: Correctly uses NEXT_PUBLIC_LIVEKIT_URL`);
      } else {
        console.log(`❌ ${file}: Should use NEXT_PUBLIC_LIVEKIT_URL`);
      }
    }
  } else {
    console.log(`❌ ${file}: File not found`);
  }
});

console.log('');

// Check recording endpoints (should use internal URL)
console.log('🎥 Recording Endpoints Check:');
console.log('-----------------------------');

const recordingFiles = [
  'app/api/record/start/route.ts',
  'app/api/record/stop/route.ts',
  'app/api/record/download/route.ts',
  'app/api/record/file/route.ts'
];

recordingFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('LIVEKIT_URL') && !content.includes('NEXT_PUBLIC_LIVEKIT_URL')) {
      console.log(`✅ ${file}: Correctly uses internal LIVEKIT_URL for server operations`);
    } else {
      console.log(`⚠️  ${file}: Should use internal LIVEKIT_URL for server operations`);
    }
  }
});

console.log('');

// Summary and recommendations
console.log('📋 Summary and Recommendations:');
console.log('================================');

if (allVarsPresent && livekitUrl && publicLivekitUrl && livekitUrl !== publicLivekitUrl) {
  console.log('✅ Configuration looks correct for production deployment!');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('1. Deploy these changes to your server');
  console.log('2. Restart your application');
  console.log('3. Test the connection from a browser');
  console.log('4. Check browser console for any remaining connection errors');
} else {
  console.log('❌ Configuration issues found. Please fix the above issues before deploying.');
}

console.log('');
console.log('🔗 Expected behavior:');
console.log('- Browsers should connect to: wss://live.almajd.link/rtc');
console.log('- Server operations should use: http://livekit-server:7880');
console.log('- No more ERR_NAME_NOT_RESOLVED errors');
