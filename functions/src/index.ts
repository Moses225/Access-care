import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Resend } from "resend";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();

const resendApiKey = defineSecret("RESEND_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

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
        subject: `New booking request — ${esc(data.patientName)}`,
        html: wrapEmail(
          "New Appointment Request",
          `
          <h2 style="color:#0F172A;margin:0 0 16px">New booking request</h2>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
            <p style="margin:0 0 8px;color:#475569"><strong>Patient:</strong> ${esc(data.patientName)}</p>
            <p style="margin:0 0 8px;color:#475569"><strong>Date:</strong> ${esc(data.date)}</p>
            <p style="margin:0 0 8px;color:#475569"><strong>Time:</strong> ${esc(data.time)}</p>
            <p style="margin:0;color:#475569"><strong>Visit Type:</strong> ${esc(data.visitTypeLabel) || "Not specified"}</p>
          </div>
          <p style="color:#64748B;font-size:13px;margin-bottom:20px">Log in to view the complete patient health summary and confirm or decline.</p>
          <a href="https://dashboard.moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;font-size:16px">
            Review &amp; Confirm &rarr;
          </a>
        `,
        ),
      });
    } catch (err) {
      console.error("onBookingCreated: email send failed", err);
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
    const providerName = esc(after.providerName || "Your provider");
    const date = esc(after.date || "");
    const time = esc(after.time || "");
    let subject = "",
      bodyHtml = "";
    if (after.status === "confirmed") {
      subject = `Appointment confirmed — ${date} at ${time}`;
      bodyHtml = `
        <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#166534">Your appointment is confirmed!</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> confirmed your appointment for ${date} at ${time}.</p>
        <p style="color:#475569">Please arrive 10 minutes early with your ID and insurance card.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View in Morava App &rarr;</a>
      `;
    } else if (after.status === "cancelled") {
      const reason =
        after.cancelledBy !== "patient"
          ? esc(after.declineReason || "")
          : esc(after.patientCancelReason || "");
      subject = `Appointment update — ${date}`;
      bodyHtml = `
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#991B1B">Appointment cancelled</strong>
        </div>
        <p style="color:#475569">Your appointment with <strong>${providerName}</strong> on ${date} at ${time} has been cancelled.</p>
        ${reason ? `<p style="color:#475569"><strong>Reason:</strong> ${reason}</p>` : ""}
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Find Another Provider &rarr;</a>
      `;
    } else {
      const pd = esc(after.proposedDate || ""),
        pt = esc(after.proposedTime || "");
      subject = `Reschedule proposed — ${providerName}`;
      bodyHtml = `
        <div style="background:#FAF5FF;border-left:4px solid #A855F7;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#7E22CE">New time proposed</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> has proposed rescheduling.</p>
        <p style="color:#475569"><strong>Original:</strong> ${date} at ${time}<br/><strong>Proposed:</strong> ${pd} at ${pt}</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Respond in Morava App &rarr;</a>
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
        let rate = 10; // standard rate
        if (pd.foundingProvider === true && pd.foundingProviderSince) {
          const since = pd.foundingProviderSince.toDate
            ? pd.foundingProviderSince.toDate()
            : new Date(pd.foundingProviderSince);
          const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
          if (Date.now() - since.getTime() < twoYearsMs) {
            rate = 6; // still in founding period
          }
        } else if (!pd.foundingProvider) {
          rate = 10; // standard
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
                <p style="margin:0 0 8px;color:#475569"><strong>Rate:</strong> $${rate}/visit${pd.foundingProvider ? " (Founding Provider — locked for life)" : ""}</p>
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
