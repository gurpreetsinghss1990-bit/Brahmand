import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseCompat from 'firebase/compat/app';

// Firebase configuration for Sanatan Lok - loaded from environment variables
// For web/local development, ensure .env file is present and variables are loaded

// Helper to get env var with fallback - try multiple sources for web compatibility
const getEnvVar = (key: string, fallback: string = ''): string => {
  // Try process.env first (works with Expo built-in)
  let value = process.env[key];
  
  // For web, also check window.__ENV__ (set by Expo webpack)
  if (!value && typeof window !== 'undefined' && (window as any).__ENV__) {
    value = (window as any).__ENV__[key];
  }
  
  // Fallback to the key without EXPO_PUBLIC prefix if not found
  if (!value) {
    const altKey = key.replace('EXPO_PUBLIC_', '');
    value = process.env[altKey];
  }
  
  if (!value && !fallback) {
    console.warn(`[Firebase Config] Missing env var: ${key}`);
  }
  
  return value || fallback;
};

export const firebaseConfig = {
  apiKey: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY', 'AIzaSyAfMGn2Njs6Wdp8ZTpBS0jDS4KD7B7cTp4'),
  authDomain: getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'sanatan-lok.firebaseapp.com'),
  projectId: getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'sanatan-lok'),
  storageBucket: getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'sanatan-lok.firebasestorage.app'),
  messagingSenderId: getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '103222994071'),
  appId: getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID', '1:103222994071:web:bf5b9aa1775e0c84e8f5d2'),
  measurementId: getEnvVar('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID', 'G-X7VBBCHKXG')
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

export function initializeFirebase(): FirebaseApp {
  if (getApps().length === 0) {
    // Log minimal config to verify environment variables are loaded in the web bundle
    try {
      // eslint-disable-next-line no-console
      console.log('[Firebase] initializing with apiKey=', firebaseConfig.apiKey ? 'SET' : 'MISSING', ' authDomain=', firebaseConfig.authDomain || '');
    } catch (e) {}
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

// Initialize the Firebase app immediately so any downstream
// component (e.g. expo-firebase-recaptcha) can safely use it.
export const firebaseApp = initializeFirebase();

// Compat SDK apps (used by some packages like expo-firebase-recaptcha)
if (!firebaseCompat.apps.length) {
  firebaseCompat.initializeApp(firebaseConfig);
}

export function getFirestoreDB(): Firestore {
  if (!db) {
    const app = initializeFirebase();
    db = getFirestore(app);
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    const app = initializeFirebase();
    storage = getStorage(app);
  }
  return storage;
}

export { app, db, storage };
