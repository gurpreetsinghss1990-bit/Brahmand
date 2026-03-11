import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithCredential,
  Auth,
  ConfirmationResult
} from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfF0fWQcdfKfXxh0QRFVFp6HYrN9-HYXU",
  authDomain: "sanatan-lok.firebaseapp.com",
  projectId: "sanatan-lok",
  storageBucket: "sanatan-lok.firebasestorage.app",
  messagingSenderId: "614661191520",
  appId: "1:614661191520:web:73d000eb76a3568e2a87f7",
  measurementId: "G-ZHY5H3YRDG"
};

// Initialize Firebase
let app: any;
let auth: Auth;

export function initializeFirebaseAuth(): Auth {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  return auth;
}

// Store confirmation result globally
let confirmationResult: ConfirmationResult | null = null;

/**
 * Setup reCAPTCHA verifier for web
 */
export function setupRecaptcha(containerId: string): RecaptchaVerifier | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  
  const auth = initializeFirebaseAuth();
  
  // Clear existing verifier
  if ((window as any).recaptchaVerifier) {
    (window as any).recaptchaVerifier.clear();
  }
  
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      console.log('[Firebase] reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.log('[Firebase] reCAPTCHA expired');
    }
  });
  
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Send OTP via Firebase Phone Auth
 */
export async function sendFirebaseOTP(phoneNumber: string): Promise<boolean> {
  try {
    const auth = initializeFirebaseAuth();
    
    // Format phone number with country code
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    
    if (Platform.OS === 'web') {
      // Web: Use reCAPTCHA
      let verifier = (window as any).recaptchaVerifier;
      
      if (!verifier) {
        // Create invisible reCAPTCHA
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        (window as any).recaptchaVerifier = verifier;
      }
      
      confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      console.log('[Firebase] OTP sent successfully');
      return true;
    } else {
      // Native: Firebase handles reCAPTCHA automatically
      // Note: For native apps, you might need to use @react-native-firebase/auth
      console.log('[Firebase] OTP request for native - implement with @react-native-firebase/auth');
      return true;
    }
  } catch (error: any) {
    console.error('[Firebase] Error sending OTP:', error);
    throw new Error(error.message || 'Failed to send OTP');
  }
}

/**
 * Verify OTP and get Firebase ID token
 */
export async function verifyFirebaseOTP(otp: string): Promise<string> {
  try {
    if (!confirmationResult) {
      throw new Error('No OTP request found. Please request OTP first.');
    }
    
    const userCredential = await confirmationResult.confirm(otp);
    const idToken = await userCredential.user.getIdToken();
    
    console.log('[Firebase] OTP verified successfully');
    return idToken;
  } catch (error: any) {
    console.error('[Firebase] Error verifying OTP:', error);
    
    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid OTP. Please try again.');
    }
    if (error.code === 'auth/code-expired') {
      throw new Error('OTP expired. Please request a new one.');
    }
    
    throw new Error(error.message || 'Failed to verify OTP');
  }
}

/**
 * Get current user's ID token
 */
export async function getCurrentUserToken(): Promise<string | null> {
  const auth = initializeFirebaseAuth();
  const user = auth.currentUser;
  
  if (user) {
    return await user.getIdToken();
  }
  
  return null;
}

/**
 * Sign out from Firebase
 */
export async function signOutFirebase(): Promise<void> {
  const auth = initializeFirebaseAuth();
  await auth.signOut();
  confirmationResult = null;
}

export { auth, confirmationResult };
