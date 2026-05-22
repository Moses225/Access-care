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
const twilioAuthToken    = defineSecret("TWILIO_AUTH_TOKEN");
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
    if (
      !["confirmed", "cancelled", "reschedule_pending"].includes(after.status)
    )
      return;
    if (!after.userId) return;

    // Patient declined a reschedule and kept their original time.
    // The status reverts to 'confirmed' but the patient already knows —
    // they made the choice. Sending "Your appointment is confirmed!" is
    // confusing, so we skip all notifications for this transition.
    const isRescheduleDecline =
      before.status === "reschedule_pending" &&
      after.status === "confirmed" &&
      !before.rescheduleDeclinedAt &&
      !!after.rescheduleDeclinedAt;
    if (isRescheduleDecline) return;

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
        const cid = pd.stripeCustomerId as string | undefined;
        const pmid = pd.stripePaymentMethodId as string | undefined;
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
// SECURITY:
//   - Requires authenticated Firebase user (auth context enforced)
//   - Verifies caller's providerId matches their custom claim
//   - Never logs or returns full card details
//   - Idempotent: reuses existing Stripe customer if present
// ================================================================
export const createSetupIntent = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    enforceAppCheck: true,
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

    if (!providerId) {
      throw new HttpsError("invalid-argument", "providerId is required.");
    }

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

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2026-04-22.dahlia" as any,
    });

    // Fetch provider document to get name/email and check for existing customer
    const provSnap = await db.collection("providers").doc(providerId).get();
    if (!provSnap.exists) {
      throw new HttpsError("not-found", "Provider not found.");
    }

    const provData = provSnap.data()!;
    let stripeCustomerId = provData.stripeCustomerId as string | undefined;

    // Reuse existing Stripe customer or create new one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: provData.email || "",
        name: provData.name || providerId,
        metadata: { providerId, firebaseUid: callerUid },
      });
      stripeCustomerId = customer.id;

      // Save customer ID immediately — prevents duplicate customers on retry
      await db.collection("providers").doc(providerId).update({
        stripeCustomerId,
      });
    }

    // Create Setup Intent — captures card without charging
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session", // required for automated monthly billing
      metadata: {
        providerId,
        firebaseUid: callerUid,
      },
    });

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
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
      const payload = raw ?? Buffer.from(JSON.stringify(req.body));
      event = stripe.webhooks.constructEvent(
        payload,
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
      const paymentMethodId = setupIntent.payment_method;

      if (providerId && paymentMethodId) {
        try {
          await db.collection("providers").doc(providerId).update({
            stripePaymentMethodId: paymentMethodId,
            billingSetupAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          // Sync to providerUsers for App Check timing fix on dashboard
          const puSnap = await db
            .collection("providerUsers")
            .where("providerId", "==", providerId)
            .limit(1)
            .get();
          if (puSnap.empty === false) {
            await puSnap.docs[0].ref.update({
              stripePaymentMethodId: paymentMethodId,
            });
          }
          console.log(
            `stripeWebhook: saved payment method ${paymentMethodId} for provider ${providerId}`,
          );
        } catch (err) {
          console.error("stripeWebhook: failed to save payment method:", err);
          res.status(500).send("Database update failed");
          return;
        }
      }
    }

    res.status(200).json({ received: true });
  },
);

// ================================================================
// MANUAL BILLING REQUEST — notify Moise when provider requests check/ACH
// ================================================================
export const onManualBillingRequest = onDocumentUpdated(
  {
    document: "providers/{providerId}",
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
    console.log("onManualBillingRequest: sending alert email");
    const resend = new Resend(resendApiKey.value());
    await resend.emails.send({
      from: "Morava <noreply@moravacare.com>",
      to: "moise@moravacare.com",
      subject: `Manual billing requested — ${esc(after.name) || event.params.providerId}`,
      html: wrapEmail(
        "Manual Billing Request",
        `
        <p><strong>${esc(after.name) || event.params.providerId}</strong> has requested manual billing (check or ACH).</p>
        <p><strong>Email:</strong> ${esc(after.email) || esc(after.contactEmail) || "See providerUsers collection"}</p>
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
    });

    // Create providerUsers document if it doesn't exist
    const puRef = db.collection("providerUsers").doc(uid);
    const puSnap = await puRef.get();
    if (!puSnap.exists) {
      await puRef.set({
        uid,
        providerId,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Generate password setup link — works as first-time password set
    const setupLink = await admin.auth().generatePasswordResetLink(email, {
      url: "https://dashboard.moravacare.com/login",
    });

    // Send welcome email with setup link
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
            <li>Add your billing card (you only pay $6 when a patient shows up)</li>
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
  { secrets: [twilioAccountSid, twilioAuthToken, twilioFromNumber] },
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
    const sid   = twilioAccountSid.value();
    const token = twilioAuthToken.value();
    const from  = twilioFromNumber.value();

    const sanitized = to.replace(/[^\d+]/g, "");
    const e164 = sanitized.startsWith("+") ? sanitized : `+1${sanitized}`;
    if (e164.length < 12) throw new HttpsError("invalid-argument", "Invalid phone number");

    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
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
    secrets: [twilioAccountSid, twilioAuthToken, twilioFromNumber] },
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

    const sid   = twilioAccountSid.value();
    const token = twilioAuthToken.value();
    const from  = twilioFromNumber.value();
    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

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
