import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Resend } from "resend";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();

const resendApiKey = defineSecret("RESEND_API_KEY");
const stripeSecretKey    = defineSecret("STRIPE_SECRET_KEY");
const twilioAccountSid   = defineSecret("TWILIO_ACCOUNT_SID");
const twilioApiKeySid    = defineSecret("TWILIO_API_KEY_SID");
const twilioApiKeySecret = defineSecret("TWILIO_API_KEY_SECRET");
const twilioFromNumber   = defineSecret("TWILIO_FROM_NUMBER");

function esc(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .substring(0, 500);
}

function wrapEmail(title: string, body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0F172A;padding:20px 24px;border-radius:12px 12px 0 0">
        <span style="color:#fff;font-size:18px;font-weight:bold">Morava</span>
        <span style="color:#94A3B8;font-size:13px;margin-left:8px">${title}</span>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
        ${body}
        <p style="color:#94A3B8;font-size:11px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">
          Morava Care LLC &middot; Oklahoma City, OK &middot; support@moravacare.com<br/>
          Do not reply with protected health information.
        </p>
      </div>
    </div>
  `;
}

export const onProviderApplication = onDocumentCreated(
  {
    document: "providerApplications/{docId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Morava <noreply@moravacare.com>",
      to: "moise@moravacare.com",
      subject: `New Provider Application — ${esc(data.name)}`,
      html: wrapEmail(
        "New Provider Application",
        `
        <h2 style="color:#0F172A;margin:0 0 16px">New provider application</h2>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
          <p style="margin:0 0 8px"><strong>Name:</strong> ${esc(data.name)}</p>
          <p style="margin:0 0 8px"><strong>Practice:</strong> ${esc(data.practice) || "Not provided"}</p>
          <p style="margin:0 0 8px"><strong>Specialty:</strong> ${esc(data.specialty) || "Not provided"}</p>
          <p style="margin:0 0 8px"><strong>NPI:</strong> ${esc(data.npi) || "Not provided"}</p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${esc(data.email)}</p>
          <p style="margin:0 0 8px"><strong>Phone:</strong> ${esc(data.phone) || "Not provided"}</p>
          <p style="margin:0"><strong>Message:</strong> ${esc(data.message) || "None"}</p>
        </div>
        <a href="https://moravacare.com/admin" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center">
          Review in Admin Panel &rarr;
        </a>
      `,
      ),
    });
    if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      await resend.emails.send({
        from: "Morava Care <noreply@moravacare.com>",
        to: data.email,
        subject: "We received your Morava provider application",
        html: wrapEmail(
          "Provider Application",
          `
          <h2 style="color:#0F172A;margin:0 0 16px">Thank you, ${esc(data.name)}!</h2>
          <p style="color:#475569">We've received your application to join Morava as a verified provider.</p>
          <ol style="color:#475569;line-height:1.8">
            <li>We'll review your information within 24 hours</li>
            <li>You'll receive login credentials for your provider dashboard</li>
            <li>Your profile will be verified for patients to see</li>
            <li>Oklahoma SoonerCare patients can start booking with you</li>
          </ol>
          <p style="color:#475569">Questions? <a href="mailto:support@moravacare.com" style="color:#14B8A6">support@moravacare.com</a></p>
        `,
        ),
      });
    }
  },
);

export const onWaitlistSignup = onDocumentCreated(
  {
    document: "waitlist/{docId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return;
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Moise at Morava <noreply@moravacare.com>",
      to: data.email,
      subject: "You're on the Morava list 🎉",
      html: wrapEmail(
        "Welcome",
        `
        <h2 style="color:#0F172A;margin:0 0 16px">You're on the list!</h2>
        <p style="color:#475569;line-height:1.7">Thanks for joining the Morava waitlist. We're building Oklahoma's first free healthcare discovery and booking app.</p>
        <div style="background:#f0fdfb;border:1px solid #ccfbf1;border-radius:12px;padding:20px;margin:20px 0">
          <p style="color:#0f172a;font-weight:bold;margin:0 0 12px">Available now on iOS + Android</p>
          <a href="https://moravacare.com" style="display:inline-block;background:#14B8A6;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold">Find a Doctor Now &rarr;</a>
        </div>
        <p style="color:#475569;margin-top:16px">Built with love in Oklahoma City,<br/><strong>Moise Kouassi</strong> &middot; Founder, Morava Care LLC</p>
      `,
      ),
    });
    await resend.emails.send({
      from: "Morava <noreply@moravacare.com>",
      to: "moise@moravacare.com",
      subject: `New waitlist signup: ${esc(data.email)}`,
      html: wrapEmail(
        "Waitlist",
        `<p><strong>Email:</strong> ${esc(data.email)}</p><p><strong>Source:</strong> ${esc(data.source) || "moravacare.com"}</p>`,
      ),
    });
  },
);

// BOOKING CREATED — PHI policy: NO clinical data in email, ever.
export const onBookingCreated = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "pending") return;
    if (!data.providerId || !data.patientName || !data.date || !data.time)
      return;
    let providerEmail: string | null = null;
    try {
      const snap = await db
        .collection("providerUsers")
        .where("providerId", "==", data.providerId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const e = snap.docs[0].data().email as string | undefined;
        if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) providerEmail = e;
      }
    } catch (err) {
      console.error("onBookingCreated: provider lookup failed", err);
      return;
    }
    if (!providerEmail) return;
    try {
      const resend = new Resend(resendApiKey.value());
      await resend.emails.send({
        from: "Morava <noreply@moravacare.com>",
        to: providerEmail,
        subject: `You have a new Morava booking request`,
        html: wrapEmail(
          "New Appointment Request",
          `
          <h2 style="color:#0F172A;margin:0 0 16px">You have a new booking request</h2>
          <p style="color:#475569;margin-bottom:20px">A patient has requested an appointment. Log in to your Morava dashboard to review the patient health summary and confirm or decline.</p>
          <a href="https://dashboard.moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;font-size:16px">
            Review &amp; Confirm in Dashboard &rarr;
          </a>
          <p style="color:#94A3B8;font-size:12px;margin-top:16px;text-align:center">Appointment details are only visible after logging in.</p>
        `,
        ),
      });
    } catch (err) {
      console.error("onBookingCreated: email send failed", err);
    }

    // ── Mark availability slot as taken (admin SDK — bypasses client rules) ──
    // Patients cannot write to availability/* from the client (security rule).
    // We do it here instead so the slot is blocked for concurrent bookers.
    if (data.providerId && data.date && data.time) {
      try {
        await db
          .collection("availability")
          .doc(data.providerId as string)
          .collection("slots")
          .doc(data.date as string)
          .set({ [data.time as string]: true }, { merge: true });
      } catch (err) {
        // Non-fatal: provider can still confirm/decline; slot just stays open
        console.error("onBookingCreated: availability update failed", err);
      }
    }

    // Push notification to patient — booking received confirmation
    if (data.userId) {
      try {
        const patientDoc = await db.collection("users").doc(data.userId).get();
        const pushToken = patientDoc.data()?.expoPushToken;
        if (pushToken?.startsWith("ExponentPushToken[")) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: pushToken,
              title: "📋 Booking Request Sent",
              body: `Your appointment request has been submitted and is pending confirmation. Open Morava to view details.`,
              data: {
                bookingId: event.params.bookingId,
                type: "booking_pending",
              },
              sound: "default",
              priority: "high",
              channelId: "appointments",
            }),
          });
        }
      } catch (pushErr) {
        console.error("onBookingCreated: push failed", pushErr);
      }
    }
  },
);

// BOOKING STATUS CHANGED — PHI policy: no clinical data, scheduling info only.
export const onBookingStatusChanged = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return;
    // Include 'pending' for the reschedule-decline case where the booking
    // was still pending when the provider proposed, and patient declines
    // back to pending (not confirmed).
    if (
      !["confirmed", "cancelled", "reschedule_pending", "pending"].includes(after.status)
    )
      return;
    if (!after.userId) return;

    // ── Reschedule response detection ───────────────────────────────────────
    // Patient declined → status reverts to whatever it was before ('confirmed'
    // or 'pending'). rescheduleDeclinedAt is stamped.
    const isRescheduleDecline =
      before.status === "reschedule_pending" &&
      (after.status === "confirmed" || after.status === "pending") &&
      !before.rescheduleDeclinedAt &&
      !!after.rescheduleDeclinedAt;

    // Patient accepted → status becomes 'confirmed', rescheduleAcceptedAt stamped.
    const isRescheduleAccept =
      before.status === "reschedule_pending" &&
      after.status === "confirmed" &&
      !after.rescheduleDeclinedAt &&
      !!after.rescheduleAcceptedAt;

    // Notify the PROVIDER when a patient responds to their reschedule proposal.
    // The provider has no other visibility — they don't get a push, and the
    // dashboard only updates when they refresh/reload.
    if ((isRescheduleDecline || isRescheduleAccept) && after.providerId) {
      try {
        const provSnap = await db
          .collection("providerUsers")
          .where("providerId", "==", after.providerId)
          .limit(1)
          .get();
        if (!provSnap.empty) {
          const provData = provSnap.docs[0].data();
          const provEmail = provData.email as string | undefined;
          if (provEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provEmail)) {
            const resend = new Resend(resendApiKey.value());
            if (isRescheduleDecline) {
              await resend.emails.send({
                from: "Morava <noreply@moravacare.com>",
                to: provEmail,
                subject: "A patient declined your reschedule proposal",
                html: wrapEmail(
                  "Appointment Update",
                  `
                  <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:14px;margin-bottom:14px">
                    <strong style="color:#92400E">↩ Reschedule declined — original time kept</strong>
                  </div>
                  <p style="color:#475569">A patient has declined your proposed reschedule and will keep their original appointment time. Log in to your dashboard to view the booking.</p>
                  <a href="https://morava-dashboard.web.app" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View in Dashboard &rarr;</a>
                  <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible after logging in.</p>
                  `,
                ),
              });
            } else {
              // isRescheduleAccept
              await resend.emails.send({
                from: "Morava <noreply@moravacare.com>",
                to: provEmail,
                subject: "A patient accepted your reschedule proposal ✓",
                html: wrapEmail(
                  "Appointment Update",
                  `
                  <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;padding:14px;margin-bottom:14px">
                    <strong style="color:#166534">✓ Reschedule accepted — appointment updated</strong>
                  </div>
                  <p style="color:#475569">A patient has accepted your proposed reschedule. The appointment is now confirmed for the new date and time. Log in to your dashboard to view the updated booking.</p>
                  <a href="https://morava-dashboard.web.app" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View in Dashboard &rarr;</a>
                  <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible after logging in.</p>
                  `,
                ),
              });
            }
          }
        }
      } catch (err) {
        console.error("onBookingStatusChanged: provider reschedule notification failed", err);
      }
    }

    // Patient declined → skip patient notification entirely.
    // They already made the choice — sending "Your appointment is confirmed!"
    // would be misleading and confusing.
    if (isRescheduleDecline) return;
    // 'pending' only flows this far if it was a reschedule-decline (caught above).
    // Any other transition to 'pending' should not trigger patient notifications.
    if (after.status === "pending") return;

    let patientEmail: string | null = null;
    try {
      const snap = await db.collection("users").doc(after.userId).get();
      if (snap.exists) {
        const e = snap.data()?.email as string | undefined;
        if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) patientEmail = e;
      }
    } catch (err) {
      console.error("onBookingStatusChanged: patient lookup failed", err);
      return;
    }
    if (!patientEmail) return;
    let subject = "",
      bodyHtml = "";
    if (after.status === "confirmed") {
      subject = `Your Morava appointment has been confirmed`;
      bodyHtml = `
        <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#166534">Your appointment is confirmed!</strong>
        </div>
        <p style="color:#475569">Your upcoming appointment has been confirmed. Open the Morava app to view the full appointment details including date, time, and provider information.</p>
        <p style="color:#475569">Please arrive 10 minutes early with your ID and insurance card.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View Details in Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;
    } else if (after.status === "cancelled") {
      subject = `Your Morava appointment has been updated`;
      bodyHtml = `
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#991B1B">Appointment update</strong>
        </div>
        <p style="color:#475569">An upcoming appointment has been cancelled or declined. Open the Morava app to view details and find another available provider.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Open Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;
    } else {
      subject = `Your provider has proposed a new appointment time`;
      bodyHtml = `
        <div style="background:#FAF5FF;border-left:4px solid #A855F7;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#7E22CE">New time proposed</strong>
        </div>
        <p style="color:#475569">Your provider has proposed a new time for your upcoming appointment. Open the Morava app to view the proposed time and accept or decline.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Respond in Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;
    }
    try {
      const resend = new Resend(resendApiKey.value());
      await resend.emails.send({
        from: "Morava <noreply@moravacare.com>",
        to: patientEmail,
        subject,
        html: wrapEmail("Appointment Update", bodyHtml),
      });
    } catch (err) {
      console.error("onBookingStatusChanged: email send failed", err);
    }

    // Push notification to patient
    if (after.userId) {
      try {
        const patientDoc = await db.collection("users").doc(after.userId).get();
        const pushToken = patientDoc.data()?.expoPushToken;
        if (pushToken?.startsWith("ExponentPushToken[")) {
          let pushTitle = "";
          let pushBody = "";
          if (after.status === "confirmed") {
            pushTitle = "✅ Appointment Confirmed!";
            pushBody = `Your appointment has been confirmed. Open Morava to view the details.`;
          } else if (after.status === "cancelled") {
            pushTitle = "❌ Appointment Cancelled";
            pushBody = `An appointment has been cancelled. Open Morava for details.`;
          } else if (after.status === "reschedule_pending") {
            pushTitle = "📅 Reschedule Proposed";
            pushBody = `Your provider has proposed a new appointment time. Open Morava to respond.`;
          }
          if (pushTitle) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: pushToken,
                title: pushTitle,
                body: pushBody,
                data: { bookingId: event.params.bookingId, type: after.status },
                sound: "default",
                priority: "high",
                channelId: "appointments",
              }),
            });
          }
        }
      } catch (pushErr) {
        console.error("onBookingStatusChanged: push failed", pushErr);
      }
    }
  },
);

