Switching to Firebase Phone Authentication (Sanatan Lok)

Overview

This project now supports Firebase Phone Authentication. The backend verifies Firebase ID tokens issued by the client after successful phone auth. The backend endpoint:

- `POST /auth/verify-firebase-token` - accepts JSON `{ "id_token": "<FIREBASE_ID_TOKEN>" }` and returns your app's JWT + user info or a new-user response.

High-level flow (recommended)

1. Client performs Firebase Phone Auth (using the Firebase JS SDK or native Firebase SDK in mobile).
2. After successful sign-in on client, obtain Firebase ID token via `user.getIdToken()`.
3. POST the `id_token` to `/auth/verify-firebase-token`.
4. Backend verifies the token using the Admin SDK and issues your app's JWT.

Frontend (Expo) example (using Firebase JS SDK + expo-firebase-recaptcha)

Install:

```bash
cd frontend
npm install firebase expo-firebase-recaptcha
```

Minimal example snippets (adapt into your `app/auth/phone.tsx` and `app/auth/otp.tsx`):

Phone screen (send SMS via Firebase):

```tsx
// phone.tsx (excerpt)
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import Constants from 'expo-constants';

const auth = getAuth();
const recaptchaRef = useRef(null);

async function sendFirebaseSMS(phone) {
  // For web build use RecaptchaVerifier or expo-firebase-recaptcha modal
  const verifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
  const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
  // Save confirmationResult to state or pass verificationId to the OTP screen
  return confirmationResult; // has .verificationId
}
```

OTP screen (confirm and send token to backend):

```tsx
// otp.tsx (excerpt)
import { getAuth } from 'firebase/auth';

async function confirmCode(verificationId, code) {
  const auth = getAuth();
  // Build credential and sign in
  const credential = window.firebase.auth.PhoneAuthProvider.credential(verificationId, code);
  const userCredential = await auth.signInWithCredential(credential);
  const idToken = await userCredential.user.getIdToken();

  // Send idToken to backend
  await api.post('/auth/verify-firebase-token', { id_token: idToken });
}
```

Notes & platform guidance

- Expo-managed apps: using Firebase phone auth requires extra setup. Use `expo-firebase-recaptcha` and the web SDK, or eject to the bare workflow to use `@react-native-firebase/auth` for native support.
- For web builds, ensure `FIREBASE_WEB_CONFIG` is set in backend or app config and used to initialize the client Firebase app.
- `reCAPTCHA` is required for Firebase Phone Auth on web. `expo-firebase-recaptcha` provides an embedded flow for Expo.

Backend changes made

- Added endpoint: `POST /auth/verify-firebase-token` (see `backend/routes/auth_routes.py`).
- Added Pydantic model `FirebaseTokenRequest` (in `backend/models/schemas.py`).
- The existing `FirebaseAuthService.verify_firebase_token` is used by the endpoint to verify the token and return application-level JWTs.

Testing

1. Initialize Firebase on the client with your `FIREBASE_WEB_CONFIG` (or native credentials for Android/iOS).
2. Perform Phone Auth on client and obtain `idToken`.
3. POST `id_token` to backend endpoint and confirm you receive the app JWT.

If you want, I can:
- Update the frontend source files in your workspace with a working Expo-friendly implementation (I can add `expo-firebase-recaptcha` usage and modify `phone.tsx` and `otp.tsx`).
- Or provide a step-by-step migration tailored to your target platforms (web, iOS, Android).

Which would you like me to do next?