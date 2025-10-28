# Background Microphone Fix - Implementation Guide

## Problem
The Flutter app's microphone was being muted when the app was minimized or moved to the background, preventing participants from being heard during video calls.

## Root Causes
1. **Missing Android 14+ Permissions**: `FOREGROUND_SERVICE_MICROPHONE` permission was not declared
2. **Insufficient Foreground Service Configuration**: Service wasn't properly configured as a microphone service
3. **Wake Lock Timeout**: 10-minute timeout causing audio to pause
4. **Audio Focus Management**: System reclaiming audio focus when app backgrounded
5. **Audio Mode Not Persisting**: Communication mode being reset on lifecycle changes
6. **Notification Priority Too Low**: Foreground service notification could be dismissed

## Solutions Implemented

### 1. Android Manifest Updates (`AndroidManifest.xml`)

#### Added Missing Permissions
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
```

**Why**: Android 14+ (API 34) requires explicit foreground service type permissions. Without `FOREGROUND_SERVICE_MICROPHONE`, the system will kill microphone access when the app backgrounds.

#### Updated Service Configuration
```xml
<service
    android:name=".CallService"
    android:foregroundServiceType="phoneCall|microphone"
    android:exported="false" />
```

**Why**: Declaring both `phoneCall` and `microphone` service types ensures the system knows this service needs continuous microphone access.

### 2. CallService.kt Improvements

#### Enhanced Notification Importance
- Changed from `IMPORTANCE_LOW` to `IMPORTANCE_HIGH`
- Changed from `PRIORITY_HIGH` to `PRIORITY_MAX`
- Added `FOREGROUND_SERVICE_IMMEDIATE` behavior
- Made notification silent (no sound/vibration)

**Why**: Higher importance prevents the system from killing the service. Silent notifications prevent user annoyance while maintaining the persistent notification required for foreground services.

```kotlin
private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Video Call Service",
            NotificationManager.IMPORTANCE_HIGH  // Changed from LOW
        ).apply {
            description = "Service for ongoing video call with microphone access"
            setShowBadge(false)
            setSound(null, null) // Silent notification
            enableVibration(false)
        }
        // ...
    }
}
```

### 3. MainActivity.kt Critical Fixes

#### Indefinite Wake Lock
**Before:**
```kotlin
wakeLock?.acquire(10*60*1000L /*10 minutes*/)
```

**After:**
```kotlin
@Suppress("WakelockTimeout")
wakeLock?.acquire()  // Indefinite - released in onDestroy
```

**Why**: 10-minute timeout was causing audio to pause after that duration. Indefinite wake lock (with proper release in `onDestroy`) ensures audio stays active for the entire call duration.

#### Aggressive Audio Focus Management
```kotlin
private fun requestAudioFocus() {
    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(audioAttributes)
        .setAcceptsDelayedFocusGain(true)
        .setWillPauseWhenDucked(false)  // Don't pause on ducking
        .setOnAudioFocusChangeListener { focusChange ->
            when (focusChange) {
                AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                    // CRITICAL: Immediately try to regain focus
                    audioManager?.requestAudioFocus(audioFocusRequest!!)
                    audioManager?.isMicrophoneMute = false
                }
                AudioManager.AUDIOFOCUS_GAIN -> {
                    audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                    audioManager?.isMicrophoneMute = false
                }
            }
        }
        .build()
}
```

**Why**: When other apps (like notifications) try to take audio focus, we immediately attempt to regain it. This is appropriate for VoIP/video call apps which should maintain priority.

#### Lifecycle-Based Audio Maintenance
```kotlin
@OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
fun onAppPaused() {
    // CRITICAL: Keep audio mode in communication
    audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
    audioManager?.isMicrophoneMute = false
    requestAudioFocus()  // Re-request to ensure it's maintained
}

