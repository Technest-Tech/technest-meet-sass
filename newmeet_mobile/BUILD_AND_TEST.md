# Build and Test Guide for Flutter App Fixes

## Quick Start

### 1. Clean and Rebuild

```bash
cd /Users/ahmedomar/Documents/technest/AlmajdAcademy/almajd-meet-livekit/newmeet_mobile

# Clean previous builds
flutter clean

# Get dependencies
flutter pub get

# Build APK for testing
flutter build apk --debug

# OR for release build
flutter build apk --release
```

### 2. Install on Test Devices

```bash
# Connect Android device via USB with USB debugging enabled

# Install the app
flutter install

# OR manually install the APK
adb install build/app/outputs/flutter-apk/app-debug.apk
```

### 3. View Logs While Testing

```bash
# View all logs
flutter logs

# OR filter for specific logs
adb logcat | grep -E "(LiveKit|VideoConference|MainActivity)"
```

---

## Test Scenarios

### Test 1: Screen Sharing Visibility ✅

**Steps:**
1. Install app on Device A and Device B
2. Both join the same room (e.g., "test-room")
3. Device A: Click More → Screen Share
4. Device A: Navigate to another app (the screen share continues)
5. Device B: Should see Device A's screen in real-time

**Expected:**
- ✅ Device B can see what Device A is doing on their phone
- ✅ Screen share is clear and smooth
- ✅ Screen share icon appears on participant tile

**Debug if fails:**
- Check Device A logs for: "📺 LiveKit: Screen share started successfully"
- Check Device B logs for: "📥 LiveKit: Data received" or track publications
- Verify both devices are connected: Look for "✅ Connected to room successfully"

---

### Test 2: Audio Continues When Minimized ✅

**Steps:**
1. Install app on Device A and Device B
2. Both join the same room
3. Device A: Start speaking (test by counting or reading)
4. Device B: Press Home button (app goes to background)
5. Device B: Open browser or another app
6. Device A: Continue speaking
7. Device B: Listen for audio (should still hear Device A)

**Expected:**
- ✅ Audio continues playing on Device B even when app is in background
- ✅ No muting or interruption
- ✅ When returning to app, everything works normally

**Debug if fails:**
- Check Device B logs for: "📱 App paused - maintaining audio connection"
- Check MainActivity logs for: "Audio focus requested"
- Verify audio focus: "AudioManager?.mode = MODE_IN_COMMUNICATION"

---

### Test 3: Combined Test (Screen Share + Background Audio)

**Steps:**
1. Device A: Start screen sharing
2. Device A: Navigate to another app (screen share continues)
3. Device B: Minimize the app
4. Both devices: Verify audio continues on both sides
5. Device B: Maximize app again
6. Verify screen share is still visible and audio still works

**Expected:**
- ✅ Screen share continues on Device A
- ✅ Audio continues on both devices
- ✅ When Device B returns, screen share is still visible
- ✅ No connection drops or quality degradation

---

## Debugging Tips

### Check Device Logs

```bash
# View all app logs
adb logcat | grep "com.newmeet.app.newmeet_mobile"

# View LiveKit specific logs
adb logcat | grep "LiveKit"

# View audio focus logs
adb logcat | grep "AudioManager\|AudioFocus"

# View lifecycle logs
adb logcat | grep "App paused\|App resumed"
```

### Common Issues

**Screen Share Not Visible:**
```bash
# Check if track publications contain screen share
adb logcat | grep "TrackSource\|screenShareVideo"

# Verify screen share track is being sent
adb logcat | grep "publication.source"
```

**Audio Stops When Minimized:**
```bash
# Check audio focus status
adb logcat | grep "AudioManager\|audio focus"

# Check app lifecycle
adb logcat | grep "didChangeAppLifecycleState"

# Verify audio mode
adb logcat | grep "MODE_IN_COMMUNICATION"
```

### Performance Monitoring