// NIGHTLY AUTO-COMPLETE — paginated to handle >499 bookings safely
export const nightlyAutoComplete = onSchedule(
  { schedule: "0 5 * * *", timeZone: "America/Chicago", region: "us-central1" },
  async () => {
    const cn = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
    );
    const today = `${cn.getFullYear()}-${String(cn.getMonth() + 1).padStart(2, "0")}-${String(cn.getDate()).padStart(2, "0")}`;
    const snap = await db
      .collection("bookings")
      .where("status", "==", "confirmed")
      .where("date", "<", today)
      .get();
    if (snap.empty) {
      console.log("nightlyAutoComplete: nothing to complete.");
      return;
    }
    const CHUNK = 499;
    let total = 0;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = db.batch();
      snap.docs.slice(i, i + CHUNK).forEach((d) =>
        batch.update(d.ref, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedBy: "system",
          billable: true,
        }),
      );
      await batch.commit();
      total += Math.min(CHUNK, snap.docs.length - i);
    }
    console.log(
      `nightlyAutoComplete: completed ${total} bookings before ${today}.`,
    );
  },
);

// MONTHLY BILLING — double-charge protection + idempotency keys + PHI-free emails
export const monthlyBilling = onSchedule(
  {
    schedule: "0 13 1 * *",
    timeZone: "America/Chicago",
    region: "us-central1",
    secrets: [stripeSecretKey, resendApiKey],
  },
  async () => {
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2026-04-22.dahlia" as any,
    });
    const resend = new Resend(resendApiKey.value());
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
    );
    const p = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const startDate = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const endDate = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    const periodKey = `${startDate}_${endDate}`;

    // invoiced != true prevents double-charging on retries
    const snap = await db
      .collection("bookings")
      .where("status", "==", "completed")
      .where("billable", "==", true)
      .where("invoiced", "!=", true)
      .where("date", ">=", startDate)
      .where("date", "<", endDate)
      .get();
    if (snap.empty) {
      console.log(`monthlyBilling: no unbilled visits for ${periodKey}.`);
      return;
    }

    const byProvider: Record<string, { count: number; ids: string[] }> = {};
    snap.docs.forEach((d) => {
      const pid = d.data().providerId as string | undefined;
      if (!pid) return;
      if (!byProvider[pid]) byProvider[pid] = { count: 0, ids: [] };
      byProvider[pid].count++;
      byProvider[pid].ids.push(d.id);
    });

    for (const [pid, info] of Object.entries(byProvider)) {
      try {
        const pSnap = await db.collection("providers").doc(pid).get();
        if (!pSnap.exists) continue;
        const pd = pSnap.data()!;

        // Billing credentials are in the private subcollection (not on the main doc)
        const bilSnap = await db.collection("providers").doc(pid)
          .collection("billing").doc("main").get();
        const bilData = bilSnap.exists ? bilSnap.data()! : {};
        const cid = bilData.stripeCustomerId as string | undefined;
        const pmid = bilData.stripePaymentMethodId as string | undefined;
        if (!cid || !pmid) {
          await resend.emails.send({
            from: "Morava Billing <noreply@moravacare.com>",
            to: "moise@moravacare.com",
            subject: `Billing skipped — no card: ${esc(pd.name) || pid}`,
            html: wrapEmail(
              "Billing Alert",
              `<p>Provider <strong>${esc(pd.name) || pid}</strong> has <strong>${info.count} visits</strong> but no payment method. Period: ${startDate} to ${endDate}.</p>`,
            ),
          });
          continue;
        }
        // Founding providers pay $6 for 2 years from foundingProviderSince, then $10
        let rate = 10; // standard rate default
        // New field format (plan + foundingExpiresAt)
        if (pd.plan === "founding" && pd.foundingExpiresAt) {
          const expiry =
            typeof pd.foundingExpiresAt === "string"
              ? new Date(pd.foundingExpiresAt)
              : (pd.foundingExpiresAt.toDate?.() ?? new Date(0));
          if (new Date() < expiry) rate = 6;
        }
        // Legacy field format — kept for backward compatibility
        else if (pd.foundingProvider === true && pd.foundingProviderSince) {
          const since = pd.foundingProviderSince.toDate
            ? pd.foundingProviderSince.toDate()
            : new Date(pd.foundingProviderSince);
          const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
          if (Date.now() - since.getTime() < twoYearsMs) rate = 6;
        }
        const amount = info.count * rate * 100;
        const pi = await stripe.paymentIntents.create(
          {
            amount,
            currency: "usd",
            customer: cid,
            payment_method: pmid,
            confirm: true,
            off_session: true,
            description: `Morava — ${info.count} visit${info.count !== 1 ? "s" : ""} (${startDate} to ${endDate})`,
            metadata: {
              providerId: pid,
              visitCount: String(info.count),
              period: periodKey,
              bookingIds: info.ids.slice(0, 10).join(","),
            },
          },
          { idempotencyKey: `billing-${pid}-${periodKey}` },
        );
        console.log(
          `monthlyBilling: charged ${pid} $${amount / 100} — ${pi.id}`,
        );
        const CHUNK = 499;
        for (let i = 0; i < info.ids.length; i += CHUNK) {
          const batch = db.batch();
          info.ids.slice(i, i + CHUNK).forEach((bid) =>
            batch.update(db.collection("bookings").doc(bid), {
              invoiced: true,
              invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
              stripePaymentIntentId: pi.id,
            }),
          );
          await batch.commit();
        }
        const puSnap = await db
          .collection("providerUsers")
          .where("providerId", "==", pid)
          .limit(1)
          .get();
        const pe = puSnap.empty
          ? null
          : (puSnap.docs[0].data().email as string | undefined);
        if (pe && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pe)) {
          await resend.emails.send({
            from: "Morava Billing <noreply@moravacare.com>",
            to: pe,
            subject: `Morava receipt — $${(amount / 100).toFixed(2)}`,
            html: wrapEmail(
              "Monthly Receipt",
              `
              <h2 style="color:#0F172A;margin:0 0 16px">Receipt — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
                <p style="margin:0 0 8px;color:#475569"><strong>Period:</strong> ${startDate} to ${endDate}</p>
                <p style="margin:0 0 8px;color:#475569"><strong>Visits:</strong> ${info.count}</p>
                <p style="margin:0 0 8px;color:#475569"><strong>Rate:</strong> $${rate}/visit${pd.foundingProvider ? " (Founding Provider rate — locked for 2 years)" : ""}</p>
                <p style="margin:0;color:#0F172A;font-size:20px;font-weight:bold">Total: $${(amount / 100).toFixed(2)}</p>
              </div>
            `,
            ),
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`monthlyBilling: error for ${pid}:`, msg);
        try {
          await resend.emails.send({
            from: "Morava Billing <noreply@moravacare.com>",
            to: "moise@moravacare.com",
            subject: `Billing error — provider ${pid}`,
            html: wrapEmail(
              "Billing Error",
              `<p>Provider: <strong>${esc(pid)}</strong><br/>Period: ${startDate} to ${endDate}<br/>Error: ${esc(msg)}<br/>Visits: ${info.count}</p>`,
            ),
          });
        } catch {
          console.error("Failed to send billing error alert.");
        }
      }
    }
    console.log(`monthlyBilling: complete for ${periodKey}.`);
  },
);
// ================================================================
// ON PROVIDER GO LIVE — auto-verifies email when admin marks live
// Triggers on providerSubmissions status change to 'live'
// ================================================================
export const onProviderGoLive = onDocumentUpdated(
  {
    document: "providerSubmissions/{docId}",
    database: "(default)",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only fire when status transitions TO 'live'
    if (before.status === "live" || after.status !== "live") return;

    const email = after.email as string | undefined;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(
        `onProviderGoLive: invalid or missing email for doc ${event.params.docId}`,
      );
      return;
    }

    try {
      // Look up Firebase Auth user by email
      const userRecord = await admin.auth().getUserByEmail(email);

      // Mark email as verified — required for MFA enrollment
      await admin.auth().updateUser(userRecord.uid, { emailVerified: true });

      console.log(
        `onProviderGoLive: email verified for ${email} (${userRecord.uid})`,
      );
    } catch (err) {
      // auth/user-not-found means the provider account hasn't been created yet
      // This is non-fatal — email can be verified when the account is created
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `onProviderGoLive: could not verify email for ${email}: ${errMsg}`,
      );
    }
  },
);

