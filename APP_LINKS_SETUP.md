# Android App Links Setup - Automatic Deep Linking

## Overview
This setup enables **automatic deep linking** - when users click `https://acadmyq.com/9h3t0u5/h`, the app opens automatically without any manual configuration.

## What Was Done

### 1. ✅ Enabled App Links Verification
- Re-enabled `android:autoVerify="true"` in `AndroidManifest.xml`
- This tells Android to verify domain ownership

### 2. ✅ Created Domain Verification File
- Created `public/.well-known/assetlinks.json`
- Contains your app's package name and certificate fingerprint
- Must be accessible at: `https://acadmyq.com/.well-known/assetlinks.json`

### 3. ✅ Rebuilt App
- Built release APK with App Links verification enabled

## Deployment Steps

### Step 1: Deploy Verification File to Server

The file `public/.well-known/assetlinks.json` is already created. When you deploy your Next.js app, it will be automatically accessible at:

```
https://acadmyq.com/.well-known/assetlinks.json
```

**Important**: Make sure this file is accessible with:
- Content-Type: `application/json`
- HTTPS (not HTTP)
- No redirects
- Accessible without authentication

### Step 2: Verify File is Accessible

After deploying, test the file is accessible:

```bash
curl https://acadmyq.com/.well-known/assetlinks.json
```

Expected response:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.newmeet.app.newmeet_mobile",
    "sha256_cert_fingerprints": [
      "31:54:96:36:52:E6:2A:F5:9F:AE:1D:F6:BA:61:CD:99:5E:1D:E5:4D:11:2C:4B:66:AB:43:6C:76:F4:A4:83:92"
    ]
  }
}]
```

### Step 3: Install Release APK

Install the release APK (not debug) on devices:

```bash
# The release APK is at:
newmeet_mobile/build/app/outputs/flutter-apk/app-release.apk

# Install it:
adb install -r newmeet_mobile/build/app/outputs/flutter-apk/app-release.apk
```

**Important**: 
- Use **release APK** (signed with your keystore)
- Debug APKs won't work with App Links verification
- The certificate fingerprint in `assetlinks.json` matches your release keystore

### Step 4: Android Verifies Domain (Automatic)

When the app is installed:
1. Android checks `https://acadmyq.com/.well-known/assetlinks.json`
2. Verifies the certificate fingerprint matches
3. Associates the domain with your app
4. **No user action required!**

### Step 5: Test Deep Links

After installation, test:

1. **From Browser:**
   - Open Chrome
   - Type: `https://acadmyq.com/9h3t0u5/h`
   - App should open automatically ✅

2. **From WhatsApp/Email:**
   - Send link: `https://acadmyq.com/9h3t0u5/h`
   - Click it
   - App should open automatically ✅

3. **From Any App:**
   - Any `acadmyq.com` link opens in app automatically ✅

## Verification Status

Check if Android verified your domain:

```bash
adb shell pm get-app-links com.newmeet.app.newmeet_mobile
```

Look for:
```
Verified:
  acadmyq.com
```

If it shows "Unverified" or "Disabled", check:
1. File is accessible at the URL
2. Content-Type is `application/json`
3. Using release APK (not debug)
4. Certificate fingerprint matches

## Troubleshooting

### Issue: Links still open in browser

**Solution 1: Check verification file**
```bash
curl -I https://acadmyq.com/.well-known/assetlinks.json
# Should return: Content-Type: application/json
```

**Solution 2: Verify domain association**
```bash
adb shell pm get-app-links com.newmeet.app.newmeet_mobile
```

**Solution 3: Force re-verification**
```bash
adb shell pm verify-app-links --re-verify com.newmeet.app.newmeet_mobile
```

**Solution 4: Clear app data and reinstall**
```bash
adb uninstall com.newmeet.app.newmeet_mobile
adb install newmeet_mobile/build/app/outputs/flutter-apk/app-release.apk
```

### Issue: Verification file not found

- Check file exists: `public/.well-known/assetlinks.json`
- Check Next.js serves it: Files in `public/` are served at root
- Check server configuration (nginx/apache) allows `.well-known` directory
- Check HTTPS is working (required for App Links)

### Issue: Certificate mismatch

If you change your signing key, update the fingerprint in `assetlinks.json`:

```bash
# Get new fingerprint
keytool -list -v -keystore android/app/academiq-meet-key.jks \
  -alias academiq-meet -storepass academiq2024 -keypass academiq2024 \
  | grep "SHA256:" | sed 's/.*SHA256: //' | tr -d ' ' | tr ':' ' '
```

Then update `public/.well-known/assetlinks.json` with the new fingerprint.

## Current Configuration

- **Package Name**: `com.newmeet.app.newmeet_mobile`
- **Domain**: `acadmyq.com`
- **Certificate SHA256**: `31:54:96:36:52:E6:2A:F5:9F:AE:1D:F6:BA:61:CD:99:5E:1D:E5:4D:11:2C:4B:66:AB:43:6C:76:F4:A4:83:92`
- **Verification URL**: `https://acadmyq.com/.well-known/assetlinks.json`

## Testing Checklist

- [ ] Verification file deployed and accessible
- [ ] Release APK installed (not debug)
- [ ] Domain verified by Android (check with `pm get-app-links`)
- [ ] Test link from browser opens app
- [ ] Test link from WhatsApp opens app
- [ ] Test link from email opens app
- [ ] No chooser dialog appears (opens directly)

## Next Steps

1. **Deploy your Next.js app** (the verification file will be included)
2. **Verify file is accessible** at `https://acadmyq.com/.well-known/assetlinks.json`
3. **Distribute release APK** to users
4. **Test deep links** - they should work automatically!

## Notes

- ✅ Works automatically for all users (no manual setup)
- ✅ No chooser dialog (opens directly in app)
- ✅ Works from any app (browser, WhatsApp, email, etc.)
- ✅ Requires release APK (signed with matching certificate)
- ✅ Requires verification file on server (already created)


