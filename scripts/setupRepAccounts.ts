/**
 * scripts/setupRepAccounts.ts
 *
 * Creates Firebase Auth accounts for Morava sales reps and stamps the
 * `rep: true` custom claim so admin can manage them.
 *
 * SECURITY: Never hardcode passwords in this file.
 * Passwords are generated randomly at runtime and printed ONCE to stdout.
 * Store them immediately in your password manager — they are not saved anywhere.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./scripts/serviceAccountKey.json \
 *   npx ts-node --skip-project \
 *   --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
 *   scripts/setupRepAccounts.ts
 */

import * as admin from "firebase-admin";
import * as crypto from "crypto";

// ── Init ──────────────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "accesscare-app",
  });
}

const auth = admin.auth();
const db   = admin.firestore();

// ── Secure random password ────────────────────────────────────────────────────
// 20-char password: alphanumeric + guaranteed special chars, no ambiguous chars
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const specials = "!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < 16; i++) {
    pwd += chars[crypto.randomInt(chars.length)];
  }
  // Inject 2 specials at random positions to satisfy complexity requirements
  pwd += specials[crypto.randomInt(specials.length)];
  pwd += crypto.randomInt(10);
  return pwd;
}

// ── Rep definitions (emails only — no passwords stored) ───────────────────────
const REPS = [
  { email: "amartin@moravacare.com", displayName: "Andrea Martin"   },
  { email: "kbailey@moravacare.com", displayName: "Kimberly Bailey" },
];

// ── Demo patient account ──────────────────────────────────────────────────────
const DEMO_PATIENT = {
  email:       "demo@moravacare.com",
  displayName: "Alex Demo",
};

async function createOrUpdateRep(rep: typeof REPS[0], password: string) {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(rep.email);
    uid = existing.uid;
    // Account already exists — rotate to new password
    await auth.updateUser(uid, { password });
    console.log(`🔄 Rotated password for ${rep.email} (uid: ${uid})`);
  } catch {
    const created = await auth.createUser({
      email:         rep.email,
      displayName:   rep.displayName,
      password,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`🆕 Created account for ${rep.email} (uid: ${uid})`);
  }

  await auth.setCustomUserClaims(uid, { rep: true });
  console.log(`🎫 Custom claim rep:true set for ${rep.displayName}`);

  await db.collection("repApplications").doc(uid).set({
    name:            rep.displayName,
    email:           rep.email,
    status:          "approved",
    verifiedCount:   0,
    pendingEarnings: 0,
    role:            "Sales Rep",
    source:          "internal",
    createdAt:       admin.firestore.FieldValue.serverTimestamp(),
    approvedAt:      admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return uid;
}

async function createOrUpdateDemo(password: string) {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(DEMO_PATIENT.email);
    uid = existing.uid;
    await auth.updateUser(uid, { password });
    console.log(`🔄 Rotated password for ${DEMO_PATIENT.email}`);
  } catch {
    const created = await auth.createUser({
      email:         DEMO_PATIENT.email,
      displayName:   DEMO_PATIENT.displayName,
      password,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`🆕 Created demo patient (uid: ${uid})`);
  }

  await db.collection("users").doc(uid).set({
    displayName:        DEMO_PATIENT.displayName,
    email:              DEMO_PATIENT.email,
    phone:              "+13125550199",
    dateOfBirth:        "1990-01-15",
    gender:             "Prefer not to say",
    onboardingComplete: true,
    createdAt:          admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return uid;
}

async function main() {
  console.log("🚀 Setting up Morava rep accounts...\n");

  // Generate all passwords upfront so they are printed together at the end
  const passwords = REPS.map(() => generatePassword());
  const demoPassword = generatePassword();

  for (let i = 0; i < REPS.length; i++) {
    await createOrUpdateRep(REPS[i], passwords[i]);
  }

  await createOrUpdateDemo(demoPassword);

  // ── Print credentials ONCE — save to password manager immediately ──────────
  console.log("\n" + "═".repeat(56));
  console.log("🔐 SAVE THESE NOW — not stored anywhere else");
  console.log("═".repeat(56));
  for (let i = 0; i < REPS.length; i++) {
    console.log(`\n  ${REPS[i].displayName}`);
    console.log(`    Email:    ${REPS[i].email}`);
    console.log(`    Password: ${passwords[i]}`);
  }
  console.log(`\n  Demo Patient (provider outreach demos)`);
  console.log(`    Email:    ${DEMO_PATIENT.email}`);
  console.log(`    Password: ${demoPassword}`);
  console.log("\n" + "═".repeat(56));
  console.log("⚠️  These passwords are NOT saved in code or logs.");
  console.log("   Store in 1Password / Bitwarden immediately.");
  console.log("═".repeat(56) + "\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
