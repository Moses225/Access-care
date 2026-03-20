const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const RULES = [
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

function detect(name, address) {
  const s = `${name} ${address}`.toLowerCase();
  for (const r of RULES) if (r.keywords.some(k => s.includes(k))) return r.affiliation;
  return null;
}

async function run() {
  const snap = await db.collection('providers').get();
  let matched = 0, skipped = 0, unmatched = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.hospitalAffiliation) { skipped++; continue; }
    const a = detect(data.name || '', data.address || '');
    if (a) {
      await db.collection('providers').doc(d.id).update({ hospitalAffiliation: a });
      console.log(`✅ ${data.name} → ${a}`);
      matched++;
    } else { unmatched++; }
  }
  console.log(`\nMatched: ${matched} | Already set: ${skipped} | No match: ${unmatched}`);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
