const admin = require('firebase-admin');
const DRY_RUN = false;
const DEFAULT_LATITUDE = 35.4676;
const DEFAULT_LONGITUDE = -97.5164;

try {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const stats = { total: 0, valid: 0, fixed: 0, removed: 0, errors: [] };

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60) + '\n');
}

async function cleanProviders() {
  logSection(`🚀 CLEANING - ${DRY_RUN ? 'DRY RUN' : 'LIVE'} MODE`);
  
  if (DRY_RUN) {
    console.log('🔬 DRY RUN: No changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE: Changes WILL be applied!\n');
  }

  try {
    console.log('📥 Fetching providers...');
    const snapshot = await db.collection('providers').get();
    stats.total = snapshot.size;
    console.log(`✅ Found ${stats.total} providers\n`);

    logSection('🔍 ANALYZING');

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;

      try {
        if (!data.name || !data.specialty) {
          console.log(`❌ REMOVE: ${id} - Missing: ${!data.name ? 'name' : 'specialty'}\n`);
          if (!DRY_RUN) await doc.ref.delete();
          stats.removed++;
          continue;
        }

        const updates = {};
        let needsUpdate = false;

        if (typeof data.rating !== 'number') {
          updates.rating = typeof data.rating === 'string' ? parseFloat(data.rating) || 0 : 0;
          needsUpdate = true;
          console.log(`🔧 FIX RATING: ${data.name}\n`);
        }

        if (typeof data.latitude !== 'number' || data.latitude === 0) {
          updates.latitude = DEFAULT_LATITUDE;
          needsUpdate = true;
        }

        if (typeof data.longitude !== 'number' || data.longitude === 0) {
          updates.longitude = DEFAULT_LONGITUDE;
          needsUpdate = true;
        }

        if (!Array.isArray(data.insuranceAccepted)) {
          updates.insuranceAccepted = typeof data.insuranceAccepted === 'string' ? [data.insuranceAccepted] : [];
          needsUpdate = true;
          console.log(`🔧 FIX INSURANCE: ${data.name}\n`);
        }

        if (!Array.isArray(data.categories) && data.category) {
          updates.categories = [data.category];
          needsUpdate = true;
        }

        if (data.address === undefined) updates.address = '';
        if (data.phone === undefined) updates.phone = '';
        if (data.verified === undefined) updates.verified = false;
        if (data.state === undefined) updates.state = 'Oklahoma';

        if (Object.keys(updates).length > 0) needsUpdate = true;

        if (needsUpdate) {
          if (!DRY_RUN) await doc.ref.update(updates);
          stats.fixed++;
        } else {
          stats.valid++;
        }

      } catch (error) {
        console.error(`❌ ERROR: ${id} - ${error.message}`);
        stats.errors.push({ id, error: error.message });
      }
    }

    logSection('📊 SUMMARY');
    console.log(`Total:    ${stats.total}`);
    console.log(`✅ Valid:  ${stats.valid}`);
    console.log(`🔧 Fixed:  ${stats.fixed}`);
    console.log(`❌ Removed: ${stats.removed}`);
    console.log(`⚠️  Errors: ${stats.errors.length}`);
    
    console.log('\n' + '='.repeat(60));
    
    if (DRY_RUN) {
      console.log('🔬 DRY RUN COMPLETE - No changes made');
      console.log('\nTo apply: Edit script, change DRY_RUN to false');
    } else {
      console.log('✅ COMPLETE - Changes applied');
      console.log('\nNext: npx expo start --clear');
    }
    console.log('='.repeat(60) + '\n');

  } finally {
    await admin.app().delete();
  }
}

cleanProviders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