```bash
# Monitor battery usage
adb shell dumpsys batterystats | grep "com.newmeet.app.newmeet_mobile"

# Monitor memory usage
adb shell dumpsys meminfo com.newmeet.app.newmeet_mobile

# Monitor CPU usage
adb shell top | grep "newmeet"
```

---

## Device-Specific Testing

### Test on Multiple Android Versions

Recommended test matrix:
- ✅ Android 9 (API 28) - Pie
- ✅ Android 10 (API 29) - Q
- ✅ Android 11 (API 30) - R
- ✅ Android 12 (API 31) - S
- ✅ Android 13 (API 33) - T
- ✅ Android 14 (API 34) - U

### Test on Multiple Manufacturers

Different manufacturers have different battery optimization:
- Samsung (One UI)
- Google (Stock Android)
- Xiaomi (MIUI) - Most aggressive battery optimization
- Oppo/OnePlus (ColorOS)
- Huawei (EMUI)

**Note:** Some manufacturers require users to manually disable battery optimization for the app.

---

## Build Variants

### Debug Build (for testing)
```bash
flutter build apk --debug
# Output: build/app/outputs/flutter-apk/app-debug.apk
```

### Profile Build (for performance testing)
```bash
flutter build apk --profile
# Output: build/app/outputs/flutter-apk/app-profile.apk
```

### Release Build (for production)
```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# OR build App Bundle for Play Store
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

---

## Troubleshooting

### Build Errors

**Issue: Gradle sync failed**
```bash
cd android
./gradlew clean
cd ..
flutter clean
flutter pub get
flutter build apk
```

**Issue: Kotlin version mismatch**
```bash
# Check Kotlin version in android/build.gradle
# Should be compatible with Flutter version
```

**Issue: WebRTC native library conflicts**
```bash
# This is handled in build.gradle with packagingOptions
# Check: pickFirst '**/libjingle_peerconnection_so.so'
```

### Runtime Errors

**Issue: Permissions not granted**
```bash
# Grant permissions manually
adb shell pm grant com.newmeet.app.newmeet_mobile android.permission.CAMERA
adb shell pm grant com.newmeet.app.newmeet_mobile android.permission.RECORD_AUDIO
```

**Issue: Connection failed**
```bash
# Check internet connection
adb shell ping google.com

# Check if LiveKit server is accessible
# Verify URL in app logs
```

---

## Code Changes Summary

**Files Modified:**
1. ✅ `lib/widgets/video_participant_widget.dart` - 48 lines changed
2. ✅ `lib/screens/video_conference_screen.dart` - 59 lines added
3. ✅ `lib/services/livekit_service.dart` - 9 lines changed
4. ✅ `android/app/src/main/AndroidManifest.xml` - 4 lines added
5. ✅ `android/app/src/main/kotlin/.../MainActivity.kt` - 72 lines added

**Total Changes:** ~192 lines of code added/modified

---

## Rollback Instructions

If you need to revert these changes:

```bash
cd /Users/ahmedomar/Documents/technest/AlmajdAcademy/almajd-meet-livekit/newmeet_mobile

# Revert all changes
git checkout lib/widgets/video_participant_widget.dart
git checkout lib/screens/video_conference_screen.dart
git checkout lib/services/livekit_service.dart
git checkout android/app/src/main/AndroidManifest.xml
git checkout android/app/src/main/kotlin/com/newmeet/app/newmeet_mobile/MainActivity.kt

# Rebuild
flutter clean
flutter pub get
flutter build apk
```

---

## Next Steps

1. ✅ Build the app using the commands above
2. ✅ Install on at least 2 test devices
3. ✅ Run Test Scenarios 1, 2, and 3
4. ✅ Monitor logs for any errors
5. ✅ Test on different Android versions
6. ✅ Test battery usage over 30-minute call
7. ✅ Document any issues found
8. ✅ Deploy to production if all tests pass

---

**Build Status:** Ready  
**Test Status:** Pending  
**Last Updated:** October 12, 2025


