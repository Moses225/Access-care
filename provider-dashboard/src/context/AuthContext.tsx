import { createContext, useContext, useEffect, useState} from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface ProviderProfile {
  providerId: string;
  name: string;
  specialty: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'providerUsers', u.uid));
          if (snap.exists()) {
            const d = snap.data();
            const provSnap = await getDoc(doc(db, 'providers', d.providerId));
            const prov = provSnap.exists() ? provSnap.data() : {};
            setProviderProfile({
              providerId: d.providerId,
              name: prov.name || '',
              specialty: prov.specialty || '',
              email: u.email || '',
            });
          } else {
            setProviderProfile(null);
          }
        } catch {
          setProviderProfile(null);
        }
      } else {
        setProviderProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, providerProfile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
