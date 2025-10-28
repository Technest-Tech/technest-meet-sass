# Quick Rebuild and Test Guide

## Rebuild the App

### Option 1: Clean Rebuild (Recommended)
```bash
cd /Users/ahmedomar/Documents/technest/AlmajdAcademy/almajd-meet-livekit/newmeet_mobile

# Clean previous builds
flutter clean

# Get dependencies
flutter pub get

# Build and install on connected device
flutter run --release

# OR for debug mode with logs
flutter run --debug
```

### Option 2: Quick Rebuild
```bash
cd /Users/ahmedomar/Documents/technest/AlmajdAcademy/almajd-meet-livekit/newmeet_mobile

# Just rebuild without cleaning
flutter run --release
```

## Quick Test Steps

### 1. Initial Setup (2 minutes)
1. Install the rebuilt app on your Android device
2. Launch the app
3. Grant Camera and Microphone permissions when prompted

### 2. Basic Background Test (3 minutes)
1. Join a test meeting room
2. Ensure microphone is unmuted (you should see the mic icon active)
3. Press the Home button to background the app
4. ✅ **Check**: You should see a persistent notification: "Call in Progress - Microphone active"
5. Speak into your device
6. Have another participant confirm they can hear you
7. Tap the notification to return to the app
8. ✅ **Check**: Everything should still be working

### 3. App Switching Test (2 minutes)
1. While in a call, switch to another app (Chrome, Messages, etc.)
2. Use that app for 30 seconds
3. ✅ **Check**: Other participant can still hear you
4. Switch back to the call
5. ✅ **Check**: No issues detected

### 4. Lock Screen Test (1 minute)
1. While in a call, lock your device (press power button)
2. Wait 10 seconds
3. Unlock your device
4. ✅ **Check**: Microphone still works

## Monitoring Logs in Real-Time

While testing, open a terminal and run:

```bash
# Monitor all relevant logs
adb logcat | grep -E "(MainActivity|CallService|LiveKit)"
```

### What to Look For in Logs

**✅ Good Signs:**
```
MainActivity: Wake lock acquired for audio (indefinite)
MainActivity: Audio focus requested and audio routing configured
CallService: Foreground service started successfully
LiveKit: Foreground service started - mic will stay active in background!
MainActivity: App paused - maintaining audio for background operation
MainActivity: Background audio maintained - Mode: 3, MicMute: false
```

**❌ Bad Signs:**
```
Error starting foreground service
Permission denied
Wake lock timeout
Audio focus lost
```

## Expected Results

After rebuilding with the fixes:

✅ **Notification appears** when app is backgrounded  
✅ **Microphone stays active** in background  
✅ **No muting** after 10 minutes  
✅ **Audio works** after app switching  
✅ **Audio works** after lock/unlock  
✅ **Foreground service** keeps running  

## If Something Doesn't Work

### Check 1: Permissions
```bash
# Check if permissions are granted
adb shell dumpsys package com.newmeet.app.newmeet_mobile | grep permission
```

### Check 2: Service Status
```bash
# Check if foreground service is running
adb shell dumpsys activity services | grep CallService
```

### Check 3: Wake Lock Status
```bash
# Check wake locks
adb shell dumpsys power | grep Wake
```

### Check 4: Audio Focus
```bash
# Check audio focus
adb shell dumpsys audio | grep "Audio Focus"
```

## Common Build Issues

### Issue: Build fails with "SDK version" error
**Solution:**
```bash
cd android
./gradlew clean
cd ..
flutter clean
flutter pub get
flutter run
```

### Issue: "Permission denied" errors
**Solution:**
1. Uninstall the old app from device
2. Reinstall with `flutter run`

### Issue: Changes not reflected
**Solution:**
```bash
# Force complete rebuild
flutter clean
cd android
./gradlew clean
cd ..
flutter pub get
flutter run --release
```

## Quick Validation Checklist

After rebuilding, test these 5 things (takes ~5 minutes):

1. [ ] Join a meeting
2. [ ] Background the app - notification appears
3. [ ] Other participant can hear you while app is backgrounded
4. [ ] Lock and unlock device - mic still works
5. [ ] Return to app - everything normal

If all 5 pass, the fix is working! ✅

## Performance Check

The app will use more battery during calls now (this is normal and expected):

- **Expected Battery Usage**: Similar to Zoom, WhatsApp calls
- **Wake Lock**: Keeps CPU active (necessary for audio)
- **Foreground Service**: Keeps app in memory (prevents OS from killing it)

This is the **correct behavior** for a video calling app.

## Next Steps

Once you've verified the fix works:

1. Test with real meetings (not just test rooms)
2. Test with longer calls (30+ minutes)
3. Test on different Android versions if possible
4. Consider adding the app to battery optimization whitelist for best results

## Need Help?

Check the full documentation: `BACKGROUND_MICROPHONE_FIX.md`

---

**Quick Start**: Just run `flutter clean && flutter pub get && flutter run --release` and test backgrounding the app during a call.

