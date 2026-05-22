/**
 * setRecoveryFacilityRole.js
 *
 * One-time admin script: stamps a providerUsers doc with
 *   role: "recovery_facility"
 *   facilityId: <recoveryHousing doc ID>
 *
 * Also forces the matching Firebase Auth custom claim so the dashboard
 * token check still passes (provider: true + providerId stays intact).
 *
 * Usage:
 *   node scripts/setRecoveryFacilityRole.js
 *
 * Requirements:
 *   - scripts/serviceAccountKey.json present (production key)
 *   - OR change the require below to serviceAccountKey.staging.json for staging
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

// ── CONFIG ────────────────────────────────────────────────────────────────────
// The email address of the recovery facility test account
const FACILITY_EMAIL = "kouaassii@gmail.com";

// The Firestore document ID inside the /recoveryHousing collection that belongs
// to this account (e.g. "dream-oklahoma-city-ok").
// Find it in Firebase Console → Firestore → recoveryHousing collection.
const FACILITY_DOC_ID = "dream-okc";
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (FACILITY_DOC_ID === "REPLACE_WITH_RECOVERY_HOUSING_DOC_ID") {
    console.error(
      "❌  Set FACILITY_DOC_ID to the recoveryHousing document ID before running.",
    );
    process.exit(1);
  }

  // 1. Look up UID by email
  console.log(`🔍  Looking up UID for ${FACILITY_EMAIL}...`);
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(FACILITY_EMAIL);
  } catch (err) {
    console.error(
      `❌  Could not find Firebase Auth user for ${FACILITY_EMAIL}:`,
      err.message,
    );
    process.exit(1);
  }
  const uid = userRecord.uid;
  console.log(`✅  Found UID: ${uid}`);

  // 2. Verify the recoveryHousing doc exists
  console.log(`🔍  Verifying recoveryHousing/${FACILITY_DOC_ID} exists...`);
  const facilitySnap = await db
    .collection("recoveryHousing")
    .doc(FACILITY_DOC_ID)
    .get();
  if (!facilitySnap.exists) {
    console.error(
      `❌  recoveryHousing/${FACILITY_DOC_ID} does not exist. Check the doc ID.`,
    );
    process.exit(1);
  }
  console.log(`✅  Facility found: "${facilitySnap.data().facilityName}"`);

  // 3. Update providerUsers doc
  console.log(`📝  Updating providerUsers/${uid}...`);
  const puRef = db.collection("providerUsers").doc(uid);
  const puSnap = await puRef.get();

  if (!puSnap.exists) {
    console.error(`❌  providerUsers/${uid} does not exist.`);
    console.error(`    The account may not have been onboarded yet.`);
    console.error(
      `    Create it manually in Firebase Console first, then re-run.`,
    );
    process.exit(1);
  }

  const puData = puSnap.data();
  // Only stamp freeTrialStartedAt once — don't reset it if the script is re-run
  const trialStart = puData.freeTrialStartedAt || new Date().toISOString();
  const isNewTrial = !puData.freeTrialStartedAt;

  await puRef.update({
    role: "recovery_facility",
    facilityId: FACILITY_DOC_ID,
    freeTrialStartedAt: trialStart,
    listingStatus: puData.listingStatus || "active_free",
  });
  console.log(
    `✅  providerUsers/${uid} updated → role: "recovery_facility", facilityId: "${FACILITY_DOC_ID}"`,
  );
  if (isNewTrial) {
    console.log(`✅  Free trial clock started: ${trialStart}`);
  } else {
    console.log(`ℹ️   Free trial already started: ${trialStart} (not reset)`);
  }

  // 4. Set custom claims — add facilityId so Firestore rules can verify ownership
  //    without a document read (fast + tamper-proof)
  const existing = userRecord.customClaims || {};
  await auth.setCustomUserClaims(uid, {
    ...existing,
    provider: true,
    providerId: existing.providerId || FACILITY_DOC_ID,
    facilityId: FACILITY_DOC_ID,   // ← used by Firestore + Storage rules
    role: "recovery_facility",     // ← used for server-side role checks
  });
  console.log(`✅  Custom claims set — provider: true, facilityId: "${FACILITY_DOC_ID}", role: "recovery_facility"`);

  // 5. Also stamp managedByUid + trial dates on the facility doc
  const facilityUpdate = {
    managedByUid: uid,
    listingStatus: facilitySnap.data().listingStatus || "active_free",
  };
  if (!facilitySnap.data().freeTrialStartedAt) {
    facilityUpdate.freeTrialStartedAt = trialStart;
  }
  await db.collection("recoveryHousing").doc(FACILITY_DOC_ID).update(facilityUpdate);
  console.log(
    `✅  recoveryHousing/${FACILITY_DOC_ID} → managedByUid: "${uid}", listingStatus stamped`,
  );

  console.log(
    "\n🎉  Done. Log out and back in as kouaassii@gmail.com to get a fresh token.",
  );
  console.log("    The dashboard should now route to RecoveryDashboard.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
