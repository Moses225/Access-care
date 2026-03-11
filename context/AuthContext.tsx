import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthContextType = {
  user: User | null;
  initializing: boolean;
  isGuest: boolean;
  isFullAccount: boolean;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  initializing: true,
  isGuest: false,
  isFullAccount: false,
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
        if (currentUser) console.log('   User email:', currentUser.email);
      }
      setUser(currentUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Guest = anonymous Firebase auth (Week 3 feature — ready for it now)
  const isGuest = user?.isAnonymous === true;

  // Full account = logged in AND not anonymous
  const isFullAccount = !!user && !user.isAnonymous;

  return (
    <AuthContext.Provider value={{ user, initializing, isGuest, isFullAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