// ================================================================
// CREATE SETUP INTENT — callable from provider dashboard
// Creates a Stripe Setup Intent and returns the client secret.
// The dashboard uses this to collect and save the provider's card
// without charging it. Saves stripeCustomerId + stripePaymentMethodId
// to providers/{providerId} on webhook confirmation.
//
// ================================================================
// ON PROVIDER USER CREATED
// Firestore trigger: fires when an admin creates a new providerUsers document.
//
// What it does automatically:
//   1. If the doc already has a valid providerId → just stamps custom claims
//   2. If providerId is missing → creates a minimal providers/{uid} document
//      from whatever fields are on the providerUsers doc, then sets providerId
//      on the providerUsers doc and stamps custom claims
//
// This means the admin only needs to create one document (providerUsers) and
// the system handles the rest — no missing providerId, no stuck spinners.
// ================================================================
export const onProviderUserCreated = onDocumentCreated(
  {
    document: "providerUsers/{uid}",
    database: "(default)",
    region: "us-central1",
  },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data) return;

    let providerId = data.providerId as string | undefined;

    // ── Step 1: auto-create providers doc if providerId is absent ─────────
    if (!providerId) {
      const providerRef = db.collection("providers").doc(uid);
      const provSnap = await providerRef.get();

      if (!provSnap.exists) {
        // ── Auto-assign plan based on founding window ──────────────────────
        // The first FOUNDING_LIMIT providers get the founding rate ($6/visit,
        // locked 2 years).  Every provider created after that is "standard"
        // ($10/visit) unless the admin explicitly overrides plan in the doc.
        // Count is taken from the platform/counters doc (providerCount field)
        // which is incremented by this trigger.  If the admin already set a
        // plan on the providerUsers doc, honour it — never downgrade.
        const FOUNDING_LIMIT = 50; // first 50 providers are founding
        let assignedPlan: string = data.plan || "";
        if (!assignedPlan) {
          const counterSnap = await db.collection("platform").doc("counters").get();
          const providerCount = (counterSnap.data()?.providerCount as number) || 0;
          assignedPlan = providerCount < FOUNDING_LIMIT ? "founding" : "standard";
          console.log(`onProviderUserCreated: providerCount=${providerCount}, assigned plan=${assignedPlan}`);
        }

        // Build a minimal providers document from whatever the admin put in
        // providerUsers. The provider can fill the rest in via their profile page.
        await providerRef.set({
          name:             data.name        || data.facilityName || "",
          specialty:        data.specialty   || "",
          email:            data.email       || "",
          practiceType:     data.practiceType || "standard",
          plan:             assignedPlan,
          verified:         false,
          active:           true,
          createdAt:        admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
          _autoCreated:     true,   // flag so admins know this needs review
        });
        console.log(`onProviderUserCreated: auto-created providers/${uid}`);
      }

      // Write providerId back onto the providerUsers doc
      providerId = uid;
      await db.collection("providerUsers").doc(uid).update({ providerId: uid });
      console.log(`onProviderUserCreated: set providerId=${uid} on providerUsers/${uid}`);
    }

    // ── Step 2: stamp custom claims ───────────────────────────────────────
    try {
      await admin.auth().setCustomUserClaims(uid, {
        provider:   true,
        providerId,
        facilityId: data.facilityId ?? null,
      });
      console.log(`onProviderUserCreated: claims set for uid=${uid}, providerId=${providerId}`);
    } catch (err) {
      // Auth account may not exist yet if doc was created before the Auth user.
      // ensureProviderClaims will handle it on first login.
      console.warn(`onProviderUserCreated: could not set claims for uid=${uid}:`, err);
    }
  },
);

// ================================================================
// ENSURE PROVIDER CLAIMS
// Sets / refreshes custom claims (provider: true, providerId) from the
// caller's providerUsers document.  Called automatically from AuthContext
// when the token is missing claims — most common for providers onboarded
// before the claim-stamping flow was added.
//
// SECURITY:
//   - Caller can only set claims for their OWN account (request.auth.uid)
//   - Claims are derived entirely from the server-side providerUsers document
//     — the client supplies no claim values
//   - Idempotent: safe to call on every login if needed
// ================================================================
export const ensureProviderClaims = onCall(
  { region: "us-central1", enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const uid = request.auth.uid;
    const snap = await db.collection("providerUsers").doc(uid).get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "No provider account found for this user.");
    }

    const data = snap.data()!;
    const providerId = data.providerId as string | undefined;
    const facilityId = data.facilityId as string | undefined;

    if (!providerId && !facilityId) {
      throw new HttpsError(
        "failed-precondition",
        "Provider account is incomplete — missing providerId.",
      );
    }

    // Stamp custom claims from the authoritative server-side document.
    // These are used by Firestore rules (isBookingProvider, isVerifiedProvider)
    // and by createSetupIntent to verify the caller owns the provider account.
    await admin.auth().setCustomUserClaims(uid, {
      provider:   true,
      providerId: providerId ?? null,
      facilityId: facilityId ?? null,
    });

    console.log(`ensureProviderClaims: stamped claims for uid=${uid}, providerId=${providerId}`);
    return { ok: true, providerId: providerId ?? null };
  },
);

// ================================================================
// STRIPE SETUP INTENT
// Creates a Stripe SetupIntent so the dashboard can save a card
// without charging it. Saves stripeCustomerId + stripePaymentMethodId
// to providers/{providerId}/billing/main on webhook confirmation.
//
// SECURITY:
//   - Requires authenticated Firebase user (auth context enforced)
//   - Verifies caller's providerId matches their custom claim
//   - Never logs or returns full card details
//   - Idempotent: reuses existing Stripe customer if present
//   - Billing data written to private subcollection — not readable by patients
// ================================================================
export const createSetupIntent = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    // App Check is intentionally disabled on the web dashboard — see firebase.ts.
    // The function enforces its own auth (Firebase UID + providerId custom claim
    // match) which provides equivalent security for the dashboard use case.
    // Re-enable once native App Check is wired into the mobile build.
    enforceAppCheck: false,
  },
  async (request) => {
    // Require authenticated user
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const callerUid = request.auth.uid;
    const callerProviderId = request.auth.token?.providerId as
      | string
      | undefined;
    const providerId = request.data?.providerId as string | undefined;
    const rawPaymentMethodType = (request.data?.paymentMethodType as string) || "card";

    if (!providerId) {
      throw new HttpsError("invalid-argument", "providerId is required.");
    }

    // Validate payment method type — only card and US bank account supported
    const ALLOWED_PAYMENT_TYPES = ["card", "us_bank_account"] as const;
    type AllowedPaymentType = (typeof ALLOWED_PAYMENT_TYPES)[number];
    if (!(ALLOWED_PAYMENT_TYPES as readonly string[]).includes(rawPaymentMethodType)) {
      throw new HttpsError("invalid-argument", "Invalid paymentMethodType. Must be 'card' or 'us_bank_account'.");
    }
    const paymentMethodType = rawPaymentMethodType as AllowedPaymentType;

    // Security check: caller's custom claim must match the providerId they're setting up billing for
    if (callerProviderId !== providerId) {
      console.error(
        `createSetupIntent: UID ${callerUid} claimed providerId ${callerProviderId} but requested ${providerId}`,
      );
      throw new HttpsError(
        "permission-denied",
        "Not authorized for this provider account.",
      );
    }

    // ── Rate limit: max 20 setup-intent calls per provider per calendar day ───
    // Prevents a compromised provider token from running up Stripe API quota.
    // Key format mirrors the SMS rate-limit pattern: "{providerId}_{YYYY-MM-DD}"
    const today = new Date().toISOString().split("T")[0];
    const siRateLimitRef = db
      .collection("setupIntentRateLimits")
      .doc(`${providerId}_${today}`);
    const siLimitSnap = await siRateLimitRef.get();
    const siCount = (siLimitSnap.data()?.count as number) || 0;
    if (siCount >= 20) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many billing setup attempts today. Please try again tomorrow or contact support.",
      );
    }
    // Increment counter atomically (fire-and-forget — don't block the setup)
    siRateLimitRef.set(
      {
        count:     admin.firestore.FieldValue.increment(1),
        providerId,
        date:      today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    ).catch((e: unknown) => console.warn("createSetupIntent: rate-limit write failed:", e));

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2026-04-22.dahlia" as any,
    });

    // Fetch provider document to get name/email and check for existing customer.
    // If the doc is absent (e.g. onProviderUserCreated trigger ran before the Auth
    // user existed, or was skipped on update), auto-create it from the providerUsers
    // doc so the provider can still complete billing setup without admin intervention.
    const provRef = db.collection("providers").doc(providerId);
    let provSnap = await provRef.get();

    if (!provSnap.exists) {
      const puSnap = await db.collection("providerUsers").doc(callerUid).get();
      if (!puSnap.exists) {
        throw new HttpsError("not-found", "Provider account not found.");
      }
      const puData = puSnap.data()!;
      await provRef.set({
        name:         puData.name        || puData.facilityName || "",
        specialty:    puData.specialty   || "",
        email:        puData.email       || "",
        practiceType: puData.practiceType || "standard",
        plan:         puData.plan        || "founding",
        verified:     false,
        active:       true,
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
        _autoCreated: true,
      });
      console.log(`createSetupIntent: auto-created providers/${providerId} for uid=${callerUid}`);
      provSnap = await provRef.get();
    }

    const provData = provSnap.data()!;

    // Billing fields live in the private subcollection — not on the main doc
    const billingRef = db.collection("providers").doc(providerId)
      .collection("billing").doc("main");
    const billingSnap = await billingRef.get();
    const billingData = billingSnap.exists ? billingSnap.data()! : {};
    let stripeCustomerId = billingData.stripeCustomerId as string | undefined;

    // Reuse existing Stripe customer or create new one
    const createFreshCustomer = async () => {
      const customer = await stripe.customers.create({
        email: provData.email || "",
        name: provData.name || providerId,
        metadata: { providerId, firebaseUid: callerUid },
      });
      await billingRef.set({ stripeCustomerId: customer.id }, { merge: true });
      console.log(`createSetupIntent: created new Stripe customer ${customer.id} for ${providerId}`);
      return customer.id;
    };

    if (!stripeCustomerId) {
      // No customer on file — create one
      stripeCustomerId = await createFreshCustomer();
    }

    // Create Setup Intent — captures card without charging.
    // If the saved customer ID is stale (e.g. deleted in Stripe dashboard,
    // created under a different API key, or from a sandbox purge) Stripe
    // returns resource_missing.  Recreate the customer and retry once.
    let setupIntent;
    try {
      setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: [paymentMethodType],
        usage: "off_session",
        metadata: { providerId, firebaseUid: callerUid, paymentMethodType },
      });
    } catch (stripeErr: unknown) {
      const code = (stripeErr as { code?: string }).code;
      if (code === "resource_missing") {
        console.warn(`createSetupIntent: customer ${stripeCustomerId} not found in Stripe — recreating`);
        stripeCustomerId = await createFreshCustomer();
        setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: [paymentMethodType],
          usage: "off_session",
          metadata: { providerId, firebaseUid: callerUid, paymentMethodType },
        });
      } else {
        throw stripeErr;
      }
    }

    // Return only what the client needs — never expose the full setup intent
    return {
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    };
  },
);

