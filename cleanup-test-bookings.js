#!/usr/bin/env node
const admin = require('firebase-admin');
const path  = require('path');
const readline = require('readline');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'scripts', 'serviceAccountKey.json');
const TEST_USER_IDS = ['Wgqla52ye8MG7QDE4Ag9pMeznj12'];
const TEST_NAME_FRAGMENTS  = ['test'];
const TEST_PHONE_FRAGMENTS = ['0000000', '1234567', '9999999'];
const FORCE_DELETE_IDS = [];
const DRY_RUN = !process.argv.includes('--delete');

let serviceAccount;
try {
  serviceAccount = require(SERVICE_ACCOUNT_PATH);
} catch {
  console.error('\n❌  Could not load service account key.');
  console.error(`    Expected: ${SERVICE_ACCOUNT_PATH}\n`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function isTestBooking(id, data) {
  if (FORCE_DELETE_IDS.includes(id)) return { match: true, reason: 'force-delete list' };
  if (TEST_USER_IDS.includes(data.userId)) return { match: true, reason: `userId matches test account` };
  const name  = (data.patientName  || '').toLowerCase();
  const phone = (data.patientPhone || '').toLowerCase();
  for (const frag of TEST_NAME_FRAGMENTS)  if (name.includes(frag))  return { match: true, reason: `patientName contains "${frag}"` };
  for (const frag of TEST_PHONE_FRAGMENTS) if (phone.includes(frag)) return { match: true, reason: `patientPhone contains "${frag}"` };
  return { match: false };
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AccessCare — Production Booking Cleanup');
  console.log(`  Project: ${serviceAccount.project_id}`);
  console.log(`  Mode:    ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🗑️  DELETE MODE'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📦 Fetching all bookings...');
  const snapshot = await db.collection('bookings').get();
  console.log(`   Found ${snapshot.size} total bookings.\n`);

  const toDelete = [], toKeep = [];
  snapshot.forEach((docSnap) => {
    const { match, reason } = isTestBooking(docSnap.id, docSnap.data());
    if (match) toDelete.push({ id: docSnap.id, data: docSnap.data(), reason });
    else        toKeep.push({ id: docSnap.id, data: docSnap.data() });
  });

  console.log(`✅  KEEP (${toKeep.length}):`);
  toKeep.forEach(({ id, data }) =>
    console.log(`    ${id}\n      ${data.patientName || '—'} | ${data.providerName || '—'} | ${data.status || '—'} | ${data.date || '—'}`));

  console.log(`\n🗑️  DELETE (${toDelete.length}):`);
  if (toDelete.length === 0) { console.log('    None — already clean!'); }
  else toDelete.forEach(({ id, data, reason }) =>
    console.log(`    ${id}\n      ${data.patientName || '—'} | ${data.providerName || '—'} | ${data.status || '—'} | ${data.date || '—'}\n      Reason: ${reason}`));

  if (DRY_RUN) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  DRY RUN complete — no changes made.');
    if (toDelete.length > 0) console.log('  Run with --delete to remove them.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  }

  if (toDelete.length === 0) { console.log('\nNothing to delete. All clean!\n'); process.exit(0); }

  const answer = await confirm(`\n⚠️  Permanently delete ${toDelete.length} booking(s) from PRODUCTION?\n   Type "yes" to confirm: `);
  if (answer !== 'yes') { console.log('\nAborted.\n'); process.exit(0); }

  console.log('\n🗑️  Deleting...');
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach(({ id }) => batch.delete(db.collection('bookings').doc(id)));
    await batch.commit();
    deleted += Math.min(400, toDelete.length - i);
  }
  console.log(`\n✅  Done. Deleted: ${deleted} | Kept: ${toKeep.length}\n`);
}

main().catch((err) => { console.error('\n❌  Error:', err.message); process.exit(1); });
