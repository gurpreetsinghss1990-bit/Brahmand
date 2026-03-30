# Expo Firebase Auth Setup

This project now uses:

- **Web**: Firebase JS SDK phone auth (`firebase/auth`) with `RecaptchaVerifier`
- **Native (Android/iOS)**: React Native Firebase (`@react-native-firebase/auth`)

## Installed dependencies

In `frontend/package.json`:

- `firebase`
- `@react-native-firebase/app`
- `@react-native-firebase/auth`
- `@react-native-firebase/analytics`
- `expo-build-properties`

Deprecated package removed:

- `expo-firebase-recaptcha`

## Expo config requirements

`app.json` includes:

- `plugins` entry for `expo-build-properties` with iOS static frameworks
- `expo.ios.googleServicesFile` → `./GoogleService-Info.plist`
- `expo.android.googleServicesFile` → `./google-services.json`

## Required native Firebase files

Place these files in `frontend/`:

- `GoogleService-Info.plist` (iOS)
- `google-services.json` (Android)

## Commands

Install deps:

```bash
cd frontend
npm install
```

Android prebuild only:

```bash
cd frontend
npx expo prebuild --platform android --no-install
```

Android dev build (EAS):

```bash
cd frontend
npx eas build --profile development --platform android
```

Start Metro for dev client:

```bash
cd frontend
npx expo start --dev-client
```

## Notes

- If `android/` or `ios/` folders are present, EAS uses native config from those folders.
- Run `expo prebuild` after config/plugin changes so native projects stay in sync.