// ================================================================
// STRIPE WEBHOOK — confirms card saved after Setup Intent succeeds
// Saves stripePaymentMethodId to providers/{providerId}
// This is what the billing function uses to charge the provider
// ================================================================
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req, res) => {
    // Stripe webhooks use POST only
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // Verify webhook signature — rejects any request not genuinely from Stripe
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2026-04-22.dahlia" as any,
    });

    let event;
    try {
      // rawBody MUST be present — Firebase Functions v2 preserves it for HTTP
      // triggers.  Falling back to re-serialized JSON (JSON.stringify(req.body))
      // would silently pass a different payload to constructEvent and break
      // signature verification, undermining the entire webhook security model.
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!raw) {
        console.error("stripeWebhook: rawBody missing — cannot verify signature");
        res.status(400).send("Webhook error: rawBody unavailable");
        return;
      }
      event = stripe.webhooks.constructEvent(
        raw,
        sig,
        stripeWebhookSecret.value(),
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Signature verification failed";
      console.error("stripeWebhook: signature verification failed:", msg);
      res.status(400).send(`Webhook error: ${msg}`);
      return;
    }

    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object;
      const providerId = setupIntent.metadata?.providerId;
      const paymentMethodId = setupIntent.payment_method as string | null;

      if (providerId && paymentMethodId) {
        try {
          // Fetch full payment method details from Stripe so we can store
          // last4, brand, bank name, etc. for display in the dashboard.
          let pmInfo: Record<string, unknown> = {
            id: paymentMethodId,
            type: "card",
            addedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          try {
            const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
            pmInfo.type = pm.type;
            if (pm.type === "card" && pm.card) {
              pmInfo.last4     = pm.card.last4;
              pmInfo.brand     = pm.card.brand;
              pmInfo.expMonth  = pm.card.exp_month;
              pmInfo.expYear   = pm.card.exp_year;
            } else if (pm.type === "us_bank_account" && pm.us_bank_account) {
              pmInfo.last4       = pm.us_bank_account.last4;
              pmInfo.bankName    = pm.us_bank_account.bank_name;
              pmInfo.accountType = pm.us_bank_account.account_type;
            }
          } catch (pmErr) {
            console.warn(`stripeWebhook: could not fetch PM details for ${paymentMethodId}:`, pmErr);
            // Continue — we still save the ID even without full details
          }

          const billingRef = db.collection("providers").doc(providerId)
            .collection("billing").doc("main");
          const billingSnap = await billingRef.get();
          const billingData = billingSnap.exists ? (billingSnap.data() ?? {}) : {};

          // Merge into paymentMethods array — replace if same ID already exists
          // (e.g. a retry), otherwise append.
          const existing = (billingData.paymentMethods as Array<Record<string, unknown>>) || [];
          const others   = existing.filter((m) => m.id !== paymentMethodId);

          // First method ever → set as default automatically
          const currentDefault = billingData.defaultPaymentMethodId as string | undefined;
          const newDefault = currentDefault || paymentMethodId;

          pmInfo.isDefault = newDefault === paymentMethodId;

          const updatedMethods = [...others, pmInfo];

          // Write to the private billing subcollection
          await billingRef.set(
            {
              stripePaymentMethodId: paymentMethodId,   // backward-compat field
              defaultPaymentMethodId: newDefault,
              paymentMethods: updatedMethods,
              billingSetupAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          // Sync stripePaymentMethodId to providerUsers so AuthContext.refreshProfile()
          // detects the new method immediately without a page reload.
          const puSnap = await db
            .collection("providerUsers")
            .where("providerId", "==", providerId)
            .limit(1)
            .get();
          if (!puSnap.empty) {
            await puSnap.docs[0].ref.update({
              stripePaymentMethodId: paymentMethodId,
            });
          }
          console.log(
            `stripeWebhook: saved payment method ${paymentMethodId} (${String(pmInfo.type)}) for provider ${providerId}`,
          );
        } catch (err) {
          console.error("stripeWebhook: failed to save payment method:", err);
          res.status(500).send("Database update failed");
          return;
        }
      }
    } else if (event.type === "setup_intent.setup_failed") {
      // Log failed card setup attempts so we can follow up with providers
      // who couldn't complete billing setup. No Firestore write needed —
      // the providers doc stays without a payment method (dashboard will
      // continue showing the billing banner prompting them to retry).
      const setupIntent = event.data.object;
      const providerId = setupIntent.metadata?.providerId;
      const failureMsg = setupIntent.last_setup_error?.message ?? "unknown";
      console.warn(
        `stripeWebhook: setup_intent.setup_failed for provider ${providerId ?? "unknown"}: ${failureMsg}`,
      );
    } else if (event.type === "payment_intent.payment_failed") {
      // Monthly billing charge failed — log and alert so we can follow up.
      // The invoiced flag is NOT set, so the booking will be retried next cycle.
      const paymentIntent = event.data.object;
      const providerId = paymentIntent.metadata?.providerId;
      const failureMsg = paymentIntent.last_payment_error?.message ?? "unknown";
      console.error(
        `stripeWebhook: payment_intent.payment_failed for provider ${providerId ?? "unknown"}: ${failureMsg}`,
      );
      // Alert admin via Firestore so it surfaces in any admin dashboard
      if (providerId) {
        try {
          await db.collection("billingAlerts").add({
            type: "payment_failed",
            providerId,
            paymentIntentId: paymentIntent.id,
            failureMessage: failureMsg,
            amount: paymentIntent.amount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (alertErr) {
          console.error("stripeWebhook: failed to write billingAlert:", alertErr);
        }
      }
    }

    res.status(200).json({ received: true });
  },
);

// ================================================================
// REQUEST MANUAL BILLING — callable from provider dashboard
// Writes manualBilling: true to the private billing subcollection and
// alerts the admin. Direct Firestore writes to this subcollection are
// blocked by rules (allow write: if false), so providers use this
// callable instead.
//
// SECURITY: caller must be the owner of the providerId (custom claim check)
// ================================================================
export const requestManualBilling = onCall(
  {
    region: "us-central1",
    secrets: [resendApiKey],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const callerProviderId = request.auth.token?.providerId as string | undefined;
    const providerId = request.data?.providerId as string | undefined;

    if (!providerId) {
      throw new HttpsError("invalid-argument", "providerId is required.");
    }
    if (callerProviderId !== providerId) {
      throw new HttpsError("permission-denied", "Not authorized for this provider account.");
    }

    // Write to private billing subcollection via Admin SDK
    await db.collection("providers").doc(providerId)
      .collection("billing").doc("main")
      .set(
        {
          manualBilling: true,
          manualBillingRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    // Send admin alert email immediately from the callable (no Firestore trigger needed)
    try {
      const provSnap = await db.collection("providers").doc(providerId).get();
      const pd = provSnap.exists ? provSnap.data()! : {};
      const resend = new Resend(resendApiKey.value());
      await resend.emails.send({
        from: "Morava <noreply@moravacare.com>",
        to: "moise@moravacare.com",
        subject: `Manual billing requested — ${esc(pd.name) || providerId}`,
        html: wrapEmail(
          "Manual Billing Request",
          `
          <p><strong>${esc(pd.name) || providerId}</strong> has requested manual billing (check or ACH).</p>
          <p><strong>Provider ID:</strong> ${esc(providerId)}</p>
          <p>Follow up within 1 business day to arrange payment method.</p>
        `,
        ),
      });
    } catch (emailErr) {
      // Non-fatal — billing subcollection is already updated; email is best-effort
      console.error("requestManualBilling: failed to send alert email:", emailErr);
    }

    return { ok: true };
  },
);

// ================================================================
// SET DEFAULT PAYMENT METHOD — marks one saved method as the one
// that will be charged on the 1st of each month.
//
// SECURITY: caller must own the providerId (custom claim check)
// ================================================================
export const setDefaultPaymentMethod = onCall(
  { region: "us-central1", enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const callerProviderId = request.auth.token?.providerId as string | undefined;
    const providerId       = request.data?.providerId as string | undefined;
    const paymentMethodId  = request.data?.paymentMethodId as string | undefined;

    if (!providerId || !paymentMethodId) {
      throw new HttpsError("invalid-argument", "providerId and paymentMethodId are required.");
    }
    if (callerProviderId !== providerId) {
      throw new HttpsError("permission-denied", "Not authorized for this provider account.");
    }

    const billingRef = db.collection("providers").doc(providerId)
      .collection("billing").doc("main");
    const billingSnap = await billingRef.get();
    if (!billingSnap.exists) {
      throw new HttpsError("not-found", "Billing record not found.");
    }

    const billingData  = billingSnap.data()!;
    const methods      = (billingData.paymentMethods as Array<Record<string, unknown>>) || [];
    const targetExists = methods.some((m) => m.id === paymentMethodId);
    if (!targetExists) {
      throw new HttpsError("not-found", "Payment method not found on this account.");
    }

    // Update isDefault flag on every method, set defaultPaymentMethodId
    const updated = methods.map((m) => ({ ...m, isDefault: m.id === paymentMethodId }));
    await billingRef.update({
      defaultPaymentMethodId: paymentMethodId,
      paymentMethods: updated,
    });

    console.log(`setDefaultPaymentMethod: ${paymentMethodId} set as default for ${providerId}`);
    return { ok: true };
  },
);

// ================================================================
// REMOVE PAYMENT METHOD — detaches a saved method from the Stripe
// customer and removes it from the billing record.
//
// SECURITY: caller must own the providerId (custom claim check)
// ================================================================
export const removePaymentMethod = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const callerProviderId = request.auth.token?.providerId as string | undefined;
    const providerId       = request.data?.providerId as string | undefined;
    const paymentMethodId  = request.data?.paymentMethodId as string | undefined;

    if (!providerId || !paymentMethodId) {
      throw new HttpsError("invalid-argument", "providerId and paymentMethodId are required.");
    }
    if (callerProviderId !== providerId) {
      throw new HttpsError("permission-denied", "Not authorized for this provider account.");
    }

    const billingRef = db.collection("providers").doc(providerId)
      .collection("billing").doc("main");
    const billingSnap = await billingRef.get();
    if (!billingSnap.exists) {
      throw new HttpsError("not-found", "Billing record not found.");
    }

    const billingData = billingSnap.data()!;
    const methods     = (billingData.paymentMethods as Array<Record<string, unknown>>) || [];
    const remaining   = methods.filter((m) => m.id !== paymentMethodId);

    // Detach from Stripe so the method can't be accidentally charged
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2026-04-22.dahlia" as any,
    });
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
    } catch (stripeErr: unknown) {
      // If already detached or not found, continue — the goal is removal
      const code = (stripeErr as { code?: string }).code;
      if (code !== "resource_missing") {
        console.warn(`removePaymentMethod: Stripe detach failed for ${paymentMethodId}:`, stripeErr);
      }
    }

    // If we removed the default, promote the next available method
    const wasDefault    = billingData.defaultPaymentMethodId === paymentMethodId;
    const newDefault    = wasDefault ? (remaining[0]?.id as string | undefined) : billingData.defaultPaymentMethodId as string | undefined;

    const updatedMethods = remaining.map((m, i) => ({
      ...m,
      isDefault: newDefault ? m.id === newDefault : i === 0,
    }));

    await billingRef.update({
      paymentMethods:        updatedMethods,
      defaultPaymentMethodId: newDefault ?? admin.firestore.FieldValue.delete(),
      // Keep stripePaymentMethodId pointing to the new default (or delete if none left)
      stripePaymentMethodId: newDefault ?? admin.firestore.FieldValue.delete(),
    });

    // Keep providerUsers in sync
    const puSnap = await db
      .collection("providerUsers")
      .where("providerId", "==", providerId)
      .limit(1)
      .get();
    if (!puSnap.empty) {
      await puSnap.docs[0].ref.update({
        stripePaymentMethodId: newDefault ?? admin.firestore.FieldValue.delete(),
      });
    }

    console.log(`removePaymentMethod: removed ${paymentMethodId} for ${providerId}; new default: ${newDefault ?? "none"}`);
    return { ok: true, newDefaultPaymentMethodId: newDefault ?? null };
  },
);

