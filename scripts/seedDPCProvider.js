// ─────────────────────────────────────────────────────────────────────────────
// seedDPCProvider.js — creates a realistic DPC test provider in Firestore
//
// Usage:
//   node scripts/seedDPCProvider.js
//
// What it creates:
//   1. /providers/{id}          — visible in patient app (search, detail page)
//   2. /providerUsers/{uid}     — dashboard login record (if --with-dashboard flag)
//
// Options:
//   --with-dashboard   Also create a Firebase Auth account + providerUsers doc
//                      so you can log into the provider dashboard as this provider
//
// The script is idempotent: re-running it with the same PROVIDER_ID updates
// the existing doc rather than duplicating it.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ── Config ───────────────────────────────────────────────────────────────────
const WITH_DASHBOARD = process.argv.includes("--with-dashboard");

// Fixed ID so re-runs are idempotent — change if you want a second test provider
const PROVIDER_ID = "test-dpc-provider-001";

// Dashboard login credentials (only used with --with-dashboard)
const DASHBOARD_EMAIL    = "dpc-test@moravacare.com";
const DASHBOARD_PASSWORD = "REDACTED_ROTATED";   // change before sharing

// ── Provider document (patient-facing) ───────────────────────────────────────
const providerDoc = {
  // ── Identity ────────────────────────────────────────────────────────────
  name:             "Dr. Sarah Mitchell, MD",
  specialty:        "Direct Primary Care",
  practiceName:     "Mitchell Direct Care",
  bio:              "Board-certified family medicine physician offering affordable, " +
                    "membership-based primary care. No insurance hassles — just direct, " +
                    "personal care for you and your family. Same-day and next-day " +
                    "appointments available.",

  // ── Contact & Location ───────────────────────────────────────────────────
  address:          "4821 N Lincoln Blvd, Suite 200",
  city:             "Oklahoma City",
  state:            "Oklahoma",
  zip:              "73105",
  phone:            "(405) 555-0192",
  email:            "hello@mitchelldirectcare.com",
  website:          "https://mitchelldirectcare.com",
  latitude:         35.5051,
  longitude:        -97.5164,

  // ── DPC-specific fields ─────────────────────────────────────────────────
  practiceType:         "dpc",
  dpcMonthlyFee:        65,
  dpcDescription:       "Unlimited primary care visits for a flat monthly fee. " +
                        "Includes sick visits, annual wellness exams, basic lab reviews, " +
                        "and care coordination. No copays, no deductibles, no surprise bills. " +
                        "HSA funds can be used to pay your membership fee.",
  hsaEligible:          true,
  acceptingNewMembers:  true,

  // ── Availability ─────────────────────────────────────────────────────────
  acceptsNewPatients:   true,   // kept for backwards compatibility
  acceptingNewPatients: true,
  telehealth:           true,
  telehealthOnly:       false,
  inPerson:             true,

  // ── Insurance (DPC doesn't bill insurance, but keeps SoonerCare note) ────
  // DPC providers show a special "does not bill insurance" card in the app.
  // Leave insuranceAccepted empty — the detail page handles DPC differently.
  insuranceAccepted:    [],
  acceptsSelfPay:       true,   // membership = self-pay model
  acceptsMedicaid:      false,
  soonerCareProvider:   false,
  fqhc:                 false,
  tribal:               false,
  slidingScale:         false,

  // ── Profile ───────────────────────────────────────────────────────────────
  profilePicture:       "",     // no photo on test account
  welcomeMessage:       "Welcome! I started Mitchell Direct Care to bring back " +
                        "the doctor-patient relationship. I'm here when you need me.",
  languages:            ["English", "Spanish"],
  specialInterests:     ["Preventive Care", "Chronic Disease Management", "Women's Health"],
  education:            [
    { degree: "MD", school: "University of Oklahoma College of Medicine", year: "2012" },
    { degree: "Residency", school: "OU Family Medicine", year: "2015" },
  ],

  // ── Plan / billing metadata (admin-managed) ───────────────────────────────
  plan:                 "founding",      // DPC founding tier — $25/month
  verified:             true,
  active:               true,
  billable:             true,
  manualBilling:        false,
  isFoundingProvider:   true,
  commissionRate:       0.1,
  providerNumber:       "DPC-TEST-001",

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:            admin.firestore.FieldValue.serverTimestamp(),
  updatedAt:            admin.firestore.FieldValue.serverTimestamp(),
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Seeding DPC test provider...\n");

  // ── 1. Write provider document ─────────────────────────────────────────
  const providerRef = db.collection("providers").doc(PROVIDER_ID);
  await providerRef.set(providerDoc, { merge: true });
  console.log(`✅  providers/${PROVIDER_ID} written`);
  console.log(`    Name:         ${providerDoc.name}`);
  console.log(`    Practice:     ${providerDoc.practiceName}`);
  console.log(`    DPC fee:      $${providerDoc.dpcMonthlyFee}/mo`);
  console.log(`    HSA eligible: ${providerDoc.hsaEligible}`);
  console.log(`    Accepting:    ${providerDoc.acceptingNewMembers}`);
  console.log(`    Location:     ${providerDoc.city}, ${providerDoc.state}\n`);

  // ── 2. Optionally create dashboard account ─────────────────────────────
  if (!WITH_DASHBOARD) {
    console.log("ℹ️   Skipped dashboard account (run with --with-dashboard to create one)");
    console.log("\n📱  Test in the patient app:");
    console.log("    • Enable the DPC filter on the search tab");
    console.log(`    • Search for "Mitchell Direct Care" or "Direct Primary Care"`);
    console.log(`    • Provider ID: ${PROVIDER_ID}\n`);
    return;
  }

  // Create or retrieve Firebase Auth account
  let uid;
  try {
    const existing = await auth.getUserByEmail(DASHBOARD_EMAIL);
    uid = existing.uid;
    console.log(`ℹ️   Auth account already exists: ${uid}`);
  } catch {
    const newUser = await auth.createUser({
      email:         DASHBOARD_EMAIL,
      password:      DASHBOARD_PASSWORD,
      displayName:   providerDoc.name,
      emailVerified: true,   // required by Firebase before MFA enrollment
    });
    uid = newUser.uid;
    console.log(`✅  Firebase Auth account created: ${uid}`);
  }

  // Set custom claims so the dashboard recognises this as a provider
  await auth.setCustomUserClaims(uid, {
    provider:   true,
    providerId: PROVIDER_ID,
  });
  console.log(`✅  Custom claims set: { provider: true, providerId: "${PROVIDER_ID}" }`);

  // Write providerUsers document
  const providerUserDoc = {
    uid,
    email:       DASHBOARD_EMAIL,
    name:        providerDoc.name,
    providerId:  PROVIDER_ID,
    role:        "provider",
    plan:             "founding",   // DPC founding tier — $25/month
    practiceType:     "dpc",
    listingStatus:    "active",
    isFoundingProvider: true,
    createdAt:        admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection("providerUsers").doc(uid).set(providerUserDoc, { merge: true });
  console.log(`✅  providerUsers/${uid} written\n`);

  console.log("🎉  Dashboard account ready:");
  console.log(`    URL:      https://dashboard.moravacare.com`);
  console.log(`    Email:    ${DASHBOARD_EMAIL}`);
  console.log(`    Password: ${DASHBOARD_PASSWORD}`);
  console.log("\n📱  Test in the patient app:");
  console.log("    • Enable the DPC filter on the search tab");
  console.log(`    • Search for "Mitchell Direct Care"`);
  console.log(`    • Provider ID: ${PROVIDER_ID}\n`);
  console.log("⚠️   MFA is enforced on the dashboard — set up 2FA on first login.\n");
}

main().catch((err) => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
