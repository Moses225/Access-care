const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.staging.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// To set a provider claim, use the UID from Firebase Auth console
const PROVIDER_UID = '7OC7xUKrJBbCcYxepMG1VZOr2CP2';
const PROVIDER_DOC_ID = 'adam-asch-oklahoma-city-ok';

admin.auth().setCustomUserClaims(PROVIDER_UID, {
  provider: true,
  providerId: PROVIDER_DOC_ID,
})
.then(() => {
  console.log(`✅ Provider claim set for UID: ${PROVIDER_UID}`);
  console.log(`   providerId: ${PROVIDER_DOC_ID}`);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
