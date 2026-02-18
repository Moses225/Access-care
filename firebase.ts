import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, collection, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "************************************",
  authDomain: "accesscare-app.firebaseapp.com",
  projectId: "accesscare-app",
  storageBucket: "accesscare-app.firebasestorage.app",
  messagingSenderId: "****************************",
  appId: "*************************************"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize services
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const auth: Auth = getAuth(app);

// Collection references
export const providersCollection = collection(db, 'providers');
export const appointmentsCollection = collection(db, 'appointments');

// Export services
export { app, auth, db, storage };