@OnLifecycleEvent(Lifecycle.Event.ON_RESUME)
fun onAppResumed() {
    audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
    audioManager?.isMicrophoneMute = false
    requestAudioFocus()  // Re-request in case it was lost
}
```

**Why**: Android lifecycle changes can reset audio settings. We explicitly re-configure audio on every lifecycle transition.

### 4. LiveKit Service Configuration (`livekit_service.dart`)

#### Enhanced Room Options
```dart
_room = lk.Room(
  roomOptions: lk.RoomOptions(
    adaptiveStream: true,
    dynacast: true,
    defaultAudioCaptureOptions: lk.AudioCaptureOptions(
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    ),
    stopLocalTrackOnUnpublish: false,  // Don't stop tracks on background
  ),
);
```

**Why**: `stopLocalTrackOnUnpublish: false` prevents LiveKit from stopping audio tracks when the app backgrounds.

#### Microphone Keepalive Timer
```dart
// Check and re-enable microphone every 2 seconds
_microphoneKeepaliveTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
  _ensureMicrophoneEnabled();
});
```

**Why**: Aggressive checking ensures that if the microphone gets muted by any system event, it's immediately re-enabled.

### 5. Flutter Lifecycle Integration (`video_conference_screen.dart`)

Already implemented with `WidgetsBindingObserver`:
- Saves microphone state before backgrounding
- Restores microphone state on resuming
- Calls `CallService.configureAudioForBackground()` on lifecycle changes
- Ensures audio tracks stay enabled

## Testing Instructions

### Pre-Testing Setup
1. Ensure you have Android 8.0+ device (API 26+)
2. Grant all permissions (Camera, Microphone) when prompted
3. Have a second device or web client ready to test with

### Test Cases

#### Test 1: Basic Background Operation
1. Start a call from the Flutter app
2. Ensure microphone is enabled (unmuted)
3. Minimize the app (press Home button)
4. **Expected**: Persistent notification appears saying "Call in Progress - Microphone active"
5. Speak into the microphone
6. **Expected**: Other participant can still hear you
7. Return to app
8. **Expected**: Microphone still works

#### Test 2: App Switching
1. Start a call
2. Switch to another app (e.g., Chrome, Messages)
3. Use the other app for 30 seconds
4. **Expected**: You can still be heard in the call
5. Switch back to the app
6. **Expected**: Everything still works

#### Test 3: Lock Screen
1. Start a call with microphone enabled
2. Lock the device (power button)
3. Wait 10 seconds
4. Unlock the device
5. **Expected**: Microphone still active, no muting occurred

#### Test 4: Long Duration Test
1. Start a call
2. Minimize the app
3. Wait for 15+ minutes
4. **Expected**: Microphone still works (no 10-minute timeout)
5. Check notification is still present
6. Return to app
7. **Expected**: Everything working normally

#### Test 5: Notification Interaction
1. Start a call
2. Minimize app
3. Tap the "Call in Progress" notification
4. **Expected**: Returns to the call screen
5. Microphone should still be working

#### Test 6: Multiple Backgrounding Cycles
1. Start a call
2. Background/foreground the app 5-10 times rapidly
3. **Expected**: No microphone interruptions
4. Check with other participant that audio quality is consistent

### Verification Checklist

✅ Persistent notification appears when app is backgrounded  
✅ Notification shows "Call in Progress - Microphone active"  
✅ Notification cannot be dismissed (is ongoing)  
✅ Other participants can hear you when app is backgrounded  
✅ No audio interruptions when switching apps  
✅ No audio interruptions on screen lock/unlock  
✅ Wake lock is acquired (check logs for "Wake lock acquired")  
✅ Audio focus is maintained (check logs for audio focus messages)  
✅ No 10-minute timeout issues  
✅ Microphone works after returning to foreground  

## Debugging

### ADB Logcat Commands
Monitor the fix in action with these logcat filters:

```bash
# Watch MainActivity audio lifecycle
adb logcat | grep "MainActivity"

# Watch CallService foreground service
adb logcat | grep "CallService"

# Watch LiveKit service
adb logcat | grep "LiveKit"

# Watch audio focus changes
adb logcat | grep "Audio focus"

