// One-shot patch: fix Dr. Sarah Mitchell's plan from "growth" → "founding"
// in both providers/{id} and providerUsers/{uid}.
// Safe to run multiple times (idempotent).
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db   = admin.firestore();
const auth = admin.auth();
const PROVIDER_ID     = "test-dpc-provider-001";
const DASHBOARD_EMAIL = "dpc-test@moravacare.com";

async function main() {
  // 1. Patch providers doc (patient-facing)
  await db.collection("providers").doc(PROVIDER_ID).update({
    plan:             "founding",
    isFoundingProvider: true,
    updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅  providers/${PROVIDER_ID}  → plan: "founding"`);

  // 2. Patch providerUsers doc (dashboard)
  let uid;
  try {
    const user = await auth.getUserByEmail(DASHBOARD_EMAIL);
    uid = user.uid;
  } catch {
    console.log("ℹ️   No dashboard account found — skipping providerUsers patch");
    return;
  }
  await db.collection("providerUsers").doc(uid).update({
    plan:               "founding",
    isFoundingProvider: true,
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅  providerUsers/${uid}  → plan: "founding"`);
  console.log("\n🎉  Dr. Sarah Mitchell is now on the DPC Founding tier ($25/month)");
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
