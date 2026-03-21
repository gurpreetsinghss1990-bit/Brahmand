# Sanatan Lok - Firebase Hosting Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Firebase CLI installed globally
3. Access to Firebase project "sanatan-lok"

## Step 1: Install Firebase CLI (if not installed)

```bash
npm install -g firebase-tools
```

## Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

## Step 3: Verify Firebase Project

```bash
firebase projects:list
```

Ensure "sanatan-lok" is in the list.

## Step 4: Build the Expo Web App

```bash
cd /app/frontend

# Install dependencies (if needed)
yarn install

# Build for web production
npx expo export -p web
```

This creates the `dist` folder with the production build.

## Step 5: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

## Step 6: Add Domain to Firebase Auth (IMPORTANT)

After deployment, add the domain to Firebase Authentication:

1. Go to Firebase Console: https://console.firebase.google.com/project/sanatan-lok
2. Navigate to: Authentication → Settings → Authorized domains
3. Click "Add domain"
4. Add: `sanatan-lok.web.app`
5. Also add: `sanatan-lok.firebaseapp.com`

## Deployment URL

After successful deployment, the app will be available at:

**https://sanatan-lok.web.app**

## Quick Deploy Commands (All-in-One)

```bash
cd /app/frontend
yarn install
npx expo export -p web
firebase deploy --only hosting
```

## Troubleshooting

### "Permission denied" error
- Run `firebase login` again
- Ensure your Google account has access to the Firebase project

### "Project not found" error
- Run `firebase use sanatan-lok`
- Or check `.firebaserc` has correct project ID

### OTP Authentication not working
- Verify domain is added to Firebase Auth authorized domains
- Check Firebase Console → Authentication → Settings

### Build errors
- Clear cache: `npx expo start --clear`
- Delete node_modules and reinstall: `rm -rf node_modules && yarn install`

## Environment Variables for Production

The app uses these environment variables (already configured):

- `EXPO_PUBLIC_BACKEND_URL` - Backend API URL

For production, update `.env` with your production backend URL:

```
EXPO_PUBLIC_BACKEND_URL=https://your-production-api.com
```

## Features Included in This Build

- ✅ Firebase OTP Phone Authentication
- ✅ Firestore Database Integration
- ✅ Private Messaging with Read Receipts
- ✅ Community Chat (no KYC required)
- ✅ Temple Announcement Channels
- ✅ KYC System for Temple/Vendor/Organizer
- ✅ Report System
- ✅ Privacy Settings
- ✅ Terms & Conditions Acceptance
- ✅ Community Guidelines

## Support

If you encounter issues, check:
1. Firebase Console for any service alerts
2. Browser console for JavaScript errors
3. Network tab for API failures
