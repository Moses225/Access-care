const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

console.log('🔑 Initializing Firebase Admin...');
console.log('Project ID:', serviceAccount.project_id);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importProviders() {
  const providers = [];
  
  console.log('\n📂 Reading CSV file...\n');
  
  // Read CSV
  return new Promise((resolve, reject) => {
    fs.createReadStream('../data/AccessCare_Providers_FINAL.csv')
      .pipe(csv())
      .on('data', (row) => {
        try {
          const provider = {
            name: row.full_name || '',
            specialty: row.specialty || '',
            category: row.category || 'Extended',
            licenseNumber: row.license_number || '',
            address: row.address || '',
            city: row.city || '',
            state: row.state || 'OK',
            zip: row.zip || '',
            phone: row.phone || '',
            website: row.website || '',
            npi: row.npi || '',
            gender: row.gender || '',
            languages: row.languages ? row.languages.split(',').map(l => l.trim()) : ['English'],
            acceptingNewPatients: row.accepting_new_patients === 'TRUE',
            telehealthAvailable: row.telehealth_available === 'TRUE',
            insuranceAccepted: row.insurance_accepted ? row.insurance_accepted.split(',').map(i => i.trim()) : ['SoonerCare'],
            rating: parseFloat(row.rating) || 4.5,
            reviewCount: parseInt(row.review_count) || 0,
            latitude: parseFloat(row.lat) || 0,
            longitude: parseFloat(row.lng) || 0,
            geocodeStatus: row.geocode_status || 'unknown',
            verified: false,
            active: true,
            dateAdded: row.date_added || new Date().toISOString(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };
          
          providers.push({
            id: row.id,
            data: provider
          });
        } catch (error) {
          console.error('❌ Error parsing row:', error.message);
        }
      })
      .on('end', async () => {
        console.log(`📊 Total providers parsed: ${providers.length}\n`);
        
        // Count categories
        const categories = providers.reduce((acc, p) => {
          const cat = p.data.category;
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});
        
        console.log('📋 CATEGORY BREAKDOWN:');
        Object.entries(categories).forEach(([cat, count]) => {
          console.log(`  ${cat}: ${count}`);
        });
        
        // Import to Firebase
        console.log('\n🔄 Starting Firebase import...\n');
        
        let imported = 0;
        let failed = 0;
        const batchSize = 500;
        
        for (let i = 0; i < providers.length; i += batchSize) {
          const batch = db.batch();
          const batchProviders = providers.slice(i, i + batchSize);
          
          batchProviders.forEach((provider) => {
            const docRef = db.collection('providers').doc(provider.id);
            batch.set(docRef, provider.data, { merge: true });
          });
          
          try {
            await batch.commit();
            imported += batchProviders.length;
            console.log(`✅ Imported ${imported}/${providers.length} providers`);
          } catch (error) {
            failed += batchProviders.length;
            console.error(`❌ Batch failed:`, error.message);
            console.error('Full error:', error);
          }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 IMPORT COMPLETE!\n');
        console.log('📊 RESULTS:');
        console.log(`  ✅ Successfully imported: ${imported}`);
        if (failed > 0) {
          console.log(`  ❌ Failed: ${failed}`);
        }
        console.log('\n✅ NEXT STEPS:');
        console.log('  1. Go to Firebase Console');
        console.log('  2. Refresh the page');
        console.log('  3. Check the "providers" collection');
        console.log('  4. Should see', providers.length, 'providers');
        console.log('  5. Reload your app!\n');
        
        process.exit(0);
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV:', error);
        reject(error);
      });
  });
}

// Run import
console.log('\n🚀 AccessCare Provider Import (Fixed Version)\n');
importProviders().catch(error => {
  console.error('\n❌ IMPORT FAILED:', error);
  console.error('\nFull error details:', error);
  process.exit(1);
});