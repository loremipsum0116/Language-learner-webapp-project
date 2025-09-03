# Firebase Push Notification Setup Guide

## Prerequisites
- Firebase Console account
- Apple Developer account (for iOS)
- CocoaPods installed (for iOS)

## Firebase Console Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: "LanguageLearnerApp"
4. Follow the setup wizard

### 2. Add iOS App
1. In Firebase Console, click "Add app" → iOS
2. Enter iOS bundle ID: `com.yourcompany.LanguageLearnerApp`
3. Download `GoogleService-Info.plist`
4. Place the file in `/ios/LanguageLearnerApp/` directory

### 3. Add Android App
1. In Firebase Console, click "Add app" → Android
2. Enter Android package name: `com.languagelearnerapp`
3. Download `google-services.json`
4. Place the file in `/android/app/` directory

## iOS Setup

### 1. Install CocoaPods Dependencies
```bash
cd ios
pod install
```

### 2. Enable Push Notifications in Xcode
1. Open `LanguageLearnerApp.xcworkspace` in Xcode
2. Select your project in the navigator
3. Select your app target
4. Go to "Signing & Capabilities" tab
5. Click "+ Capability"
6. Add "Push Notifications"
7. Add "Background Modes" and check:
   - Remote notifications
   - Background fetch

### 3. Configure APNs Authentication Key
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to Certificates, Identifiers & Profiles
3. Create an APNs Auth Key:
   - Go to Keys → Create a new key
   - Check "Apple Push Notifications service (APNs)"
   - Download the `.p8` file
4. In Firebase Console:
   - Go to Project Settings → Cloud Messaging
   - Under iOS app configuration, upload the APNs Auth Key
   - Enter Key ID and Team ID

## Android Setup

### 1. Update Android Build Files

#### android/build.gradle
Add to buildscript dependencies:
```gradle
classpath 'com.google.gms:google-services:4.3.15'
```

#### android/app/build.gradle
At the bottom of the file:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 2. Add Permissions
The permissions are already configured in AndroidManifest.xml

## Testing Push Notifications

### Send Test Notification from Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter notification title and text
4. Select your app
5. Send test message

### Send Test Notification via FCM API
```javascript
// Example server-side code
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const message = {
  notification: {
    title: 'Test Notification',
    body: 'This is a test message'
  },
  token: 'FCM_TOKEN_FROM_APP'
};

admin.messaging().send(message)
  .then(response => console.log('Successfully sent:', response))
  .catch(error => console.log('Error sending:', error));
```

## App Integration

### Initialize in App
The notification service is automatically initialized when the app starts.

### Request Permission
```typescript
import {useNotifications} from './src/hooks/useNotifications';

const {requestPermission} = useNotifications();

// Request permission
const granted = await requestPermission();
```

### Subscribe to Topics
```typescript
const {subscribeToTopic} = useNotifications();

// Subscribe to a topic
await subscribeToTopic('daily_reminders');
```

### Handle Notifications
```typescript
const {lastNotification} = useNotifications();

// React to notifications
useEffect(() => {
  if (lastNotification) {
    console.log('New notification:', lastNotification);
    // Handle notification
  }
}, [lastNotification]);
```

## Troubleshooting

### iOS Issues
- **No notifications received**: Check APNs configuration in Firebase Console
- **Build errors**: Run `cd ios && pod install`
- **Permission issues**: Check device settings → Notifications → Your App

### Android Issues
- **No notifications received**: Check google-services.json is in correct location
- **Build errors**: Sync project with gradle files
- **Background notifications**: Ensure app has battery optimization exemption

### Common Issues
- **FCM token not generated**: Check internet connection and Firebase configuration
- **Topic subscription failed**: Ensure valid topic name (no spaces, special characters)
- **Notification not showing in foreground**: iOS shows notifications in foreground, Android requires local notification

## Environment Variables
Add to your `.env` file:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

## Security Notes
- Never commit `GoogleService-Info.plist` or `google-services.json` to public repositories
- Use environment variables for sensitive configuration
- Implement server-side token validation for production apps
- Rate limit notification sending to prevent spam

## Additional Resources
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase](https://rnfirebase.io/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)