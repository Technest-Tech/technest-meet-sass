# Deep Link Setup Instructions

## Problem
When clicking `https://acadmyq.com/9h3t0u5/h`, the link opens in browser instead of the app.

## Solution: Enable App Link Handling on Your Device

### Method 1: Via Settings (Recommended)

1. **Open Android Settings** on your device
2. Go to **Apps** (or **Application Manager**)
3. Find and tap **"Academiq Meet"** (or your app name)
4. Scroll down and tap **"Open by default"** (or **"Set as default"**)
5. Tap **"Add link"** or **"Supported web addresses"**
6. Enable **"acadmyq.com"** by toggling it ON
7. If you see **"Go to supported URLs"**, tap it and enable **"Open supported links"**
8. Select **"Open in this app"** or **"Always"**

### Method 2: Via Link Click (Easier)

1. **Click the link** `https://acadmyq.com/9h3t0u5/h` from any app (WhatsApp, Email, Browser)
2. Android will show a **chooser dialog** with options:
   - Chrome/Browser
   - Academiq Meet
   - Other apps (if any)
3. **Select "Academiq Meet"**
4. **Check "Always"** (or tap "Just once" to test first)
5. Tap **"Open"**

After this, all `acadmyq.com` links will open in your app automatically!

### Method 3: Via ADB (For Developers)

If you have ADB access, you can try:

```bash
# Get user ID first
adb shell pm list users

# Then enable (replace USER_ID with actual user ID, usually 0)
adb shell cmd package set-app-links-user-selection --user USER_ID --package com.newmeet.app.newmeet_mobile true acadmyq.com
```

## Verify It Works

After enabling, test by:
1. Opening Chrome
2. Typing: `https://acadmyq.com/9h3t0u5/h`
3. The app should open directly (no chooser)

Or send yourself a link via WhatsApp and click it - should open in app.

## Troubleshooting

### If chooser still appears:
- Make sure you selected "Always" when choosing the app
- Go to Settings → Apps → Academiq Meet → Open by default → Clear defaults
- Then click the link again and select "Always"

### If link still opens in browser:
- Uninstall and reinstall the app
- Then follow Method 2 above

### If nothing happens:
- Check that the app is installed: `adb shell pm list packages | grep newmeet`
- Verify intent filter: The app should appear in the chooser dialog

## Why This Happens

Without `android:autoVerify="true"` (which requires server verification), Android doesn't automatically associate your app with the domain. You need to manually set it once, then Android remembers your choice.

This is normal behavior for basic deep links (non-verified App Links).


