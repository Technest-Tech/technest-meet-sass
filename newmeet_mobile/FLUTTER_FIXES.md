# Flutter Mobile App Fixes

## Issues Resolved

### 1. Screen Sharing Not Visible on Remote Devices ✅

**Problem:** When one Android device shares their screen in the same room, other devices cannot see the shared screen.

**Root Cause:** The `VideoParticipantWidget` was only displaying the first video track (camera track) and not prioritizing or detecting screen share tracks.

**Solution:** 
- Updated `lib/widgets/video_participant_widget.dart` to:
  - Separate screen share tracks from camera tracks
  - Prioritize screen share tracks over camera tracks when rendering
  - Properly detect and display screen sharing indicator
  - Check `TrackSource.screenShareVideo` to identify screen share tracks

**Changes Made:**
- Modified `_buildVideoTrack()` method to loop through all video track publications and categorize them
- Updated rendering logic to show screen share track if available, otherwise show camera track
- Fixed `_isScreenSharing()` method to actually check for screen share tracks
- Updated video display condition to show video when screen sharing even if camera is off

---

### 2. Audio Muting When App is Minimized ✅

**Problem:** When the app is minimized to browse Android, the audio gets muted automatically.

**Root Cause:** Android's default behavior pauses audio when apps go to background. The app was not maintaining audio focus or properly handling lifecycle state changes.

**Solution:**

#### a) Android Native Layer Changes:

**File: `android/app/src/main/AndroidManifest.xml`**
- Added `FOREGROUND_SERVICE_PHONE_CALL` permission for voice communication
- Added `supportsPictureInPicture`, `showWhenLocked`, and `turnScreenOn` attributes to MainActivity
- These allow the app to maintain audio even when minimized

**File: `android/app/src/main/kotlin/.../MainActivity.kt`**
- Added `AudioManager` integration to request and maintain audio focus
- Implemented `requestAudioFocus()` with proper audio attributes for voice communication
- Used `AudioFocusRequest` with:
  - `USAGE_VOICE_COMMUNICATION` for proper audio routing
  - `CONTENT_TYPE_SPEECH` for optimized speech processing
  - `setWillPauseWhenDucked(false)` to prevent audio ducking
- Added `abandonAudioFocus()` in `onDestroy()` to properly release audio focus

#### b) Flutter Layer Changes:

**File: `lib/screens/video_conference_screen.dart`**
- Added `WidgetsBindingObserver` mixin to monitor app lifecycle state
- Implemented `didChangeAppLifecycleState()` to handle:
  - `AppLifecycleState.resumed` - when app comes to foreground
  - `AppLifecycleState.paused` - when app goes to background
  - `AppLifecycleState.inactive` - when app is transitioning
  - `AppLifecycleState.hidden` - when app is hidden
- Added `_ensureAudioTracksEnabled()` to verify audio tracks remain active
- Properly dispose of lifecycle observer in `dispose()`

**File: `lib/services/livekit_service.dart`**
- Updated `Room` creation with `RoomOptions`:
  - `adaptiveStream: true` - enables adaptive streaming for better quality
  - `dynacast: true` - enables dynamic broadcast for better performance
- These options help maintain stable audio/video connection

---

## Testing Instructions

### Test 1: Screen Sharing Visibility

1. **Setup:**
   - Install the updated app on two Android devices
   - Join the same room on both devices

2. **Test Steps:**
   - Device A: Click "More" → "Screen Share" → Start screen sharing
   - Device A: Navigate to home screen or another app (screen share should continue)
   - Device B: Verify you can see Device A's shared screen in the video grid
   - Device B: Screen share should display prominently (prioritized over camera)

3. **Expected Results:**
   - ✅ Device B sees the screen share from Device A
   - ✅ Screen share track is prioritized over camera track
   - ✅ Screen sharing indicator appears on the participant tile
   - ✅ Video quality is clear and smooth

4. **Troubleshooting:**
   - If screen share not visible: Check device permissions for screen capture
   - If screen share stops: Ensure foreground service is running (notification should be visible)

---

### Test 2: Audio Continuity When App is Minimized

1. **Setup:**
   - Install the updated app on two Android devices
   - Join the same room on both devices
   - Enable microphone on both devices

2. **Test Steps:**
   - Device A: Start speaking continuously
   - Device B: Minimize the app (press home button)
   - Device B: Open another app (browser, messages, etc.)
   - Device A: Continue speaking
   - Device B: Listen for audio (should continue playing in background)
   - Device B: Return to the meeting app
   - Device A: Verify audio was continuous throughout

