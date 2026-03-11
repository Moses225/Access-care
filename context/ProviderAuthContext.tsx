import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type ProviderProfile = {
  providerId: string;
  name: string;
  specialty: string;
  acceptingPatients: boolean;
};

type ProviderAuthContextType = {
  user: User | null;
  providerProfile: ProviderProfile | null;
  isProvider: boolean;
  initializing: boolean;
  refreshProfile: () => Promise<void>;
};

const ProviderAuthContext = createContext<ProviderAuthContextType>({
  user: null,
  providerProfile: null,
  isProvider: false,
  initializing: true,
  refreshProfile: async () => {},
});

export function ProviderAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const loadProviderProfile = async (uid: string) => {
    try {
      // Check custom claim
      const tokenResult = await auth.currentUser?.getIdTokenResult(true);
      const providerClaim = tokenResult?.claims?.provider === true;
      const providerId = tokenResult?.claims?.providerId as string;

      if (!providerClaim || !providerId) {
        setIsProvider(false);
        setProviderProfile(null);
        return;
      }

      setIsProvider(true);

      const providerDoc = await getDoc(doc(db, 'providers', providerId));
      if (providerDoc.exists()) {
        const data = providerDoc.data();
        setProviderProfile({
          providerId,
          name: data.name || '',
          specialty: data.specialty || '',
          acceptingPatients: data.acceptingPatients ?? true,
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading provider profile:', error);
      setIsProvider(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProviderProfile(user.uid);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProviderProfile(firebaseUser.uid);
      } else {
        setIsProvider(false);
        setProviderProfile(null);
      }
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  return (
    <ProviderAuthContext.Provider value={{ user, providerProfile, isProvider, initializing, refreshProfile }}>
      {children}
    </ProviderAuthContext.Provider>
  );
}

export const useProviderAuth = () => useContext(ProviderAuthContext);
