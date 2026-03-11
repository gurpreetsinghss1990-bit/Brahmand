import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration for Sanatan Lok
const firebaseConfig = {
  apiKey: "AIzaSyDfF0fWQcdfKfXxh0QRFVFp6HYrN9-HYXU",
  authDomain: "sanatan-lok.firebaseapp.com",
  projectId: "sanatan-lok",
  storageBucket: "sanatan-lok.firebasestorage.app",
  messagingSenderId: "614661191520",
  appId: "1:614661191520:web:73d000eb76a3568e2a87f7",
  measurementId: "G-ZHY5H3YRDG"
};

let app: FirebaseApp;
let db: Firestore;

export function initializeFirebase(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getFirestoreDB(): Firestore {
  if (!db) {
    const app = initializeFirebase();
    db = getFirestore(app);
  }
  return db;
}

export { app, db };
