import { onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Provider } from '../data/providers';
import { providersCollection } from '../firebase';

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(providersCollection);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const providersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Provider[];
        
        setProviders(providersList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching providers:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { providers, loading, error };
}