import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAMYBfxhljita9XVqTc_HHahMA7mFVFPn8",
  authDomain: "accesscare-app.firebaseapp.com",
  projectId: "accesscare-app",
  storageBucket: "accesscare-app.firebasestorage.app",
  messagingSenderId: "283308941540",
  appId: "1:283308941540:web:e3c57ebf0e16ca9c8f4cf1"
};

// Only initialize if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services with proper types
export const auth: Auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);