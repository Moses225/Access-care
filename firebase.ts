import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, collection, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAMYBfxhljita9XVqTc_HHahMA7mFVFPn8",
  authDomain: "accesscare-app.firebaseapp.com",
  projectId: "accesscare-app",
  storageBucket: "accesscare-app.firebasestorage.app",
  messagingSenderId: "283308941540",
  appId: "1:283308941540:web:e3c57ebf0e16ca9c8f4cf1"
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export const providersCollection = collection(db, 'providers');
export const appointmentsCollection = collection(db, 'appointments');

export { auth, db };
