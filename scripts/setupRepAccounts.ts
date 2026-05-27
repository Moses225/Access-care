/**
 * scripts/setupRepAccounts.ts
 *
 * Creates Firebase Auth accounts for Morava sales reps and stamps the
 * `rep: true` custom claim so they are routed to the Rep Portal in the app.
 *
 * Also creates a pre-populated demo patient account for provider outreach demos.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json scripts/setupRepAccounts.ts
 *
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a Firebase service
 *     account JSON (or run from Cloud Shell where ADC is available).
 *   - firebase-admin installed (already in functions/package.json, or install
 *     locally: npm install firebase-admin)
 */

import * as admin from "firebase-admin";

// ── Init ──────────────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "accesscare-app",
  });
}

const auth = admin.auth();
const db   = admin.firestore();

// ── Rep definitions ───────────────────────────────────────────────────────────
const REPS = [
  {
    email:       "amartin@moravacare.com",
    displayName: "Andrea Martin",
    tempPassword: "REDACTED_ROTATED",  // Must change on first login
  },
  {
    email:       "kbailey@moravacare.com",
    displayName: "Kimberly Bailey",
    tempPassword: "REDACTED_ROTATED",
  },
];

// ── Demo patient account ──────────────────────────────────────────────────────
const DEMO_PATIENT = {
  email:       "demo@moravacare.com",
  displayName: "Alex Demo",
  password:    "REDACTED_ROTATED",
};

async function createOrUpdateRep(rep: typeof REPS[0]) {
  let uid: string;

  try {
    // Try to get existing account
    const existing = await auth.getUserByEmail(rep.email);
    uid = existing.uid;
    console.log(`✅ Found existing account for ${rep.email} (uid: ${uid})`);
  } catch {
    // Create new account
    const created = await auth.createUser({
      email:         rep.email,
      displayName:   rep.displayName,
      password:      rep.tempPassword,
      emailVerified: true, // Pre-verify — they're internal staff
    });
    uid = created.uid;
    console.log(`🆕 Created account for ${rep.email} (uid: ${uid})`);
  }

  // Stamp rep: true custom claim
  await auth.setCustomUserClaims(uid, { rep: true });
  console.log(`🎫 Custom claim rep:true set for ${rep.displayName}`);

  // Write a repApplications doc so admin dashboard shows them as active reps
  await db.collection("repApplications").doc(uid).set({
    name:          rep.displayName,
    email:         rep.email,
    status:        "approved",
    verifiedCount: 0,
    pendingEarnings: 0,
    role:          "Sales Rep",
    source:        "internal",
    createdAt:     admin.firestore.FieldValue.serverTimestamp(),
    approvedAt:    admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`📋 repApplications doc written for ${rep.displayName}\n`);
  return uid;
}

async function createDemoPatient() {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(DEMO_PATIENT.email);
    uid = existing.uid;
    console.log(`✅ Demo patient already exists (uid: ${uid})`);
  } catch {
    const created = await auth.createUser({
      email:         DEMO_PATIENT.email,
      displayName:   DEMO_PATIENT.displayName,
      password:      DEMO_PATIENT.password,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`🆕 Created demo patient (uid: ${uid})`);
  }

  // Pre-populate demo user profile in Firestore
  await db.collection("users").doc(uid).set({
    displayName: "Alex Demo",
    email:       DEMO_PATIENT.email,
    phone:       "+13125550199",
    dateOfBirth: "1990-01-15",
    gender:      "Prefer not to say",
    onboardingComplete: true,
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`🎭 Demo patient profile written (uid: ${uid})\n`);
  return uid;
}

async function main() {
  console.log("🚀 Setting up Morava rep accounts...\n");

  for (const rep of REPS) {
    await createOrUpdateRep(rep);
  }

  console.log("🎭 Setting up demo patient account...\n");
  await createDemoPatient();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All done!\n");
  console.log("Rep login credentials:");
  for (const rep of REPS) {
    console.log(`  ${rep.displayName}`);
    console.log(`    Email:    ${rep.email}`);
    console.log(`    Password: ${rep.tempPassword}  ← have them change this`);
  }
  console.log("\nDemo patient credentials:");
  console.log(`  Email:    ${DEMO_PATIENT.email}`);
  console.log(`  Password: ${DEMO_PATIENT.password}`);
  console.log("\nReps will be routed to the Rep Portal automatically on login.");
  console.log("Demo account logs in as a regular patient for provider demos.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
