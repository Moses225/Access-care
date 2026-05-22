import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ── App Check — intentionally disabled on web dashboard ──────────────────
// reCAPTCHA v3 App Check requires exact site key + secret key alignment in
// Firebase Console. The key setup caused 400/403 errors and a 24h throttle.
//
// App Check enforcement is most valuable on mobile (DeviceCheck / Play
// Integrity), which requires a native module and a new APK build.
// Web reCAPTCHA v3 provides weaker guarantees and can be bypassed.
//
// TODO: re-enable once native App Check is wired into the mobile build.
// Steps when ready:
//   1. Verify matching site key + secret key pair in reCAPTCHA admin console
//   2. Register secret key in Firebase Console → App Check → Apps → Web App
//   3. Use ReCaptchaV3Provider(VITE_RECAPTCHA_SITE_KEY) here
//   4. Monitor in Firebase App Check metrics before enabling enforcement

export const auth = getAuth(app);
export const db = getFirestore(app);
