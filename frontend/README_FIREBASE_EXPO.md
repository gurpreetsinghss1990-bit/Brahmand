Expo Firebase Phone Auth Setup

Install packages in the frontend project:

```bash
cd frontend
npm install firebase expo-firebase-recaptcha
```

Notes:
- `expo-firebase-recaptcha` provides `FirebaseRecaptchaVerifierModal` used in the phone screen.
- The project already has `src/services/firebase/config.ts` which initializes Firebase; ensure the `firebaseConfig` object matches your Firebase project's WEB config.
- For Expo-managed apps, follow `expo-firebase-recaptcha` docs to configure app.json and web settings if necessary.

Quick run:

```bash
cd frontend
npx expo start --clear
```

If you want, I can also add the `FirebaseRecaptchaVerifierModal` configuration to the app-level layout and ensure web compatibility.