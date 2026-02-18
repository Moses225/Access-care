// Firebase Import Script for AccessCare Providers
// Save as: scripts/importProviders.js
// Run on Day 10 to import all 200 providers

const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Initialize Firebase Admin
// You'll need to download serviceAccountKey.json from Firebase Console
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Function to import providers
async function importProviders() {
  const providers = [];
  
  // Read CSV file (use your geocoded CSV)
  fs.createReadStream('../AccessCare_Providers_GEOCODED.csv')
    .pipe(csv())
    .on('data', (row) => {
      // Map CSV columns to Firestore fields
      const provider = {
        // Basic Info
        name: row['Full Name'] || '',
        specialty: row['Specialty'] || '',
        category: row['Category'] || 'Core',
        license: row['License Number'] || '',
        
        // Contact
        address: row['Address'] || '',
        city: row['City'] || '',
        state: row['State'] || 'Oklahoma',
        zip: parseInt(row['ZIP']) || 0,
        phone: row['Phone'] || '',
        email: row['Email'] || '',
        website: row['Website'] || '',
        
        // Location (CRITICAL for maps)
        latitude: parseFloat(row['Latitude']) || 0,
        longitude: parseFloat(row['Longitude']) || 0,
        
        // Provider Details
        npiNumber: row['NPI Number'] || '',
        gender: row['Gender'] || '',
        languages: row['Languages'] ? row['Languages'].split(',').map(l => l.trim()) : ['English'],
        
        // Availability
        acceptingNewPatients: row['Accepting New Patients'] === 'Yes' || row['Accepting New Patients'] === 'checked',
        telehealthAvailable: row['Telehealth Available'] === 'Yes',
        
        // Insurance
        insuranceAccepted: row['Insurance Accepted'] 
          ? row['Insurance Accepted'].split(',').map(i => i.trim()) 
          : ['SoonerCare'],
        
        // Reviews
        rating: parseFloat(row['Rating']) || 4.5,
        reviewCount: parseInt(row['Review Count']) || 0,
        
        // Status
        verified: false,
        active: true,
        
        // Timestamps
        dateAdded: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      providers.push(provider);
    })
    .on('end', async () => {
      console.log(`\n📊 Found ${providers.length} providers to import\n`);
      
      // Show breakdown
      const core = providers.filter(p => p.category === 'Core').length;
      const extended = providers.filter(p => p.category === 'Extended').length;
      const rare = providers.filter(p => p.category === 'Rare').length;
      
      console.log('Category Breakdown:');
      console.log(`  Core Services: ${core}`);
      console.log(`  Extended Services: ${extended}`);
      console.log(`  Rare & Specialized: ${rare}`);
      console.log('');
      
      // Import in batches of 500 (Firestore limit)
      const batchSize = 500;
      let imported = 0;
      
      for (let i = 0; i < providers.length; i += batchSize) {
        const batch = db.batch();
        const batchProviders = providers.slice(i, i + batchSize);
        
        batchProviders.forEach((provider, index) => {
          // Use provider name + city as document ID (safe, unique)
          const docId = `${provider.name.replace(/\s+/g, '_')}_${provider.city}`.toLowerCase();
          const docRef = db.collection('providers').doc(docId);
          batch.set(docRef, provider);
        });
        
        await batch.commit();
        imported += batchProviders.length;
        console.log(`✅ Imported ${imported}/${providers.length} providers`);
      }
      
      console.log('\n🎉 SUCCESS! All providers imported to Firebase!\n');
      console.log('Next steps:');
      console.log('  1. Go to Firebase Console');
      console.log('  2. Check Firestore Database → providers collection');
      console.log('  3. Verify all 200 providers are there');
      console.log('  4. Test your app!');
      console.log('');
      
      process.exit(0);
    })
    .on('error', (error) => {
      console.error('❌ Error reading CSV:', error);
      process.exit(1);
    });
}

// Run import
importProviders().catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});


/**
 * HOW TO USE THIS SCRIPT
 * 
 * 1. PREREQUISITES:
 *    - Node.js installed
 *    - Geocoded CSV file (AccessCare_Providers_GEOCODED.csv)
 *    - Firebase serviceAccountKey.json
 * 
 * 2. SETUP:
 *    cd your-project-folder
 *    mkdir scripts
 *    cd scripts
 *    npm init -y
 *    npm install firebase-admin csv-parser
 * 
 * 3. GET FIREBASE KEY:
 *    - Go to Firebase Console
 *    - Click ⚙️ → Project Settings
 *    - Service Accounts tab
 *    - Generate new private key
 *    - Save as scripts/serviceAccountKey.json
 *    - Add to .gitignore!
 * 
 * 4. RUN SCRIPT:
 *    node importProviders.js
 * 
 * 5. WAIT ~30 seconds while it imports all 200
 * 
 * 6. VERIFY:
 *    - Go to Firebase Console
 *    - Firestore Database
 *    - Should see 200 documents in 'providers' collection
 * 
 * 7. TEST APP:
 *    - Reload your app
 *    - Should now show 200 real providers!
 */