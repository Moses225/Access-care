/**
 * migrate-billing-to-subcollection.js
 *
 * Moves sensitive billing fields from providers/{id} (world-readable by authenticated
 * patients) into providers/{id}/billing/main (provider-owner + admin only).
 *
 * FIELDS MOVED:
 *   stripeCustomerId, stripePaymentMethodId, stripeSubscriptionId,
 *   manualBilling, commissionRate, billable, planActivatedAt,
 *   providerNumber, billingSetupAt
 *
 * FIELDS *NOT* MOVED (intentionally kept on main doc):
 *   hsaEligible  — shown as a public badge on the patient app (app/(tabs)/index.tsx,
 *                  app/provider/[id].tsx).  Moving it would break patient-facing badges.
 *
 * STRATEGY — read-copy-verify-delete (safe to run while live):
 *   1. Read each providers/{id} doc
 *   2. Write billing fields to providers/{id}/billing/main (merge — idempotent)
 *   3. Verify the subcollection doc exists and contains expected data
 *   4. Remove billing fields from the parent doc via FieldValue.delete()
 *
 * RE-RUN SAFETY: Uses set({…}, { merge: true }) so re-running won't wipe extra fields.
 * Docs with no billing fields are skipped with a SKIP log.
 *
 * USAGE:
 *   node scripts/migrate-billing-to-subcollection.js
 *   # or for a dry run (no writes):
 *   DRY_RUN=true node scripts/migrate-billing-to-subcollection.js
 */

"use strict";

const admin = require("firebase-admin");
const path  = require("path");

// ── Service account ───────────────────────────────────────────────────────────
// Uses the same key the other migration scripts in this directory use.
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = require(SERVICE_ACCOUNT_PATH);
} catch {
  console.error(
    `ERROR: Service account key not found at ${SERVICE_ACCOUNT_PATH}\n` +
    "Download it from Firebase Console → Project Settings → Service Accounts."
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "true";

// Billing fields to move out of the main providers doc.
// IMPORTANT: hsaEligible is intentionally excluded — it is a patient-visible
// badge and must stay on the main doc so the patient app can read it.
const BILLING_FIELDS = [
  "stripeCustomerId",
  "stripePaymentMethodId",
  "stripeSubscriptionId",
  "manualBilling",
  "commissionRate",
  "billable",          // provider-level billing flag; distinct from booking.billable
  "planActivatedAt",
  "providerNumber",
  "billingSetupAt",
];

async function migrate() {
  console.log(
    DRY_RUN
      ? "=== DRY RUN — no Firestore writes will be made ===\n"
      : "=== LIVE RUN — Firestore writes are ENABLED ===\n"
  );

  const snapshot = await db.collection("providers").get();
  console.log(`Found ${snapshot.size} provider document(s).\n`);

  const stats = { migrated: 0, skipped: 0, alreadyDone: 0, errors: 0 };

  for (const provDoc of snapshot.docs) {
    const providerId = provDoc.id;
    const data       = provDoc.data();

    // ── Collect billing fields present on this doc ───────────────────────────
    const billingData = {};
    for (const field of BILLING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        billingData[field] = data[field];
      }
    }

    if (Object.keys(billingData).length === 0) {
      // Check whether the subcollection doc already exists (already migrated)
      const existing = await db
        .collection("providers").doc(providerId)
        .collection("billing").doc("main")
        .get();

      if (existing.exists) {
        console.log(`  ALREADY_DONE  ${providerId}`);
        stats.alreadyDone++;
      } else {
        console.log(`  SKIP          ${providerId} — no billing fields on main doc`);
        stats.skipped++;
      }
      continue;
    }

    console.log(
      `  MIGRATE       ${providerId} — fields: ${Object.keys(billingData).join(", ")}`
    );

    if (DRY_RUN) {
      stats.migrated++;
      continue;
    }

    try {
      const billingRef = db
        .collection("providers").doc(providerId)
        .collection("billing").doc("main");

      // STEP 1 — write billing fields to subcollection (merge = idempotent)
      await billingRef.set(
        { ...billingData, _migratedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      // STEP 2 — verify the write
      const verify = await billingRef.get();
      if (!verify.exists) {
        throw new Error("Verification failed: subcollection doc absent after write.");
      }
      for (const field of Object.keys(billingData)) {
        if (!Object.prototype.hasOwnProperty.call(verify.data(), field)) {
          throw new Error(`Verification failed: field '${field}' missing from subcollection doc.`);
        }
      }

      // STEP 3 — remove billing fields from parent doc
      const deletePayload = {};
      for (const field of Object.keys(billingData)) {
        deletePayload[field] = admin.firestore.FieldValue.delete();
      }
      await provDoc.ref.update(deletePayload);

      console.log(`    ✓ done`);
      stats.migrated++;
    } catch (err) {
      console.error(`    ✗ ERROR for ${providerId}:`, err.message);
      stats.errors++;
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Migration ${DRY_RUN ? "(DRY RUN) " : ""}complete
  Migrated:     ${stats.migrated}
  Skipped:      ${stats.skipped}
  Already done: ${stats.alreadyDone}
  Errors:       ${stats.errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (stats.errors > 0) {
    console.error(
      "\nSome providers failed. Re-run the script — it is idempotent.\n" +
      "Already-migrated docs will be detected and skipped."
    );
    process.exit(1);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
