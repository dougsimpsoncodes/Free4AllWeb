# APNs Setup Instructions

## 1. Add to your .env file:

```bash
# Apple Push Notifications (APNs)
APNS_AUTH_KEY=-----BEGIN PRIVATE KEY-----
[paste the contents of your .p8 file here - the entire private key]
-----END PRIVATE KEY-----
APNS_KEY_ID=AB12CD34EF
APNS_TEAM_ID=YOUR_TEAM_ID  
APNS_BUNDLE_ID=com.free4all.dealapp
```

## 2. How to get the private key content:

```bash
# Open your downloaded .p8 file with a text editor
# Copy the ENTIRE contents including the BEGIN/END lines
# Paste into APNS_AUTH_KEY (replace newlines with \n)
```

## 3. Find your Team ID:
- In Apple Developer portal, look at top-right corner
- 10-character string like "A1B2C3D4E5"

## 4. Bundle ID:
- Use: com.free4all.dealapp (or whatever you want for your app)
- You'll need to create an App ID with this bundle ID later

## 5. Test the setup:
Once configured, restart the server and you should see:
```
✅ APNs Service initialized for development
   Bundle ID: com.free4all.dealapp
   Team ID: A1B2****
   Key ID: AB12****
```

Instead of:
```
APNs credentials not fully configured. Push notifications will be disabled.
```