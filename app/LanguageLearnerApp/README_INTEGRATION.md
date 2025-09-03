# Language Learner App - Server Integration Guide

## Overview
This React Native mobile app has been refactored to integrate seamlessly with the web frontend and backend server.

## Key Changes

### 1. API Integration
- **API Client**: Updated to use the same endpoints as the web frontend
- **Base URL**: Configured to connect to `http://localhost:4000` (backend server)
- **Android Emulator**: Uses `http://10.0.2.2:4000` for Android emulator connectivity

### 2. Authentication
- **AuthContext**: Implemented to match web frontend authentication flow
- **Token Management**: Supports both cookie-based (web) and token-based (mobile) authentication
- **User Session**: Synchronized with web application user sessions

### 3. Data Models
- **Types**: Updated to match server response formats
- **SRS Integration**: Full compatibility with SRS (Spaced Repetition System) data structures
- **Vocabulary**: Uses the same vocabulary data format as the web app

### 4. Core Features Synchronized

#### Home Screen
- Real-time dashboard stats from server
- SRS queue information
- User streak tracking
- Mastered words count

#### Study Screen
- Fetches actual SRS cards from server
- Submits review results to backend
- Syncs progress with web app
- Real-time streak updates

#### Authentication Flow
- Login/Register using server endpoints
- Session management compatible with web
- Token refresh mechanism

## Configuration

### Development Setup

1. **Start Backend Server**:
   ```bash
   cd web/apps/backend
   npm install
   npm run dev
   # Server runs on port 4000
   ```

2. **Configure Mobile App**:
   - iOS: Uses `http://localhost:4000`
   - Android Emulator: Uses `http://10.0.2.2:4000`
   - Physical Device: Use your machine's IP address

3. **Environment Configuration**:
   Edit `src/config/index.ts` to update API URLs if needed.

### API Endpoints Used

- **Authentication**:
  - POST `/auth/login`
  - POST `/auth/register`
  - POST `/auth/logout`
  - GET `/me`

- **SRS System**:
  - GET `/srs/dashboard`
  - GET `/srs/status`
  - GET `/srs/available`
  - GET `/srs/folders`
  - POST `/srs/cards/{id}/review`

- **User Data**:
  - GET `/user/profile`
  - PATCH `/user/profile`

- **Vocabulary**:
  - GET `/vocab/list`
  - GET `/api/mobile/vocab/paginated`

## Testing the Integration

1. **Start the Backend**:
   ```bash
   cd web/apps/backend
   npm run dev
   ```

2. **Start the Mobile App**:
   ```bash
   cd app/LanguageLearnerApp
   npm install
   
   # For iOS
   cd ios && pod install && cd ..
   npm run ios
   
   # For Android
   npm run android
   ```

3. **Test Features**:
   - Create an account or login
   - Check dashboard data loads correctly
   - Try the study/SRS functionality
   - Verify data syncs with web app

## Troubleshooting

### Connection Issues
- **Android Emulator**: Make sure to use `10.0.2.2` instead of `localhost`
- **iOS Simulator**: `localhost` should work directly
- **Physical Device**: Use your computer's IP address and ensure both devices are on the same network

### CORS Issues
- Backend is configured to accept requests from mobile apps
- Check `web/apps/backend/index.js` for CORS configuration

### Authentication Errors
- Mobile app uses token-based auth while web uses cookies
- Both methods are supported by the backend
- Tokens are stored in AsyncStorage for mobile

## Architecture Notes

### State Management
- Uses Redux for local state management
- AuthContext for authentication state
- API responses are cached for offline support

### Data Flow
1. User action triggers API call via `apiClient`
2. Server processes request and returns data
3. Response is stored in Redux/Context
4. UI updates reactively

### Error Handling
- Network errors are gracefully handled
- Offline mode fallback (data cached locally)
- User-friendly error messages

## Future Improvements

- [ ] Implement full offline mode with data sync
- [ ] Add push notifications for SRS reminders
- [ ] Implement biometric authentication
- [ ] Add voice recognition for pronunciation practice
- [ ] Optimize audio caching for better performance

## Support

For issues or questions about the integration:
1. Check server logs for API errors
2. Use React Native Debugger to inspect network requests
3. Verify environment configuration in `src/config/index.ts`