import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from "firebase/auth";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth } from "../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthContextType = {
  user: User | null;
  initializing: boolean;
  isGuest: boolean;
  isFullAccount: boolean;
  isVerifying: boolean;
  setIsVerifying: (v: boolean) => void;
  signInAsGuest: () => Promise<void>;
  upgradeGuest: (email: string, password: string) => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  initializing: true,
  isGuest: false,
  isFullAccount: false,
  isVerifying: false,
  setIsVerifying: () => {},
  signInAsGuest: async () => {},
  upgradeGuest: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (__DEV__) console.log("👂 Setting up auth listener...");

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (__DEV__) {
        console.log(
          "🔐 Auth state changed:",
          currentUser ? "✅ Logged in" : "🔓 Logged out",
        );
        if (currentUser) {
          console.log("   Email:", currentUser.email);
          console.log("   Anonymous:", currentUser.isAnonymous);
        }
      }
      setUser(currentUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Sign in anonymously — gives user a real UID without requiring email
  const signInAsGuest = async () => {
    try {
      await signInAnonymously(auth);
      if (__DEV__) console.log("👤 Signed in as guest");
    } catch (error) {
      if (__DEV__) console.error("Guest sign in failed:", error);
      throw error;
    }
  };

  // Upgrade anonymous account to full account — preserves UID and all data
  const upgradeGuest = async (email: string, password: string) => {
    if (!user || !user.isAnonymous) {
      throw new Error("No anonymous user to upgrade");
    }
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
      if (__DEV__) console.log("⬆️ Guest upgraded to full account:", email);
    } catch (error) {
      if (__DEV__) console.error("Guest upgrade failed:", error);
      throw error;
    }
  };

  const isGuest = user?.isAnonymous === true;
  const isFullAccount = !!user && !user.isAnonymous;
  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        isGuest,
        isFullAccount,
        isVerifying,
        setIsVerifying,
        signInAsGuest,
        upgradeGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
