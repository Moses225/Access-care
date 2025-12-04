// Import Firebase tools
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAMYBfxhljita9XVqTc_HHahMA7mFVFPn8",
  authDomain: "accesscare-app.firebaseapp.com",
  projectId: "accesscare-app",
  storageBucket: "accesscare-app.firebasestorage.app",
  messagingSenderId: "283308941540",
  appId: "1:283308941540:web:e3c57ebf0e16ca9c8f4cf1"
};

// Initialize Firebase app
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Auth
const auth: Auth = getAuth(app);

// Initialize Firestore
const db: Firestore = getFirestore(app);

export { auth, db };
