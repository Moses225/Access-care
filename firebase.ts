// Import Firebase tools
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "myAPI key",
  authDomain: "API DOMAIN",
  projectId: "myAPI key",
  storageBucket: "myAPI key"
  messagingSenderId: "myAPI key",
  appId: "myAPI key"
};

// Initialize Firebase app
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Auth
const auth: Auth = getAuth(app);

// Initialize Firestore
const db: Firestore = getFirestore(app);

export { auth, db };

