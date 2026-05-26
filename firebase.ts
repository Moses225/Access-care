import { getApp, getApps, initializeApp } from "firebase/app";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth, initializeAuth } from "firebase/auth";
import { getReactNativePersistence } from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebase from "@react-native-firebase/app";
import appCheck from "@react-native-firebase/app-check";

// ── Firebase config from env vars (never hardcoded) ──────────────────────────
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// ── Encrypted persistence via expo-secure-store ───────────────────────────────
// AsyncStorage is plaintext on disk. SecureStore uses iOS Keychain /
// Android Keystore — hardware-backed encryption on supported devices.
// Firebase Auth tokens (refresh + ID) are stored here instead.
class SecureStorePersistence {
  type = "LOCAL" as const;

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch {
      // SecureStore unavailable (simulator without keychain) — silent fail
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
}

// ── Firebase JS SDK init ──────────────────────────────────────────────────────
const appAlreadyExists = getApps().length > 0;
const app = appAlreadyExists ? getApp() : initializeApp(firebaseConfig);

export const auth = appAlreadyExists
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(new SecureStorePersistence()),
    });

export const db      = getFirestore(app);
export const storage = getStorage(app);

// ── App Check — native attestation via @react-native-firebase ────────────────
// iOS:     App Attest (hardware-backed device attestation)
// Android: Play Integrity (Google's app integrity verification)
// Dev:     Firebase debug token (bypass for local testing)
//
// This requires GoogleService-Info.plist (iOS) and google-services.json (Android)
// in the project root, both added to .gitignore.
//
// The RNFirebase App Check SDK gets a real native attestation token, which we
// feed into the Firebase JS SDK's CustomProvider. Both SDKs talk to the same
// Firebase project via the service files — no duplicate initialization needed.
(async () => {
  try {
    if (getApps().length === 0) return; // safety guard

    let getToken: () => Promise<{ token: string; expireTimeMillis: number }>;

    if (__DEV__) {
      // Dev: use Firebase App Check debug token
      // Register this token in Firebase Console → App Check → Apps → debug tokens
      const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN || "morava-dev-debug-2026";
      firebase.app().appCheck().useCriticalRequestsDebugMode?.();
      getToken = async () => ({
        token: debugToken,
        expireTimeMillis: Date.now() + 3600_000,
      });
    } else {
      // Production: get a real native attestation token from RNFirebase
      getToken = async () => {
        const result = await appCheck().getToken(/* forceRefresh */ false);
        return {
          token: result.token,
          expireTimeMillis: result.expireTimeMillis,
        };
      };
    }

    initializeAppCheck(app, {
      provider: new CustomProvider({ getToken }),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // App Check already initialized or service files not yet added — non-fatal
    if (__DEV__) console.warn("App Check init:", err);
  }
})();
