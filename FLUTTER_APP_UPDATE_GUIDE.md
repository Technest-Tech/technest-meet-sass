# Flutter App Update Guide - Production Deployment

## Overview
This guide covers the updates made to the Flutter mobile app to work with your production deployment at `https://live.almajd.link`.

## Changes Made

### 1. Updated API Base URL
**File**: `lib/services/api_service.dart`

**Before**:
```dart
static const String baseUrl = 'https://api.newmeet.com';
```

**After**:
```dart
static String get baseUrl => AppConfig.baseUrl;
```

### 2. Added Configuration Management
**New File**: `lib/config/app_config.dart`

This new configuration file provides:
- Environment management (development, staging, production)
- Centralized URL configuration
- Easy switching between environments
- API endpoint management

**Key Features**:
```dart
class AppConfig {
  static const Environment _environment = Environment.production;
  
  static const Map<Environment, String> _baseUrls = {
    Environment.development: 'http://localhost:3000',
    Environment.staging: 'https://staging.almajd.link',
    Environment.production: 'https://live.almajd.link',
  };
  
  static String get baseUrl => _baseUrls[_environment]!;
  static String get liveKitWebSocketUrl => '$baseUrl/rtc';
}
```

### 3. Updated Imports
**File**: `lib/services/api_service.dart`
- Added import for the new configuration: `import '../config/app_config.dart';`

**File**: `lib/services/livekit_service.dart`
- Added import for the new configuration: `import '../config/app_config.dart';`

## Production Configuration

### Current Production Settings
- **Base URL**: `https://live.almajd.link`
- **WebSocket URL**: `https://live.almajd.link/rtc`
- **API Endpoints**:
  - Room validation: `https://live.almajd.link/api/room/validate`
  - LiveKit token: `https://live.almajd.link/api/livekit/token`
  - Connection details: `https://live.almajd.link/api/connection-details`

## Testing the Updated App

### 1. Build and Test
```bash
cd newmeet_mobile

# Clean and get dependencies
flutter clean
flutter pub get

# Test on device/emulator
flutter run
```

### 2. Verify API Connectivity
The app should now:
- ✅ Connect to your production server at `https://live.almajd.link`
- ✅ Successfully validate rooms
- ✅ Get LiveKit tokens from your production API
- ✅ Connect to WebSocket at `wss://live.almajd.link/rtc`
- ✅ Join video calls with the web version

### 3. Test Video Call Flow
1. **Create/Join Room**: Use the same room links as the web version
2. **Permissions**: Grant camera and microphone permissions
3. **Connection**: Should connect to your production LiveKit server
4. **Video/Audio**: Should work seamlessly with web participants

## Environment Switching

### For Development
To switch back to development mode, update `lib/config/app_config.dart`:

```dart
static const Environment _environment = Environment.development;
```

### For Staging
To use a staging environment:

```dart
static const Environment _environment = Environment.staging;
```

### For Production
Current production setting:

```dart
static const Environment _environment = Environment.production;
```

## API Endpoints Verification

### Test Room Validation
```bash
curl "https://live.almajd.link/api/room/validate/test-room?type=host"
```

### Test LiveKit Token
```bash
curl -X POST "https://live.almajd.link/api/livekit/token" \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "test-room",
    "participantName": "TestUser",
    "participantType": "host"
  }'
```

### Test Connection Details
```bash
curl "https://live.almajd.link/api/connection-details?roomName=test&participantName=TestUser&participantType=host"
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Errors
**Problem**: App fails to connect due to SSL issues
**Solution**: Ensure your production server has a valid SSL certificate

#### 2. API Connection Failures
**Problem**: App can't reach the API endpoints
**Solution**: 
- Verify the base URL is correct
- Check if the server is running
- Test API endpoints manually

#### 3. WebSocket Connection Issues
**Problem**: Video calls don't work
**Solution**:
- Verify WebSocket URL is `wss://live.almajd.link/rtc`
- Check LiveKit server is running
- Ensure nginx is properly configured

#### 4. Permission Issues
**Problem**: Camera/microphone not working
**Solution**:
- Grant permissions in device settings
- Check app permission requests
- Test on physical device (not emulator)

### Debug Information

The app includes extensive logging. Check the console output for:
- `🔍 API:` - API request logs
- `🎫 API:` - Token generation logs
- `🔗 API:` - Connection details logs
- `🔌 LiveKit:` - WebSocket connection logs

## Build for Production

### Android
```bash
# Build APK
flutter build apk --release

# Build App Bundle (recommended for Play Store)
flutter build appbundle --release
```

### iOS
```bash
# Build for iOS
flutter build ios --release
```

## Security Considerations

### 1. API Security
- All API calls use HTTPS
- JWT tokens are used for authentication
- LiveKit tokens are generated server-side

### 2. WebSocket Security
- WebSocket connections use WSS (secure)
- Tokens are validated on each connection
- No sensitive data is stored client-side

### 3. Permissions
- Camera and microphone permissions are required
- Permissions are requested at runtime
- Users can deny permissions (app handles gracefully)

## Future Enhancements

### 1. Environment Variables
Consider using environment variables for configuration:
```dart
// In main.dart
const String baseUrl = String.fromEnvironment('BASE_URL', defaultValue: 'https://live.almajd.link');
```

### 2. Configuration File
For more complex configurations, consider using a JSON config file:
```dart
// Load from assets/config.json
final config = await rootBundle.loadString('assets/config.json');
```

### 3. Feature Flags
Add feature flags for different environments:
```dart
class AppConfig {
  static bool get enableScreenSharing => _environment != Environment.development;
  static bool get enableWhiteboard => _environment == Environment.production;
}
```

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify API endpoints are accessible
3. Test WebSocket connection manually
4. Ensure all permissions are granted
5. Test on a physical device

---

**Note**: The app is now configured to work with your production deployment at `https://live.almajd.link`. All API calls and WebSocket connections will use your production server.
