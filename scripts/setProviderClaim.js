const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Replace with the provider's email and their Firestore provider doc ID
const PROVIDER_EMAIL = 'provider@test.com';
const PROVIDER_DOC_ID = 'adam-asch-oklahoma-city-ok'; // any real provider ID from your DB

admin.auth().getUserByEmail(PROVIDER_EMAIL)
  .then(user => admin.auth().setCustomUserClaims(user.uid, {
    provider: true,
    providerId: PROVIDER_DOC_ID,
  }))
  .then(() => {
    console.log(`✅ Provider claim set for ${PROVIDER_EMAIL}`);
    console.log(`   providerId: ${PROVIDER_DOC_ID}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