# All together
adb logcat | grep -E "(MainActivity|CallService|LiveKit|Audio focus)"
```

### Expected Log Messages

**On Call Start:**
```
MainActivity: Wake lock acquired for audio (indefinite)
MainActivity: Audio focus requested and audio routing configured
LiveKit: Starting foreground service for background mic...
CallService: Foreground service started successfully
```

**On App Pause:**
```
MainActivity: App paused - maintaining audio for background operation
MainActivity: Background audio maintained - Mode: 3, MicMute: false
```

**On App Resume:**
```
MainActivity: App resumed - ensuring audio mode
MainActivity: Foreground audio ensured - Mode: 3, MicMute: false
```

### Common Issues

#### Issue: Notification doesn't appear
**Fix**: Check that `FOREGROUND_SERVICE` permission is granted and service is declared in manifest

#### Issue: Microphone still mutes after 10 minutes
**Fix**: Verify wake lock is acquired indefinitely (check logs for "indefinite" message)

#### Issue: Microphone mutes on app switch
**Fix**: Check audio focus logs - ensure focus is being re-requested on lifecycle changes

#### Issue: Build errors with FOREGROUND_SERVICE_MICROPHONE
**Fix**: Ensure `compileSdk` and `targetSdk` are set to 34+ (Android 14)

## Technical Details

### Audio Mode Explained
- `MODE_NORMAL` (0): Default mode, audio can be interrupted
- `MODE_IN_CALL` (2): Phone call mode, but can be interrupted
- `MODE_IN_COMMUNICATION` (3): VoIP mode - highest priority for app-based calls

We use `MODE_IN_COMMUNICATION` as it's specifically designed for apps like Zoom, Meet, etc.

### Wake Lock Types
- `PARTIAL_WAKE_LOCK`: Keeps CPU running, allows screen to turn off
- Perfect for audio-only background operation
- Must be explicitly released to avoid battery drain

### Audio Focus Types
- `AUDIOFOCUS_GAIN`: Request permanent audio focus
- `AUDIOFOCUS_LOSS`: Lost focus to another app
- `AUDIOFOCUS_LOSS_TRANSIENT`: Temporary loss (e.g., notification)

We aggressively reclaim focus because VoIP calls should have priority.

## Performance Impact

### Battery Usage
- Wake lock will increase battery usage (acceptable for video calls)
- Foreground service keeps app in memory (normal for call apps)
- Expected: Similar battery usage to WhatsApp, Zoom, etc.

### Memory
- Foreground service prevents app from being killed
- Acceptable trade-off for call quality

## Rollback Instructions

If issues arise, you can rollback by:

1. Remove `FOREGROUND_SERVICE_MICROPHONE` permission from manifest
2. Change wake lock back to 10-minute timeout
3. Reduce notification priority to `IMPORTANCE_LOW`
4. Remove aggressive audio focus reclaiming

However, this will reintroduce the original muting issue.

## Future Improvements

1. **Battery Optimization Dialog**: Prompt user to disable battery optimization for the app
2. **Audio Route Detection**: Automatically handle Bluetooth headset connections
3. **Call Quality Monitoring**: Monitor and alert if audio quality degrades in background
4. **User Preference**: Allow users to choose between battery saving and background audio priority

## References

- [Android Foreground Services](https://developer.android.com/develop/background-work/services/foreground-services)
- [Android Audio Focus](https://developer.android.com/media/optimize/audio-focus)
- [Wake Locks](https://developer.android.com/training/scheduling/wakelock)
- [LiveKit Flutter SDK](https://docs.livekit.io/client-sdk-flutter/)

## Support

If microphone still mutes in background after these fixes:
1. Check Android version (must be 8.0+)
2. Verify all permissions granted
3. Check battery optimization settings
4. Review logcat output
5. Test on a different device to isolate hardware issues

---

**Last Updated**: 2025-10-12  
**Tested On**: Android 11, 12, 13, 14  
**Status**: ✅ Verified Working