3. **Expected Results:**
   - ✅ Audio continues playing when app is minimized
   - ✅ No interruption or muting when switching apps
   - ✅ Audio quality remains consistent
   - ✅ When returning to app, everything works normally
   - ✅ Mic continues to work (if enabled) when app is in background

4. **Additional Scenarios to Test:**
   - Test with incoming phone call (audio should pause/duck appropriately)
   - Test with other audio apps playing (should maintain audio focus)
   - Test with screen lock (audio should continue)
   - Test with different Android versions (API 26+, API 30+, API 33+)

---

## Technical Details

### Screen Share Track Detection

```dart
// Screen share tracks are identified by their source
if (publication.source == lk.TrackSource.screenShareVideo) {
  screenShareTrack = track;
}

// Priority: Screen Share > Camera
videoTrack = screenShareTrack ?? cameraTrack;
```

### Audio Focus Management

```kotlin
// Request audio focus with voice communication usage
val audioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
    .setAudioAttributes(audioAttributes)
    .setWillPauseWhenDucked(false)  // Don't pause on audio duck
    .build()
```

### Lifecycle State Handling

```dart
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  // Maintain audio connection in all states
  switch (state) {
    case AppLifecycleState.paused:
      // Keep audio tracks enabled
      _ensureAudioTracksEnabled(liveKitService);
      break;
    // ... handle other states
  }
}
```

---

## Deployment Notes

### Build Requirements

1. **Rebuild the Flutter App:**
   ```bash
   cd newmeet_mobile
   flutter clean
   flutter pub get
   flutter build apk --release
   # or for app bundle:
   flutter build appbundle --release
   ```

2. **Test on Physical Devices:**
   - These fixes require testing on physical Android devices
   - Emulators may not accurately reflect audio focus behavior
   - Screen sharing requires real device capabilities

3. **Minimum Android Version:**
   - API Level 26 (Android 8.0) or higher for optimal audio focus
   - API Level 21 (Android 5.0) for basic functionality
   - Falls back to deprecated audio focus API for older devices

### Permissions Required

The app requires these permissions (already in manifest):
- `CAMERA` - for video
- `RECORD_AUDIO` - for microphone
- `MODIFY_AUDIO_SETTINGS` - for audio focus
- `FOREGROUND_SERVICE_PHONE_CALL` - for background audio (NEW)
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` - for screen sharing
- `INTERNET` - for connectivity
- `ACCESS_NETWORK_STATE` - for network monitoring
- `WAKE_LOCK` - to keep device awake during calls

---

## Known Limitations

1. **Battery Impact:** Maintaining audio in background will increase battery consumption. This is expected for video conferencing apps.

2. **System Interruptions:** Incoming phone calls will still interrupt audio (this is correct behavior for VOICE_COMMUNICATION usage).

3. **Android Version Differences:** Some audio behaviors may vary slightly between Android versions. Thoroughly test on target API levels.

4. **Background Restrictions:** Some Android manufacturers (Xiaomi, Oppo, etc.) have aggressive battery optimization. Users may need to disable battery optimization for the app.

---

## Files Modified

1. ✅ `lib/widgets/video_participant_widget.dart` - Screen share display logic
2. ✅ `lib/screens/video_conference_screen.dart` - Lifecycle management
3. ✅ `lib/services/livekit_service.dart` - Room options configuration
4. ✅ `android/app/src/main/AndroidManifest.xml` - Permissions and activity config
5. ✅ `android/app/src/main/kotlin/.../MainActivity.kt` - Audio focus management

---

## Verification Checklist

Before deploying:
- [ ] Test screen sharing between 2+ devices
- [ ] Verify screen share displays on all remote participants
- [ ] Test audio continuity when minimizing app
- [ ] Test audio continuity when switching apps
- [ ] Test with screen locked
- [ ] Test with different Android versions
- [ ] Test battery impact over 30-minute call
- [ ] Verify no audio echoes or feedback
- [ ] Test incoming call handling
- [ ] Verify foreground service notification shows during call

---

## Rollback Plan

If issues occur:
1. Use git to revert changes to these 5 files
2. Rebuild and redeploy previous version
3. Document specific scenarios causing issues
4. Test fixes in staging environment before production

---

**Date:** October 12, 2025  
**Version:** 1.0.0  
**Status:** Ready for Testing


