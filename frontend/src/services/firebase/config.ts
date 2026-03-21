import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseCompat from 'firebase/compat/app';

// Firebase configuration for Sanatan Lok - must match Firebase project settings
export const firebaseConfig = {
  apiKey: "AIzaSyAfMGn2Njs6Wdp8ZTpBS0jDS4KD7B7cTp4",
  authDomain: "sanatan-lok.firebaseapp.com",
  projectId: "sanatan-lok",
  storageBucket: "sanatan-lok.firebasestorage.app",
  messagingSenderId: "103222994071",
  appId: "1:103222994071:web:bf5b9aa1775e0c84e8f5d2",
  measurementId: "G-X7VBBCHKXG"
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

export function initializeFirebase(): FirebaseApp {
  if (getApps().length === 0) {
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
