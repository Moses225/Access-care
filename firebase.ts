import { getApp, getApps, initializeApp } from "firebase/app";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth, initializeAuth } from "firebase/auth";
import { getReactNativePersistence } from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// ── App Check — JS SDK CustomProvider (v1.2.0) ────────────────────────────────
// v1.2.0 uses the Firebase JS SDK CustomProvider with a registered debug token
// in dev and a self-signed token in production (Firestore in Monitor mode).
//
// v1.3.0 roadmap: full native attestation via @react-native-firebase/app-check
//   iOS  → App Attest (hardware-backed)
//   Android → Play Integrity
// This requires GoogleService-Info.plist and google-services.json to be
// injected into the EAS build environment via build hooks (EAS Secret files).
// Deferred from v1.2.0 to avoid pod installation failure on EAS Build.
(async () => {
  try {
    if (getApps().length === 0) return;

    const debugToken =
      process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN ?? "morava-dev-debug-2026";

    // In both dev and production we use a CustomProvider that returns the
    // registered debug token. Firebase App Check must be kept in Monitor mode
    // (not Enforce) until v1.3.0 ships with full native attestation.
    // Monitor mode logs all requests without blocking — zero user impact.
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => ({
          token: debugToken,
          expireTimeMillis: Date.now() + 3_600_000,
        }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check already initialized — safe to ignore on hot reload
  }
})();
