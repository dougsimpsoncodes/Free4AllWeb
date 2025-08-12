# 🚀 APNs Setup: Ready-to-Follow Guide

You have an Apple Developer account, so let's get APNs working securely in 15 minutes!

## Step 1: Generate APNs Key (5 minutes)

### 1.1 Open Apple Developer Portal
- Go to [developer.apple.com/account](https://developer.apple.com/account)
- Sign in with your Apple Developer account

### 1.2 Navigate to Keys
- Click **"Certificates, Identifiers & Profiles"**
- In the sidebar, click **"Keys"**
- Click the **"+"** button (Create a new key)

### 1.3 Create APNs Key
- **Key Name**: Enter `Free4AllWeb APNs Key`
- **Check the box**: ✅ Apple Push Notifications service (APNs)
- Click **"Continue"** → **"Register"**

### 1.4 Download Key (⚠️ CRITICAL - One time only!)
- **IMMEDIATELY download** the `.p8` file
- **Write down** these values:
  - **Key ID**: (10 characters, like `AB12CD34EF`)
  - **Team ID**: (10 characters, top-right corner like `XYZ98765`)
- **Move the file** to a secure location immediately:
  ```bash
  mv ~/Downloads/AuthKey_*.p8 ~/secure/
  ```

## Step 2: Secure Setup (5 minutes)

### 2.1 Create Credentials Directory
```bash
cd /Users/dougsimpson/Projects/Free4AllWeb
mkdir -p credentials
chmod 700 credentials/
```

### 2.2 Copy & Secure the Key File
```bash
# Replace AuthKey_YOUR_KEY.p8 with your actual filename
cp ~/Downloads/AuthKey_YOUR_KEY.p8 ./credentials/apns-key.p8
chmod 600 ./credentials/apns-key.p8
```

### 2.3 Update .env File
Add these lines to your `.env` file:
```bash
# Apple Push Notifications
APNS_KEY_ID=YOUR_KEY_ID_HERE
APNS_TEAM_ID=YOUR_TEAM_ID_HERE  
APNS_BUNDLE_ID=com.free4allweb.app
APNS_PRIVATE_KEY_PATH=./credentials/apns-key.p8
APNS_ENVIRONMENT=sandbox
```

**Replace the placeholders:**
- `YOUR_KEY_ID_HERE` → The 10-character Key ID from Apple
- `YOUR_TEAM_ID_HERE` → The 10-character Team ID from Apple

## Step 3: Test & Verify (5 minutes)

### 3.1 Run Security Validation
```bash
node scripts/test-apns-setup.js
```

**Expected result:** All checks should pass ✅

### 3.2 Restart Server
```bash
# Kill current server (Ctrl+C)
PORT=5001 npm run dev
```

**Expected result:** Should see `✅ APNs Service initialized for development`

### 3.3 Test APNs Status
```bash
curl http://localhost:5001/api/test/apns-status
```

**Expected result:** `"ready": true` and `"configured": true`

### 3.4 Test Device Registration
```bash
curl -X POST http://localhost:5001/api/test/device-token \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"test_ios_device_token_123456","platform":"ios"}'
```

### 3.5 Test Notification Sending
```bash
curl -X POST http://localhost:5001/api/test/send-notification \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","type":"deal"}'
```

**Expected result:** `"successful": 1` (or 0 if no device registered)

## Step 4: Create iOS Test App (Optional)

If you want to test with a real device:

### 4.1 Create iOS Project in Xcode
- **Bundle Identifier**: `com.free4allweb.app` (must match APNS_BUNDLE_ID)
- **Team**: Select your Apple Developer team

### 4.2 Add Push Notification Capability
- Select your project → Target → **"Signing & Capabilities"**
- Click **"+ Capability"** → Add **"Push Notifications"**

### 4.3 Use Test Code
- Copy the code from `ios-test-app.swift`
- Replace the server URL with your local IP if testing on device
- Run the app and allow notifications

## Troubleshooting

### ❌ "APNs credentials not fully configured"
- Check that all environment variables are set
- Verify the .p8 file path is correct
- Run `node scripts/test-apns-setup.js` for details

### ❌ File permission errors
```bash
chmod 600 ./credentials/apns-key.p8
chmod 700 ./credentials/
```

### ❌ Key format errors
- Ensure you downloaded the `.p8` file, not `.cer`
- The file should start with `-----BEGIN PRIVATE KEY-----`

### ❌ Team ID not found
- Look in the top-right corner of Apple Developer portal
- Should be 10 characters like `A1B2C3D4E5`

## Success Indicators

When everything is working, you'll see:

1. **Server startup:**
   ```
   ✅ APNs Service initialized for development
      Bundle ID: com.free4allweb.app
      Team ID: A1B2****
      Key ID: AB12****
   ```

2. **Status endpoint:**
   ```json
   {
     "ready": true,
     "status": {
       "apns": {
         "configured": true,
         "provider": "Apple Push Notifications"
       }
     }
   }
   ```

3. **Test notification:**
   ```json
   {
     "success": true,
     "result": {
       "successful": ["device_token"],
       "failed": []
     }
   }
   ```

## Next Steps After Setup

1. **Test with real iOS device** using the test app
2. **Integrate into your iOS app** with device token registration
3. **Deploy to staging** environment for team testing
4. **Set up monitoring** for production deployment

## Security Reminders

- ✅ `.p8` files are in `.gitignore` - will never be committed
- ✅ File permissions are restrictive (600/700)
- ✅ Environment variables are not committed to git
- ✅ Security validation script checks everything

Your APNs setup will be production-ready and secure! 🎉