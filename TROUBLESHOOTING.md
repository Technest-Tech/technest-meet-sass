# Troubleshooting Guide for NewMeet Video Conferencing Issues

## Issues You're Experiencing

1. **"Element not part of the array: _camera_placeholder not in Teacher9_camera_TR_VC9bVwyAxum7Qz"**
2. **"Unknown DataChannel error on lossy {}"**
3. **"Unknown DataChannel error on reliable {}"**
4. **No controller buttons visible after joining the room**
5. **Infinite connection loop** ⚠️ **NEW ISSUE IDENTIFIED AND FIXED**

## Solutions

### 1. Set Up Environment Variables

The main issue is that the `NEXT_PUBLIC_SHOW_SETTINGS_MENU` environment variable is not set, which prevents the control buttons from appearing.

Run this command to set up the environment variables:

```bash
./setup-env.sh
```

This will create a `.env.local` file with the necessary configuration.

### 2. Restart Your Development Server

After setting up the environment variables, restart your development server:

```bash
pnpm dev
```

### 3. What Was Fixed

- ✅ **Control Buttons**: Added a custom control bar with camera/microphone toggle buttons
- ✅ **Settings Menu**: Always shows the settings menu component
- ✅ **Error Handling**: Added better error handling and connection status display
- ✅ **Debugging**: Added console logging to help troubleshoot issues
- ✅ **Environment Variables**: Set `NEXT_PUBLIC_SHOW_SETTINGS_MENU="true"`
- ✅ **Infinite Loop Fix**: Fixed the connection loop that was causing constant reconnections
- ✅ **Connection Timeout**: Added 30-second timeout to prevent hanging connections
- ✅ **Retry Mechanism**: Added manual retry button for failed connections
- ✅ **Loading States**: Better visual feedback during connection process

### 4. Control Bar Features

The new control bar includes:
- **Camera Toggle**: Turn camera on/off
- **Microphone Toggle**: Turn microphone on/off
- **Device Selection**: Dropdown menus for camera and microphone devices
- **Settings Button**: Access to advanced settings
- **Connection Status**: Shows connection state at the top
- **Loading Indicator**: Shows when connection is in progress

### 5. DataChannel Errors

The DataChannel errors are LiveKit internal communication errors that usually don't affect functionality. They're often related to:
- Network connectivity issues
- LiveKit server configuration
- Browser compatibility

These errors are typically harmless and the video conferencing should still work.

### 6. Camera Placeholder Error

The camera placeholder error suggests there might be an issue with video track handling. The improved error handling should help identify and resolve this.

### 7. Infinite Connection Loop (FIXED)

**This was a critical issue that has been resolved:**

- **Problem**: The app was constantly connecting and disconnecting from the room
- **Cause**: React useEffect dependencies causing infinite re-renders
- **Solution**: Added proper state management with useRef to prevent multiple connections
- **Result**: Single connection attempt with proper cleanup and retry mechanism

## Testing

1. Navigate to: `http://localhost:3000/room/sample-host?type=host`
2. You should now see:
   - Control buttons at the bottom of the screen
   - Connection status at the top (no more infinite loops!)
   - Settings menu accessible via the Settings button
   - Better error messages if something goes wrong
   - Retry button for failed connections
   - Connection timeout protection

## If Issues Persist

1. Check the browser console for detailed error messages
2. Ensure LiveKit server is running (`ws://localhost:7880`)
3. Check that camera and microphone permissions are granted
4. Try refreshing the page after granting permissions
5. Use the retry button if connection fails
6. Check the connection status indicator for real-time feedback

## Additional Help

- Check the browser console for detailed logs
- The DebugMode component will show additional LiveKit debugging information
- Connection status indicator shows real-time connection state
- Connection timeout prevents hanging connections
- Manual retry mechanism for failed connections

## Recent Fixes Applied

- **Infinite Loop**: Fixed useEffect dependencies causing constant reconnections
- **Connection Management**: Added proper state tracking with useRef
- **Timeout Protection**: 30-second connection timeout
- **Retry Functionality**: Manual retry button for failed connections
- **Loading States**: Better visual feedback during connection process
- **Error Recovery**: Improved error handling and user feedback
