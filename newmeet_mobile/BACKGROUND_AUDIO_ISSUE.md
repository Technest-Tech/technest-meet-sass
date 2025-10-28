# Background Audio Issue - Android Flutter App

## Problem Statement
When the Flutter app is minimized (user switches to another app), the microphone gets muted and other participants cannot hear the user. The user must return to the app for others to hear them again.

## What We've Implemented

### 1. ✅ Foreground Service (`CallService`)
- Shows persistent notification "Call in Progress"
- Uses `phoneCall` service type
- Keeps app process alive

### 2. ✅ Audio Focus Management
- Requests `AUDIOFOCUS_GAIN` with `USAGE_VOICE_COMMUNICATION`
- Sets audio mode to `MODE_IN_COMMUNICATION`
- Prevents audio ducking with `setWillPauseWhenDucked(false)`

### 3. ✅ Microphone Keepalive Timer
- Checks microphone state every 2 seconds
- Automatically re-enables if muted
- Tracks intended microphone state

### 4. ✅ Lifecycle State Management
- Monitors `AppLifecycleState` changes
- Saves microphone state before pausing
- Restores microphone state when resuming

### 5. ✅ Room Configuration
- `adaptiveStream: true`
- `dynacast: true`
- Optimized for stability

## The Core Issue

The problem is that **WebRTC's audio track is being paused at the native level** when the app goes to background. This is a deliberate Android behavior for privacy and battery management.

Even though our code tries to re-enable the microphone, the underlying WebRTC MediaStreamTrack is in a paused state and doesn't transmit audio.

## Why This Happens

### Android Behavior:
1. When app goes to background, Android's `ActivityManager` signals the app
2. The WebRTC native layer (C++) receives this signal
3. WebRTC automatically pauses audio capture for privacy/battery
4. The Flutter layer doesn't have direct control over this native behavior

### Device-Specific Issues:
- Some manufacturers (Xiaomi, Oppo, Huawei) are more aggressive
- They have custom "battery optimization" that kills background processes
- Some require manual whitelist configuration

## Potential Solutions

### Solution 1: Use Android's ConnectionService API ⭐ RECOMMENDED
This is how native video calling apps (WhatsApp, Zoom, etc.) work.

**What it does:**
- Integrates with Android's native call UI
- Shows in-call notification and controls
- Prevents audio from being paused
- Works even when screen is locked

**Implementation:**
- Requires native Android code
- Use `ConnectionService` and `TelecomManager`
- Register app as a "Phone Account"
- Handle call state properly

**Complexity:** High, but most reliable

### Solution 2: Keep Screen On (Partial Solution)
**What it does:**
- Uses `WAKE_LOCK` to keep screen on
- Prevents deep sleep
- Audio may still pause when switching apps

**Pros:**
- Simple to implement
- Works for some scenarios

**Cons:**
- High battery drain
- Doesn't work when user explicitly locks screen
- Audio still pauses on some devices

### Solution 3: Picture-in-Picture Mode
**What it does:**
- Keeps app "visible" in PIP window
- Android treats it as foreground
- Audio continues playing

**Pros:**
- Relatively simple
- Good user experience

**Cons:**
- Requires user to enable PIP
- Takes screen space
- Doesn't work for audio-only calls

### Solution 4: Accept the Limitation
**What it does:**
- Document the behavior
- Tell users to keep app in foreground
- Show warning when minimizing

**Pros:**
- No development effort
- Clear expectations

**Cons:**
- Poor user experience
- Not competitive with other apps

## Recommended Approach

### Short Term (Current Implementation)
Keep all current fixes active:
- ✅ Foreground service notification
- ✅ Audio focus management
- ✅ Microphone keepalive

**Why:** These help but don't fully solve the issue on all devices.

### Medium Term (Best Solution)
**Implement ConnectionService API**

This is what professional calling apps use. It requires:

1. **Create a `CallService` extending `ConnectionService`:**
```kotlin
class VoipConnectionService : ConnectionService() {
    override fun onCreateOutgoingConnection(...): Connection {
        // Create and return VoipConnection
    }
    
    override fun onCreateIncomingConnection(...): Connection {
        // Handle incoming call
    }
}
```

2. **Register with TelecomManager:**
```kotlin
val telecomManager = getSystemService(TelecomManager::class.java)
val phoneAccount = PhoneAccount.builder(...)
    .setCapabilities(PhoneAccount.CAPABILITY_CALL_PROVIDER)
    .build()
telecomManager.registerPhoneAccount(phoneAccount)
```

3. **Show in-call UI:**
- Android will show native in-call notification
- Audio will stay active automatically
- Screen lock won't affect call

4. **Update Flutter bridge:**
- Connect Flutter UI to ConnectionService
- Handle call state changes
- Sync mute/unmute state

**Estimated effort:** 3-5 days development + testing

### Long Term
**Consider using existing packages:**
- `flutter_callkeep` - Provides ConnectionService integration
- `flutter_call_kit` - iOS + Android call integration
- These packages handle the native complexity

## Testing Checklist

To properly test background audio:

### Device Setup:
- [ ] Test on stock Android (Pixel, Nokia)
- [ ] Test on Samsung (One UI)
- [ ] Test on Xiaomi (MIUI) - known to be aggressive
- [ ] Test on Oppo/Realme (ColorOS)
- [ ] Test on different Android versions (10, 11, 12, 13, 14)

### Test Scenarios:
- [ ] Minimize app with Home button
- [ ] Switch to another app
- [ ] Lock screen
- [ ] Incoming notification
- [ ] Long duration (10+ minutes)
- [ ] With battery saver enabled
- [ ] With app in battery optimization whitelist

### Expected Behavior (Current Implementation):
- ❌ Mic mutes when app goes to background on most devices
- ✅ Mic works when app is in foreground
- ✅ Audio playback continues (hearing others)
- ✅ Foreground notification shows

### Expected Behavior (With ConnectionService):
- ✅ Mic stays active when app goes to background
- ✅ Works with screen locked
- ✅ Native in-call UI
- ✅ Integrated with system call controls

## Current Workarounds

### For Users:
1. **Keep app in foreground** - Most reliable
2. **Use split screen** - App stays "active"
3. **Disable battery optimization:**
   - Settings → Apps → Almajd Meet
   - Battery → Unrestricted
4. **Use Picture-in-Picture** (if implemented)

### For Developers:
1. **Add warning when minimizing:**
   ```dart
   showDialog(
     context: context,
     builder: (context) => AlertDialog(
       title: Text('Keep App Open'),
       content: Text('For best experience, keep app in foreground during call.'),
     ),
   );
   ```

2. **Show persistent notification:**
   - Already implemented ✅
   - Reminds user call is active

3. **Add "Return to Call" quick action:**
   - Notification tap returns to app
   - Already implemented ✅

## Conclusion

**The microphone muting in background is expected Android behavior.** Our current implementation helps but cannot fully overcome OS-level restrictions without using ConnectionService API.

### Next Steps:
1. **Document current limitation** for users
2. **Plan ConnectionService implementation** 
3. **Consider using `flutter_callkeep` package** for faster implementation
4. **Test on multiple devices** to understand exact behavior

### Developer Time Estimate:
- **DIY ConnectionService:** 3-5 days
- **Using flutter_callkeep:** 1-2 days  
- **Accept limitation + document:** 1 hour

---

**Status:** Active Issue  
**Priority:** High  
**Last Updated:** October 12, 2025  
**Assigned To:** Development Team


