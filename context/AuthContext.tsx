import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  User,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from '../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthContextType = {
  user: User | null;
  initializing: boolean;
  isGuest: boolean;
  isFullAccount: boolean;
  signInAsGuest: () => Promise<void>;
  upgradeGuest: (email: string, password: string) => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  initializing: true,
  isGuest: false,
  isFullAccount: false,
  signInAsGuest: async () => {},
  upgradeGuest: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (__DEV__) console.log('👂 Setting up auth listener...');

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (__DEV__) {
        console.log('🔐 Auth state changed:', currentUser ? '✅ Logged in' : '🔓 Logged out');
        if (currentUser) {
          console.log('   Email:', currentUser.email);
          console.log('   Anonymous:', currentUser.isAnonymous);
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
      if (__DEV__) console.log('👤 Signed in as guest');
    } catch (error) {
      if (__DEV__) console.error('Guest sign in failed:', error);
      throw error;
    }
  };

  // Upgrade anonymous account to full account — preserves UID and all data
  const upgradeGuest = async (email: string, password: string) => {
    if (!user || !user.isAnonymous) {
      throw new Error('No anonymous user to upgrade');
    }
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
      if (__DEV__) console.log('⬆️ Guest upgraded to full account:', email);
    } catch (error) {
      if (__DEV__) console.error('Guest upgrade failed:', error);
      throw error;
    }
  };

  const isGuest = user?.isAnonymous === true;
  const isFullAccount = !!user && !user.isAnonymous;

  return (
    <AuthContext.Provider value={{
      user,
      initializing,
      isGuest,
      isFullAccount,
      signInAsGuest,
      upgradeGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