// ================================================================
// MANUAL BILLING REQUEST (Firestore trigger) — fires when admin sets
// manualBilling: true directly on the billing subcollection via the
// Firebase Console (fallback for admin-side operations).
// Normal provider-initiated requests go through the callable above.
// ================================================================
export const onManualBillingRequest = onDocumentUpdated(
  {
    document: "providers/{providerId}/billing/{billingId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    console.log(
      `onManualBillingRequest: before.manualBilling=${before.manualBilling} after.manualBilling=${after.manualBilling}`,
    );
    if (before.manualBilling === true || after.manualBilling !== true) {
      console.log("onManualBillingRequest: skipping — condition not met");
      return;
    }
    console.log("onManualBillingRequest: sending alert email (admin-triggered path)");
    // Name lives on the main providers doc (not the billing subdoc)
    const provSnap = await db.collection("providers").doc(event.params.providerId).get();
    const pd = provSnap.exists ? provSnap.data()! : {};
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Morava <noreply@moravacare.com>",
      to: "moise@moravacare.com",
      subject: `Manual billing requested — ${esc(pd.name) || event.params.providerId}`,
      html: wrapEmail(
        "Manual Billing Request",
        `
        <p><strong>${esc(pd.name) || event.params.providerId}</strong> has requested manual billing (check or ACH).</p>
        <p><strong>Provider ID:</strong> ${esc(event.params.providerId)}</p>
        <p>Follow up within 1 business day to arrange payment method.</p>
      `,
      ),
    });
  },
);
// ================================================================
// ONBOARD PROVIDER — called from admin panel Mark Live
// Creates Firebase Auth account, sets custom claims,
// sends welcome email with password-setup link
// SECURITY:
//   - Only callable by admin (checked via custom claim)
//   - Idempotent: reuses existing account if email already exists
//   - Never logs passwords or tokens
// ================================================================
export const onboardProvider = onCall(
  {
    region: "us-central1",
    secrets: [resendApiKey],
    // H-7: App Check enforcement deferred — dashboard does not yet have App Check
    // initialized (reCAPTCHA site key / secret key setup pending).
    // Re-enable enforceAppCheck: true here once App Check is wired into the dashboard.
    // This function already requires isAdmin() on the token, so abuse surface is low.
  },
  async (request) => {
    // Require admin caller
    if (!request.auth?.token?.admin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const { providerId, providerName, email } = request.data as {
      providerId: string;
      providerName: string;
      email: string;
    };

    if (!providerId || !email || !providerName) {
      throw new HttpsError(
        "invalid-argument",
        "providerId, email, and providerName are required.",
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Invalid email address.");
    }

    let uid: string;
    let isNewAccount = false;

    try {
      // Try to get existing account first — idempotent
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
      console.log(
        `onboardProvider: existing account found for ${email} (${uid})`,
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") {
        // Create new account — provider will set their own password via the link
        const newUser = await admin.auth().createUser({
          email,
          emailVerified: true, // Required for MFA enrollment
          displayName: providerName,
          disabled: false,
        });
        uid = newUser.uid;
        isNewAccount = true;
        console.log(
          `onboardProvider: created new account for ${email} (${uid})`,
        );
      } else {
        throw err;
      }
    }

    // Set custom claims — provider: true + providerId
    await admin.auth().setCustomUserClaims(uid, {
      provider: true,
      providerId,
      facilityId: null,
    });

    // ── Resolve the provider's plan from their providers doc ──────────────────
    // This ensures the welcome email and providerUsers doc reflect the correct
    // rate — founding ($6) vs standard ($10) — rather than hardcoding $6.
    const provDoc = await db.collection("providers").doc(providerId).get();
    const provPlan = (provDoc.exists ? provDoc.data()?.plan : null) || "standard";
    const isDPCAccount = provDoc.exists && provDoc.data()?.practiceType === "dpc";
    const billingLine = isDPCAccount
      ? "You will be billed a flat monthly fee based on your DPC listing tier."
      : provPlan === "founding"
        ? "You pay <strong>$6 per completed visit</strong> (Founding Provider rate, locked for 2 years)."
        : "You pay <strong>$10 per completed visit</strong> — only when a patient attends.";

    // Create or update providerUsers document — set all fields needed by AuthContext
    // so the dashboard works correctly on first login without data gaps.
    const puRef = db.collection("providerUsers").doc(uid);
    const puSnap = await puRef.get();
    if (!puSnap.exists) {
      await puRef.set({
        uid,
        providerId,
        name:      providerName,
        email,
        role:      "provider",
        plan:      provPlan,
        verified:  true,
        active:    true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Idempotent update — fill in any fields that were missing from a partial record
      await puRef.set({
        name:    providerName,
        email,
        role:    "provider",
        plan:    provPlan,
        verified: true,
        active:  true,
      }, { merge: true });
    }

    // Generate password setup link — works as first-time password set
    const setupLink = await admin.auth().generatePasswordResetLink(email, {
      url: "https://dashboard.moravacare.com/login",
    });

    // Send welcome email with the correct billing rate for this provider's plan
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Moise at Morava <noreply@moravacare.com>",
      to: email,
      subject: `Welcome to Morava — set up your provider account`,
      html: wrapEmail(
        "Welcome to Morava",
        `
        <h2 style="color:#0F172A;margin:0 0 16px">Welcome to Morava, ${esc(providerName)}!</h2>
        <p style="color:#475569;line-height:1.7">Your provider profile has been verified and activated on Morava. Patients can now discover and book appointments with you.</p>
        <div style="background:#F0FDFB;border:1px solid #CCFBF1;border-radius:12px;padding:20px;margin:20px 0">
          <p style="color:#0F172A;font-weight:bold;margin:0 0 8px">Next steps:</p>
          <ol style="color:#475569;line-height:1.9;margin:0;padding-left:20px">
            <li>Click the button below to set your password</li>
            <li>Log into your dashboard at dashboard.moravacare.com</li>
            <li>Complete your provider profile (bio, photo, hours, insurance)</li>
            <li>Set up two-factor authentication for account security</li>
            <li>${billingLine}</li>
          </ol>
        </div>
        <a href="${setupLink}" style="display:block;background:#14B8A6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;font-size:16px;margin:20px 0">
          Set Up My Account &rarr;
        </a>
        <p style="color:#94A3B8;font-size:12px;text-align:center">This link expires in 24 hours. If you need a new link, go to dashboard.moravacare.com and click "Forgot password?"</p>
        <p style="color:#475569;margin-top:16px">Questions? Reply to this email or contact us at <a href="mailto:support@moravacare.com" style="color:#14B8A6">support@moravacare.com</a> or (855) 812-6996.</p>
        <p style="color:#475569">Welcome to Morava,<br/><strong>Moise Kouassi</strong><br/>Founder, Morava Care LLC</p>
      `,
      ),
    });

    console.log(
      `onboardProvider: welcome email sent to ${email}. New account: ${isNewAccount}`,
    );

    return {
      success: true,
      uid,
      isNewAccount,
    };
  },
);
// ================================================================
// ONBOARD PROVIDER — called from admin panel Mark Live
// Creates Firebase Auth account, sets custom claims,
// sends welcome email with password-setup link
// SECURITY:


// ================================================================
// SMS — CLOUD FUNCTION (credentials never in app bundle)
// Called from utils/sms.ts via httpsCallable
// ================================================================
// sendSMSNotification — provider-to-patient scheduling nudges only.
//
// SECURITY / HIPAA:
//   M-1: PHI pattern guard — rejects bodies that match SSN, DOB, ICD-10,
//        name+date combos, or other identifiable health data patterns.
//        PHI belongs in Firestore (encrypted at rest, access-controlled),
//        never in an SMS payload.
//   M-2: Per-provider rate limit — max 20 SMS per calendar day, enforced
//        server-side via a Firestore counter. Prevents a compromised provider
//        account from spamming patients.
//   Credentials: stored in Secret Manager, never in the client bundle.
//   Logging: never logs phone number or message body — only the Twilio SID.
// ================================================================
export const sendSMSNotification = onCall(
  { secrets: [twilioAccountSid, twilioApiKeySid, twilioApiKeySecret, twilioFromNumber] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to send SMS");
    }

    const { to, body } = request.data as { to?: string; body?: string };
    if (!to || !body) throw new HttpsError("invalid-argument", "Missing to or body");
    if (body.length > 320) throw new HttpsError("invalid-argument", "Message too long");

    // ── M-1: PHI pattern guard ─────────────────────────────────────────────
    // Reject any body that matches common PHI patterns. These patterns catch
    // accidental or intentional inclusion of health information in SMS.
    // This is defense-in-depth — the real PHI store is Firestore.
    const PHI_PATTERNS: RegExp[] = [
      /\b\d{3}-\d{2}-\d{4}\b/,                          // SSN: 123-45-6789
      /\b\d{9}\b/,                                       // SSN no-dash: 123456789
      /\b(dob|date of birth|born)[:\s]+\d/i,             // "DOB: 01/01/1990"
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,          // date: 01/01/1990
      /\b[A-Z]\d{2}\.?\d{0,2}\b/,                        // ICD-10: E11.9, J45
      /\b(diagnosis|dx|condition|medication|rx|allergy|prescription)[:\s]/i,
      /\b(HIV|AIDS|cancer|diabetes|bipolar|schizophrenia|hepatitis)\b/i,
      /\b(insurance|member\s?id|policy\s?#|group\s?#)[:\s]/i,
      /\b\d{10,}\b/,                                     // long numeric ID (MRN, insurance)
    ];
    for (const pattern of PHI_PATTERNS) {
      if (pattern.test(body)) {
        console.warn(`sendSMSNotification: PHI pattern blocked for provider ${request.auth.uid}`);
        throw new HttpsError(
          "invalid-argument",
          "Message body may contain protected health information and cannot be sent via SMS. " +
          "Use the Morava dashboard to share clinical details securely."
        );
      }
    }

    // ── M-2: Per-provider daily rate limit (max 20 SMS / provider / day) ───
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const rateLimitRef = db
      .collection("smsRateLimits")
      .doc(`${request.auth.uid}_${today}`);

    const MAX_DAILY = 20;
    const limitDoc = await rateLimitRef.get();
    const currentCount = (limitDoc.data()?.count as number) ?? 0;
    if (currentCount >= MAX_DAILY) {
      console.warn(`sendSMSNotification: rate limit hit for provider ${request.auth.uid}`);
      throw new HttpsError(
        "resource-exhausted",
        `Daily SMS limit of ${MAX_DAILY} reached. Resets at midnight.`
      );
    }
    // Increment atomically — set with merge so first call creates the doc
    await rateLimitRef.set(
      {
        count: admin.firestore.FieldValue.increment(1),
        providerId: request.auth.uid,
        date: today,
        // TTL: keep for 7 days for audit purposes, then auto-expire
        expiresAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
      { merge: true }
    );

    // ── Send via Twilio ────────────────────────────────────────────────────
    const sid     = twilioAccountSid.value();
    const apiSid  = twilioApiKeySid.value();
    const apiSec  = twilioApiKeySecret.value();
    const from    = twilioFromNumber.value();

    const sanitized = to.replace(/[^\d+]/g, "");
    const e164 = sanitized.startsWith("+") ? sanitized : `+1${sanitized}`;
    if (e164.length < 12) throw new HttpsError("invalid-argument", "Invalid phone number");

    // API key auth: user=KeySid, password=KeySecret (account SID stays in URL path)
    const credentials = Buffer.from(`${apiSid}:${apiSec}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: e164, Body: body }).toString(),
      }
    );

    const data = await response.json() as { sid?: string; message?: string };
    if (!response.ok) throw new HttpsError("internal", `Twilio: ${data.message}`);
    console.log(`✅ SMS sent sid=${data.sid}`); // intentionally never logs phone or body
    return { success: true, sid: data.sid };
  }
);

// ================================================================
// SCHEDULED REMINDERS — runs every 60 min
// Sends 24h and 2h SMS reminders for confirmed bookings.
// Marks reminder sent on the booking doc to prevent duplicates.
// PHI-FREE: body contains no provider name, patient name, date, time, or diagnosis.
// ================================================================
// H-3 fixes applied:
//   1. Collection was "appointments" — corrected to "bookings"
//   2. Patient lookup used appt.patientUid — corrected to appt.userId
//   3. Date query used Timestamp range — corrected to string equality
//      ("date" field is stored as "YYYY-MM-DD" string, not a Timestamp)
// ================================================================
export const sendAppointmentReminders = onSchedule(
  { schedule: "every 60 minutes",
    secrets: [twilioAccountSid, twilioApiKeySid, twilioApiKeySecret, twilioFromNumber] },
  async () => {
    const now = new Date();

    // Helper: return "YYYY-MM-DD" for a date offset by `offsetHours` from now
    const toDateStr = (offsetHours: number): string => {
      const d = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    };

    const windows = [
      { label: "24h", dateStr: toDateStr(24), field: "reminder24hSent" },
      { label: "2h",  dateStr: toDateStr(2),  field: "reminder2hSent"  },
    ];

    const sid     = twilioAccountSid.value();
    const apiSid  = twilioApiKeySid.value();
    const apiSec  = twilioApiKeySecret.value();
    const from    = twilioFromNumber.value();
    // API key auth: user=KeySid, password=KeySecret
    const credentials = Buffer.from(`${apiSid}:${apiSec}`).toString("base64");

    for (const w of windows) {
      // Query bookings collection (not "appointments") using string date equality
      const snap = await db.collection("bookings")
        .where("status", "==", "confirmed")
        .where("date", "==", w.dateStr)
        .get();

      for (const bookingDoc of snap.docs) {
        const appt = bookingDoc.data();
        if (appt[w.field]) continue; // already sent — skip

        // Get patient phone via userId (not patientUid — field is userId on bookings)
        const patientId = appt.userId as string | undefined;
        if (!patientId) continue;
        const userSnap = await db.collection("users").doc(patientId).get();
        const phone = userSnap.data()?.phone as string | undefined;
        if (!phone) continue;

        // PHI-FREE body — no patient name, provider name, date, time, or clinical data
        const body = w.label === "24h"
          ? "Morava: ⏰ Reminder — you have an appointment tomorrow. " +
            "Open the Morava app to view details. " +
            "Arrive 10 min early with your ID and insurance card. Reply STOP to unsubscribe."
          : "Morava: ⏰ Your appointment is in approximately 2 hours. " +
            "Open the Morava app to view details. Reply STOP to unsubscribe.";

        const sanitized = phone.replace(/[^\d+]/g, "");
        const e164 = sanitized.startsWith("+") ? sanitized : `+1${sanitized}`;

        try {
          const resp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ From: from, To: e164, Body: body }).toString(),
            }
          );
          if (resp.ok) {
            await bookingDoc.ref.update({ [w.field]: true });
            console.log(`✅ ${w.label} reminder sent → booking ${bookingDoc.id}`);
          } else {
            const err = await resp.json() as { message?: string };
            console.error(`❌ Twilio error for booking ${bookingDoc.id}: ${err.message}`);
          }
        } catch (err) {
          console.error(`❌ SMS failed for booking ${bookingDoc.id}:`, err);
        }
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// checkRecoveryTrialExpiry
//
// Runs daily at 9 AM CT. Scans all recovery facility accounts and:
//   1. Flips listingStatus → "trial_expired" when 30-day free trial ends
//   2. Sends a 7-day advance warning email to Moise + the operator
//   3. Sends an expiry notification when trial ends
//
// Trial clock starts at freeTrialStartedAt (ISO string) in providerUsers doc.
// Idempotent — checks current listingStatus before writing or emailing.
// ─────────────────────────────────────────────────────────────────────────────
export const checkRecoveryTrialExpiry = onSchedule(
  {
    schedule: "0 9 * * *",        // 9:00 AM daily
    timeZone: "America/Chicago",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async () => {
    const resend = new Resend(resendApiKey.value());
    const now    = Date.now();
    const FREE_TRIAL_MS   = 30 * 24 * 60 * 60 * 1000;  // 30 days
    const WARNING_MS      = 23 * 24 * 60 * 60 * 1000;  // warn at day 23 (7 days left)

    // Fetch all recovery facility accounts with an active free trial
    const snap = await db
      .collection("providerUsers")
      .where("role", "==", "recovery_facility")
      .where("listingStatus", "in", ["active_free", null])
      .get();

    if (snap.empty) {
      console.log("checkRecoveryTrialExpiry: no active_free recovery facilities found.");
      return;
    }

    const expired: string[]  = [];
    const warned: string[]   = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const facilityId  = data.facilityId as string | undefined;
      const rawStart    = data.freeTrialStartedAt;
      const email       = data.email as string | undefined;
      const facilityName = data.facilityName || facilityId || doc.id;

      // Can't calculate without a start date — skip
      if (!rawStart) continue;

      let startMs: number;
      if (typeof rawStart === "string") {
        startMs = new Date(rawStart).getTime();
      } else if (typeof rawStart?.toDate === "function") {
        startMs = rawStart.toDate().getTime();
      } else {
        continue;
      }
      if (isNaN(startMs)) continue;

      const elapsed     = now - startMs;
      const daysLeft    = Math.ceil((FREE_TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
      const trialEndDate = new Date(startMs + FREE_TRIAL_MS).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });

      // ── EXPIRED ────────────────────────────────────────────────────────────
      if (elapsed >= FREE_TRIAL_MS) {
        const batch = db.batch();
        batch.update(doc.ref, { listingStatus: "trial_expired" });
        if (facilityId) {
          batch.update(db.collection("recoveryHousing").doc(facilityId), { listingStatus: "trial_expired" });
        }
        await batch.commit();
        expired.push(`${facilityName} (${email || doc.id})`);
        console.log(`✅ Trial expired → ${facilityName}`);

        // Email the operator
        if (email) {
          await resend.emails.send({
            from: "Morava <noreply@moravacare.com>",
            to: email,
            subject: "Your Morava free listing trial has ended",
            html: wrapEmail("Listing Update", `
              <p>Hi ${esc(facilityName)},</p>
              <p>Your <strong>30-day free listing</strong> on Morava has ended.</p>
              <p>To keep your facility visible to patients and case managers searching for recovery housing,
              please reply to this email or contact us to activate your paid plan:</p>
              <p style="font-size:24px;font-weight:bold;color:#0d9488;margin:16px 0">$80 / month</p>
              <p>Flat rate — no per-referral fees, no commissions. One filled bed more than covers it.</p>
              <p><a href="mailto:support@moravacare.com?subject=Activate my listing - ${esc(facilityName)}"
                style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Contact us to activate →
              </a></p>
              <p style="color:#94A3B8;font-size:12px">Questions? Reply to this email or call (855) 812-6996, Mon–Fri 9am–5pm CT.</p>
            `),
          }).catch((e) => console.error(`Failed to email operator ${email}:`, e));
        }
        continue;
      }

      // ── 7-DAY WARNING (day 23–29, warn once by checking warningEmailSent) ──
      if (elapsed >= WARNING_MS && !data.warningEmailSent) {
        await doc.ref.update({ warningEmailSent: true });
        warned.push(`${facilityName} (${email || doc.id}) — ${daysLeft}d left`);
        console.log(`⏳ Trial warning → ${facilityName} (${daysLeft} days left)`);

        if (email) {
          await resend.emails.send({
            from: "Morava <noreply@moravacare.com>",
            to: email,
            subject: `Your Morava free listing ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
            html: wrapEmail("Listing Update", `
              <p>Hi ${esc(facilityName)},</p>
              <p>Your <strong>free listing</strong> on Morava ends on <strong>${trialEndDate}</strong>
              — that's <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"} from now</strong>.</p>
              <p>After that, continuing costs just <strong>$80/month</strong> — flat rate,
              no hidden fees, no per-referral charges.</p>
              <p>We'll reach out before anything is charged. No surprises, no automatic billing.</p>
              <p><a href="mailto:support@moravacare.com?subject=Questions about my listing - ${esc(facilityName)}"
                style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Questions? Contact us →
              </a></p>
            `),
          }).catch((e) => console.error(`Failed to email warning to ${email}:`, e));
        }
      }
    }

    // ── Admin summary email ────────────────────────────────────────────────
    if (expired.length > 0 || warned.length > 0) {
      await resend.emails.send({
        from: "Morava System <noreply@moravacare.com>",
        to: "moise@moravacare.com",
        subject: `Recovery trial check: ${expired.length} expired, ${warned.length} warned`,
        html: wrapEmail("Trial Expiry Report", `
          <p><strong>Daily recovery facility trial check complete.</strong></p>
          ${expired.length > 0 ? `
            <p style="color:#dc2626"><strong>🔴 Expired (${expired.length}):</strong></p>
            <ul>${expired.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
            <p>These facilities have been flipped to <code>trial_expired</code> and emailed.</p>
          ` : ""}
          ${warned.length > 0 ? `
            <p style="color:#d97706"><strong>⏳ 7-day warnings sent (${warned.length}):</strong></p>
            <ul>${warned.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
          ` : ""}
        `),
      }).catch((e) => console.error("Failed to send admin summary:", e));
    } else {
      console.log("checkRecoveryTrialExpiry: no expirations or warnings today.");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INTAKE REQUEST NOTIFICATION
// Fires when a patient submits an admission request through the patient app.
// PHI POLICY: We do NOT include patient name, phone, or any identifying info
// in the email — only the facility name, a count, and a link to the dashboard.
// The facility operator reads the full request securely inside the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export const onIntakeRequestCreated = onDocumentCreated(
  {
    document: "recoveryHousing/{facilityId}/intakeRequests/{reqId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const facilityId = event.params.facilityId;
    if (!facilityId) return;

    // ── Look up facility name + operator email ────────────────────────────────
    let facilityName = "your facility";
    let operatorEmail: string | null = null;

    try {
      const facilitySnap = await db.collection("recoveryHousing").doc(facilityId).get();
      if (facilitySnap.exists) {
        facilityName = (facilitySnap.data()?.facilityName as string) || facilityName;
      }

      // Operator email: try providerUsers.email first, then fall back to
      // Firebase Auth record via managedByUid (handles stale / placeholder emails)
      const puSnap = await db
        .collection("providerUsers")
        .where("facilityId", "==", facilityId)
        .limit(1)
        .get();
      if (!puSnap.empty) {
        const puData = puSnap.docs[0].data();
        const storedEmail = puData?.email as string | undefined;
        if (storedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedEmail)) {
          operatorEmail = storedEmail;
        }
        // Fallback: look up the Auth user record directly (always authoritative)
        if (!operatorEmail) {
          const uid = puSnap.docs[0].id;
          try {
            const authUser = await admin.auth().getUser(uid);
            if (authUser.email) operatorEmail = authUser.email;
          } catch { /* uid not in Auth — skip */ }
        }
      }
      // Second fallback: managedByUid on the recoveryHousing doc
      if (!operatorEmail) {
        const managedByUid = facilitySnap.exists
          ? (facilitySnap.data()?.managedByUid as string | undefined)
          : undefined;
        if (managedByUid) {
          try {
            const authUser = await admin.auth().getUser(managedByUid);
            if (authUser.email) operatorEmail = authUser.email;
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      console.error("onIntakeRequestCreated: lookup failed", err);
      return;
    }

    if (!operatorEmail) {
      console.log(`onIntakeRequestCreated: no operator email found for ${facilityId}`);
      return;
    }

    // ── PHI-free email to facility operator ───────────────────────────────────
    const resend = new Resend(resendApiKey.value());
    try {
      await resend.emails.send({
        from: "Morava <noreply@moravacare.com>",
        to: operatorEmail,
        subject: `New admission inquiry — ${esc(facilityName)}`,
        html: wrapEmail(
          "New Admission Inquiry",
          `
          <p style="margin:0 0 16px">
            Someone submitted an admission request for
            <strong>${esc(facilityName)}</strong> through the Morava patient app.
          </p>

          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:16px;margin-bottom:20px">
            <p style="margin:0 0 6px;color:#0f766e;font-weight:bold;font-size:15px">
              📋 Their information is waiting in your dashboard
            </p>
            <p style="margin:0;color:#134e4a;font-size:13px">
              Log in to review their contact details, sobriety timeline, and message.
              Then mark them as Contacted, Admitted, or Declined — right from the home screen.
            </p>
          </div>

          <a
            href="https://morava-dashboard.web.app/dashboard#intake-requests"
            style="display:inline-block;background:#0f766e;color:#fff;font-weight:bold;
                   padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px"
          >
            View Request in Dashboard →
          </a>

          <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
            This email contains no patient health information. Full request details are
            accessible only inside your secure dashboard.
          </p>
          `
        ),
      });
      console.log(`onIntakeRequestCreated: notified ${operatorEmail} for ${facilityId}`);
    } catch (err) {
      console.error("onIntakeRequestCreated: email send failed", err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INTAKE REQUEST STATUS CHANGE — notify the patient via push + email
// Fires when the facility operator updates the status field on an intakeRequest.
// PHI POLICY: push/email contain no clinical data — only the facility name
// and the status outcome. Patient reads full context in the app.
// ─────────────────────────────────────────────────────────────────────────────
export const onIntakeStatusChanged = onDocumentUpdated(
  {
    document: "recoveryHousing/{facilityId}/intakeRequests/{reqId}",
    database: "(default)",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    const oldStatus = before.status as string;
    const newStatus = after.status  as string;

    // Only fire when status actually changed
    if (oldStatus === newStatus) return;
    // Only notify on the three terminal/actionable transitions
    const notifiableStatuses = ["contacted", "admitted", "declined"];
    if (!notifiableStatuses.includes(newStatus)) return;

    const facilityId  = event.params.facilityId;
    const userId      = after.userId as string | undefined;

    // ── Look up facility name ─────────────────────────────────────────────────
    let facilityName = "the facility";
    try {
      const facilitySnap = await db.collection("recoveryHousing").doc(facilityId).get();
      if (facilitySnap.exists) {
        facilityName = (facilitySnap.data()?.facilityName as string) || facilityName;
      }
    } catch { /* non-critical */ }

    // ── Message copy by status ───────────────────────────────────────────────
    const messages: Record<string, { pushTitle: string; pushBody: string; emailSubject: string; emailBody: string }> = {
      contacted: {
        pushTitle: "📞 Facility is reaching out!",
        pushBody:  `${facilityName} has reviewed your request and will be calling you soon. Keep your phone nearby.`,
        emailSubject: `${facilityName} is reviewing your admission request`,
        emailBody: `
          <p>Great news — <strong>${esc(facilityName)}</strong> has reviewed your admission request
          and is preparing to reach out to you.</p>
          <p>Make sure your phone is available. They will call you at the number you provided.</p>
          <p style="color:#94A3B8;font-size:12px">
            If you no longer need housing, you don't need to do anything.
            They will follow up directly.
          </p>`,
      },
      admitted: {
        pushTitle: "🎉 Admission accepted!",
        pushBody:  `${facilityName} has accepted your request. They'll be in touch with move-in details.`,
        emailSubject: `You've been accepted at ${facilityName}`,
        emailBody: `
          <p>Congratulations — <strong>${esc(facilityName)}</strong> has <strong>accepted your admission request</strong>.</p>
          <p>A staff member will contact you soon with next steps and move-in details.</p>
          <p>This is a big step. We're rooting for you. 🌱</p>`,
      },
      declined: {
        pushTitle: "Update on your admission request",
        pushBody:  `${facilityName} couldn't accommodate your request right now. Other facilities may have availability.`,
        emailSubject: `Update on your request at ${facilityName}`,
        emailBody: `
          <p><strong>${esc(facilityName)}</strong> was unable to accommodate your admission request at this time.</p>
          <p>This may be due to bed availability or program fit — it's not a reflection of your journey.</p>
          <p>Open the Morava app to browse other recovery housing options in your area.
          There are other facilities that may be a great fit.</p>
          <p><a href="https://moravacare.com"
            style="display:inline-block;background:#0f766e;color:#fff;font-weight:bold;
                   padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px">
            Find Other Housing →
          </a></p>`,
      },
    };

    const msg = messages[newStatus];
    if (!msg) return;

    const resend = new Resend(resendApiKey.value());

    // ── Push notification to patient ─────────────────────────────────────────
    if (userId) {
      try {
        const userDoc  = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const pushToken = userData?.expoPushToken as string | undefined;

        if (pushToken?.startsWith("ExponentPushToken[")) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to:        pushToken,
              title:     msg.pushTitle,
              body:      msg.pushBody,
              sound:     "default",
              priority:  "high",
              channelId: "intake_requests",
              data: {
                type:       "intake_status_change",
                facilityId,
                status:     newStatus,
              },
            }),
          });
          console.log(`onIntakeStatusChanged: push sent to ${userId} (${newStatus})`);
        }

        // ── Email to patient if they have one on file ────────────────────────
        const patientEmail = userData?.email as string | undefined;
        if (patientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
          await resend.emails.send({
            from: "Morava <noreply@moravacare.com>",
            to:   patientEmail,
            subject: msg.emailSubject,
            html: wrapEmail("Admission Update", msg.emailBody),
          });
          console.log(`onIntakeStatusChanged: email sent to ${patientEmail} (${newStatus})`);
        }
      } catch (err) {
        console.error("onIntakeStatusChanged: notification failed", err);
      }
    }
  }
);

// ================================================================
// REP EMAIL VERIFICATION — OTP flow for moravacare.com/reps
// Reps are not Firebase Auth users; we verify their identity by
// sending a 6-digit code to the email on their repApplications doc.
//
// sendRepVerificationCode  — generates + emails the code (public callable)
// verifyRepCode            — validates the code, returns rep data (public callable)
//
// Security:
//   • Codes stored server-side only (repVerificationCodes — admin-read-only)
//   • 6-digit code, 15-minute expiry, max 5 attempts before lockout
//   • Rate-limited: 3 send requests per email per 10 minutes
//   • Code is single-use — deleted on successful verification
// ================================================================
export const sendRepVerificationCode = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    const { email } = request.data as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Valid email required.");
    }
    const normalizedEmail = email.trim().toLowerCase();

    // ── Rate limit: 3 sends per email per 10 min ──────────────────────────
    const window10min = Math.floor(Date.now() / (10 * 60 * 1000));
    const rlRef = db.collection("repOtpRateLimit").doc(`${normalizedEmail}_${window10min}`);
    const rlSnap = await rlRef.get();
    const rlCount = (rlSnap.data()?.count as number) ?? 0;
    if (rlCount >= 3) {
      throw new HttpsError("resource-exhausted", "Too many code requests. Please wait 10 minutes.");
    }
    rlRef.set({ count: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});

    // ── Check rep exists ───────────────────────────────────────────────────
    const repSnap = await db.collection("repApplications")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (repSnap.empty) {
      throw new HttpsError("not-found", "No rep account found for that email.");
    }

    // ── Generate 6-digit code ──────────────────────────────────────────────
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

    await db.collection("repVerificationCodes").doc(normalizedEmail).set({
      code,
      expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Send email via Resend ──────────────────────────────────────────────
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Morava <noreply@moravacare.com>",
      to: normalizedEmail,
      subject: "Your Morava rep verification code",
      html: wrapEmail("Rep Verification", `
        <p>Here is your verification code to access the Morava rep portal:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px 0;color:#0d9488;">
          ${code}
        </div>
        <p style="color:#64748b;font-size:13px;text-align:center;">
          This code expires in 15 minutes. Do not share it with anyone.
        </p>
      `),
    });

    console.log(`sendRepVerificationCode: code sent to ${normalizedEmail}`);
    return { success: true };
  }
);

export const verifyRepCode = onCall(
  {},
  async (request) => {
    const { email, code } = request.data as { email?: string; code?: string };
    if (!email || !code) {
      throw new HttpsError("invalid-argument", "Email and code required.");
    }
    const normalizedEmail = email.trim().toLowerCase();

    const codeRef = db.collection("repVerificationCodes").doc(normalizedEmail);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      throw new HttpsError("not-found", "No verification code found. Request a new one.");
    }

    const data = codeSnap.data()!;

    // ── Expiry check ───────────────────────────────────────────────────────
    if (Date.now() > (data.expiresAt as number)) {
      await codeRef.delete();
      throw new HttpsError("deadline-exceeded", "Code expired. Request a new one.");
    }

    // ── Attempt lockout ────────────────────────────────────────────────────
    const attempts = (data.attempts as number) ?? 0;
    if (attempts >= 5) {
      await codeRef.delete();
      throw new HttpsError("resource-exhausted", "Too many failed attempts. Request a new code.");
    }

    // ── Code check ─────────────────────────────────────────────────────────
    if (data.code !== code.trim()) {
      await codeRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      const remaining = 4 - attempts;
      throw new HttpsError("unauthenticated", `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }

    // ── Valid — delete code (single-use) and return rep data ───────────────
    await codeRef.delete();

    const repSnap = await db.collection("repApplications")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (repSnap.empty) {
      throw new HttpsError("not-found", "Rep account not found.");
    }

    const rep = repSnap.docs[0].data();
    console.log(`verifyRepCode: verified rep ${normalizedEmail}`);
    return {
      success: true,
      rep: {
        name:         rep.name        ?? "",
        email:        rep.email       ?? normalizedEmail,
        status:       rep.status      ?? "new",
        payment:      rep.paymentHandle ?? "",
        verifiedCount: rep.verifiedCount ?? 0,
      },
    };
  }
);

// ============================================================
// SERVER-SIDE BOOKING RATE LIMIT
// ============================================================
// Firestore onCreate trigger — fires immediately after a patient
// writes a new booking document. If they already have 5+ bookings
// created in the last 24 hours, the document is deleted server-side.
// This closes the gap where a client with a compromised token could
// bypass the client-side rate limit in rateLimit.ts.
//
// We delete rather than "reject" because Firestore security rules
// allow the create (correct — this is not a rules issue), but we
// enforce the business-logic limit post-write via this trigger.
// The UI will see the document briefly appear then disappear, but
// in practice the client-side guard fires first and prevents the
// write from ever being attempted by a legitimate app.
export const enforceBookingRateLimit = onDocumentCreated(
  "bookings/{bookingId}",
  async (event) => {
    const booking = event.data?.data();
    if (!booking) return;

    const userId    = booking.userId as string | undefined;
    const bookingId = event.params.bookingId;

    if (!userId) return; // anonymous / malformed — ignore

    const MAX_PER_DAY = 5;
    const windowStart = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    const windowStartTs = admin.firestore.Timestamp.fromMillis(windowStart);

    try {
      // Count bookings created by this user in the last 24 hours.
      // Includes the one just written (createdAt may not be set yet,
      // so we fall back to counting ALL pending docs created recently).
      const recentSnap = await db
        .collection("bookings")
        .where("userId", "==", userId)
        .where("createdAt", ">=", windowStartTs)
        .get();

      // recentSnap includes the just-written doc (createdAt set by serverTimestamp).
      // If there's a timing gap before serverTimestamp resolves, we count >= MAX_PER_DAY + 1.
      if (recentSnap.size > MAX_PER_DAY) {
        console.warn(
          `enforceBookingRateLimit: userId=${userId} exceeded ${MAX_PER_DAY} bookings/24h ` +
          `(count=${recentSnap.size}). Deleting booking ${bookingId}.`
        );
        await db.collection("bookings").doc(bookingId).delete();

        // Write an audit entry so the admin can see rate-limit violations
        await db.collection("auditLog").add({
          action:           "suspicious_activity",
          actorUid:         userId,
          actorType:        "system",
          targetId:         bookingId,
          targetCollection: "bookings",
          metadata: {
            reason:    "server_rate_limit_exceeded",
            count:     recentSnap.size,
            maxPerDay: MAX_PER_DAY,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      // Non-fatal — log and continue; do not delete on error to avoid
      // legitimate bookings being removed due to a transient failure
      console.error("enforceBookingRateLimit error:", err);
    }
  }
);

// ============================================================
// PHONE NUMBER UNIQUENESS CHECK
// ============================================================
// Callable function — client calls this before saving a phone number
// to the user profile. The Admin SDK can query across all user docs,
// which the client cannot do (Firestore rules restrict users to
// reading only their own document).
//
// Returns { available: true } if the phone is not in use,
// or throws ALREADY_EXISTS if another account has this number.
//
// Rate-limited to prevent enumeration: max 10 checks per UID per hour.
export const checkPhoneAvailability = onCall(
  { enforceAppCheck: false }, // App Check enforced at Firestore layer
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { phone } = request.data as { phone?: string };
    if (!phone || typeof phone !== "string") {
      throw new HttpsError("invalid-argument", "phone is required.");
    }

    // Normalize: digits only
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10 || normalized.length > 15) {
      throw new HttpsError("invalid-argument", "Invalid phone number format.");
    }

    const callerUid = request.auth.uid;

    // ── Rate limit: max 10 checks per caller per hour ─────────────────────
    const rateLimitRef = db
      .collection("phoneCheckRateLimit")
      .doc(callerUid);

    const hourAgo = Date.now() - 60 * 60 * 1000;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateLimitRef);
      const timestamps: number[] = snap.exists
        ? ((snap.data()!.timestamps as number[]) ?? []).filter(t => t > hourAgo)
        : [];

      if (timestamps.length >= 10) {
        throw new HttpsError(
          "resource-exhausted",
          "Too many phone checks. Please try again later."
        );
      }

      timestamps.push(Date.now());
      tx.set(rateLimitRef, { timestamps }, { merge: true });
    });

    // ── Check for existing account with this phone number ─────────────────
    const existing = await db
      .collection("users")
      .where("phone", "==", normalized)
      .limit(2) // get up to 2 — if caller is the only one it's fine
      .get();

    // Filter out the caller's own document
    const others = existing.docs.filter(d => d.id !== callerUid);

    if (others.length > 0) {
      throw new HttpsError(
        "already-exists",
        "This phone number is already linked to another account. Please sign in to that account or use a different number."
      );
    }

    return { available: true };
  }
);
