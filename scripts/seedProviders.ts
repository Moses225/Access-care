import { addDoc } from 'firebase/firestore';
import { mockProviders } from '../data/providers';
import { providersCollection } from '../firebase';

export async function seedProviders() {
  try {
    for (const provider of mockProviders) {
      await addDoc(providersCollection, provider);
      console.log(`Added: ${provider.name}`);
    }
    console.log('All providers seeded successfully!');
  } catch (error) {
    console.error('Error seeding providers:', error);
  }
}