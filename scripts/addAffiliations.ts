import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

const AFFILIATION_RULES: { keywords: string[]; affiliation: string }[] = [
  { keywords: ['ou medical', 'university of oklahoma', 'ouhsc', 'ou health'], affiliation: 'OU Medical Center' },
  { keywords: ['mercy', 'mercy hospital'], affiliation: 'Mercy Hospital OKC' },
  { keywords: ['integris', 'baptist medical'], affiliation: 'Integris Baptist Medical Center' },
  { keywords: ['st. anthony', 'saint anthony', 'ssm health'], affiliation: 'SSM Health St. Anthony' },
  { keywords: ['oklahoma heart'], affiliation: 'Oklahoma Heart Hospital' },
  { keywords: ['lakeside women'], affiliation: "Lakeside Women's Hospital" },
  { keywords: ['saint francis', 'st. francis', 'st francis'], affiliation: 'Saint Francis Health System' },
  { keywords: ['hillcrest'], affiliation: 'Hillcrest Medical Center' },
  { keywords: ['st. john', 'ascension', 'saint john'], affiliation: 'Ascension St. John' },
  { keywords: ['osu medical', 'oklahoma state university medical'], affiliation: 'OSU Medical Center' },
  { keywords: ['norman regional'], affiliation: 'Norman Regional Health System' },
  { keywords: ['classen medical'], affiliation: 'Classen Medical Complex' },
  { keywords: ['cherokee nation'], affiliation: 'Cherokee Nation Health Services' },
  { keywords: ['choctaw nation'], affiliation: 'Choctaw Nation Health Services' },
  { keywords: ['community health center', 'chci'], affiliation: 'Community Health Centers Inc.' },
  { keywords: ['community health connection'], affiliation: 'Community Health Connection' },
];

function detectAffiliation(name: string, address: string): string | null {
  const combined = `${name} ${address}`.toLowerCase();
  for (const rule of AFFILIATION_RULES) {
    if (rule.keywords.some(k => combined.includes(k))) {
      return rule.affiliation;
    }
  }
  return null;
}

async function run() {
  const snapshot = await getDocs(collection(db, 'providers'));
  let matched = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.hospitalAffiliation) { skipped++; continue; }
    
    const affiliation = detectAffiliation(data.name || '', data.address || '');
    if (affiliation) {
      await updateDoc(doc(db, 'providers', docSnap.id), { hospitalAffiliation: affiliation });
      console.log(`✅ ${data.name} → ${affiliation}`);
      matched++;
    }
  }

  console.log(`\nDone. Matched: ${matched}, Skipped (already set): ${skipped}`);
}

run().catch(console.error);
