import { getApp, getApps, initializeApp } from "firebase/app";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth, initializeAuth } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from "@firebase/auth/dist/rn/index.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (__DEV__) {
  console.log(
    "🔧 Firebase connecting to project:",
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

const appAlreadyExists = getApps().length > 0;
const app = appAlreadyExists ? getApp() : initializeApp(firebaseConfig);

export const auth = appAlreadyExists
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

// App Check — uses debug token in dev, custom attestation in production
// Full Play Integrity / DeviceCheck requires native module (Month 2)
if (typeof __DEV__ !== "undefined") {
  // In dev: use debug token so local testing works
  // In production: sends empty token — keep Firestore in Monitor mode
  // until native App Check module is implemented
  try {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => ({
          token: __DEV__ ? "debug-token-morava-2026" : "",
          expireTimeMillis: Date.now() + 3600000,
        }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check already initialized — safe to ignore
  }
}

export const db = getFirestore(app);
export const storage = getStorage(app);
