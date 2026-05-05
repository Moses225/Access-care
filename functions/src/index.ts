import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

admin.initializeApp();
const db = admin.firestore();

const resendApiKey  = defineSecret('RESEND_API_KEY');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// ================================================================
// PROVIDER APPLICATION — notify Moise + confirm to provider
// ================================================================
export const onProviderApplication = onDocumentCreated(
  {
    document: 'providerApplications/{docId}',
    database: '(default)',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const resend = new Resend(resendApiKey.value());

    await resend.emails.send({
      from: 'Morava <noreply@moravacare.com>',
      to: 'moise@moravacare.com',
      subject: `New Provider Application — ${data.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#14B8A6;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:22px">New Provider Application</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Practice:</strong> ${data.practice || 'Not provided'}</p>
            <p><strong>Specialty:</strong> ${data.specialty || 'Not provided'}</p>
            <p><strong>NPI:</strong> ${data.npi || 'Not provided'}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
            <p><strong>Message:</strong> ${data.message || 'None'}</p>
            <br/>
            <a href="https://console.firebase.google.com/project/accesscare-app/firestore/data/providerApplications"
               style="background:#14B8A6;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:bold">
              View in Firebase Console →
            </a>
          </div>
        </div>
      `,
    });

    if (data.email) {
      await resend.emails.send({
        from: 'Morava Care <noreply@moravacare.com>',
        to: data.email,
        subject: 'We received your Morava provider application',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#14B8A6;padding:24px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;margin:0;font-size:22px">Thank you, ${data.name}!</h1>
            </div>
            <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
              <p style="color:#475569">We've received your application to join Morava as a verified provider.</p>
              <p style="color:#475569"><strong>What happens next:</strong></p>
              <ol style="color:#475569;line-height:1.8">
                <li>We'll review your information within 24 hours</li>
                <li>You'll receive a login link to your provider dashboard</li>
                <li>Your profile will be marked as verified for patients to see</li>
                <li>Oklahoma SoonerCare patients can start booking with you</li>
              </ol>
              <p style="color:#475569">Questions? Reply to this email or reach us at
                <a href="mailto:support@moravacare.com" style="color:#14B8A6">support@moravacare.com</a>
              </p>
              <br/>
              <p style="color:#94a3b8;font-size:13px">— Moise Kouassi, Founder · Morava Care LLC · Oklahoma City, OK</p>
            </div>
          </div>
        `,
      });
    }
  }
);

// ================================================================
// WAITLIST WELCOME EMAIL
// ================================================================
export const onWaitlistSignup = onDocumentCreated(
  {
    document: 'waitlist/{docId}',
    database: '(default)',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) return;

    const resend = new Resend(resendApiKey.value());

    await resend.emails.send({
      from: 'Moise at Morava <noreply@moravacare.com>',
      to: data.email,
      subject: "You're on the Morava list 🎉",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#14B8A6,#0ea5e9);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:#fff;margin:0 0 8px;font-size:28px">You're on the list!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px">Welcome to Morava — Oklahoma's free healthcare app</p>
          </div>
          <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0">
            <p style="color:#0f172a;font-size:16px;line-height:1.7">Hi there 👋</p>
            <p style="color:#475569;line-height:1.7">
              Thanks for joining the Morava waitlist. We're building Oklahoma's first free healthcare
              discovery and booking app — specifically for patients on SoonerCare, Medicaid, and most insurance plans.
            </p>
            <div style="background:#f0fdfb;border:1px solid #ccfbf1;border-radius:12px;padding:20px;margin:24px 0">
              <p style="color:#0f172a;font-weight:bold;margin:0 0 12px">📱 Available now on iOS + Android</p>
              <a href="https://moravacare.com"
                 style="background:#14B8A6;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">
                Find a Doctor Now →
              </a>
            </div>
            <p style="color:#475569;line-height:1.7;margin-top:24px">
              Built with ❤️ in Oklahoma City,<br/>
              <strong style="color:#0f172a">Moise Kouassi</strong><br/>
              Founder, Morava Care LLC
            </p>
          </div>
        </div>
      `,
    });

    await resend.emails.send({
      from: 'Morava <noreply@moravacare.com>',
      to: 'moise@moravacare.com',
      subject: `New waitlist signup: ${data.email}`,
      html: `<p><strong>New waitlist signup:</strong> ${data.email}</p>
             <p><strong>Source:</strong> ${data.source || 'moravacare.com'}</p>
             <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})}</p>`,
    });
  }
);

// ================================================================
// BOOKING CREATED — email provider immediately
// ================================================================
export const onBookingCreated = onDocumentCreated(
  {
    document: 'bookings/{bookingId}',
    database: '(default)',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'pending') return;

    const resend = new Resend(resendApiKey.value());

    // Get provider email from providerUsers
    let providerEmail: string | null = null;
    try {
      const provSnap = await db
        .collection('providerUsers')
        .where('providerId', '==', data.providerId)
        .limit(1)
        .get();
      if (!provSnap.empty) {
        providerEmail = provSnap.docs[0].data().email || null;
      }
    } catch {
      // non-critical
    }

    if (!providerEmail) return;

    const intake = data.patientIntakeSummary;
    const allergies = intake?.allergies
      ? (Array.isArray(intake.allergies) ? intake.allergies.join(', ') : intake.allergies)
      : null;

    await resend.emails.send({
      from: 'Morava <noreply@moravacare.com>',
      to: providerEmail,
      subject: `New booking request — ${data.patientName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#0F172A;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
            <div style="background:#14B8A6;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center">
              <span style="color:#fff;font-weight:bold;font-size:16px">M</span>
            </div>
            <div>
              <div style="color:#fff;font-size:18px;font-weight:bold">Morava</div>
              <div style="color:#94A3B8;font-size:12px">New Appointment Request</div>
            </div>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0">
            <h2 style="color:#0F172A;margin:0 0 16px">New booking request</h2>

            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
              <p style="margin:0 0 8px"><strong>Patient:</strong> ${data.patientName}</p>
              <p style="margin:0 0 8px"><strong>Phone:</strong> ${data.patientPhone || 'Not provided'}</p>
              <p style="margin:0 0 8px"><strong>Date:</strong> ${data.date}</p>
              <p style="margin:0 0 8px"><strong>Time:</strong> ${data.time}</p>
              <p style="margin:0 0 8px"><strong>Visit Type:</strong> ${data.visitTypeLabel || 'Not specified'}</p>
              ${data.serviceCategoryLabel ? `<p style="margin:0 0 8px"><strong>Service:</strong> ${data.serviceCategoryLabel}</p>` : ''}
              <p style="margin:0"><strong>Reason:</strong> ${data.reasonForVisit || 'Not provided'}</p>
            </div>

            ${allergies && allergies !== 'No known allergies' ? `
            <div style="background:#FEF2F2;border:1px solid #EF4444;border-left:4px solid #EF4444;border-radius:8px;padding:12px;margin-bottom:16px">
              <strong style="color:#991B1B">⚠ Allergies: ${allergies}</strong>
            </div>` : ''}

            <a href="https://dashboard.moravacare.com"
               style="display:block;background:#14B8A6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;font-size:16px">
              Confirm or Decline →
            </a>
            <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:12px">
              Log in at dashboard.moravacare.com · Morava Care LLC
            </p>
          </div>
        </div>
      `,
    });
  }
);

// ================================================================
// BOOKING STATUS CHANGED — notify patient on confirm/decline/reschedule
// ================================================================
export const onBookingStatusChanged = onDocumentUpdated(
  {
    document: 'bookings/{bookingId}',
    database: '(default)',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!before || !after) return;

    const oldStatus = before.status;
    const newStatus = after.status;
    if (oldStatus === newStatus) return;

    // Get patient email
    let patientEmail: string | null = null;
    try {
      const userSnap = await db.collection('users').doc(after.userId).get();
      if (userSnap.exists) {
        patientEmail = userSnap.data()?.email || null;
      }
    } catch {
      // non-critical
    }

    if (!patientEmail) return;

    const resend = new Resend(resendApiKey.value());
    const providerName = after.providerName || 'Your provider';
    const date = after.date;
    const time = after.time;

    let subject = '';
    let bodyHtml = '';

    if (newStatus === 'confirmed') {
      subject = `✅ Appointment confirmed — ${date} at ${time}`;
      bodyHtml = `
        <div style="background:#F0FDF4;border:1px solid #22C55E;border-left:4px solid #22C55E;border-radius:10px;padding:16px;margin-bottom:16px">
          <strong style="color:#166534;font-size:16px">Your appointment is confirmed!</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> has confirmed your appointment.</p>
        <p style="color:#475569"><strong>Date:</strong> ${date}<br/><strong>Time:</strong> ${time}</p>
        <p style="color:#475569">Please arrive 10 minutes early.</p>
      `;
    } else if (newStatus === 'cancelled') {
      const reason = after.declineReason || after.patientCancelReason || '';
      subject = `Appointment update — ${date}`;
      bodyHtml = `
        <div style="background:#FEF2F2;border:1px solid #EF4444;border-left:4px solid #EF4444;border-radius:10px;padding:16px;margin-bottom:16px">
          <strong style="color:#991B1B;font-size:16px">Appointment cancelled</strong>
        </div>
        <p style="color:#475569">Your appointment with <strong>${providerName}</strong> on ${date} at ${time} has been cancelled.</p>
        ${reason ? `<p style="color:#475569"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="color:#475569">You can rebook anytime in the Morava app.</p>
      `;
    } else if (newStatus === 'reschedule_pending') {
      const proposedDate = after.proposedDate || '';
      const proposedTime = after.proposedTime || '';
      subject = `⟳ Reschedule proposed — ${providerName}`;
      bodyHtml = `
        <div style="background:#FAF5FF;border:1px solid #A855F7;border-left:4px solid #A855F7;border-radius:10px;padding:16px;margin-bottom:16px">
          <strong style="color:#7E22CE;font-size:16px">Your provider proposed a new time</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> has proposed rescheduling your appointment.</p>
        <p style="color:#475569">
          <strong>Original:</strong> ${date} at ${time}<br/>
          <strong>Proposed:</strong> ${proposedDate} at ${proposedTime}
        </p>
        <p style="color:#475569">Open the Morava app to accept or decline the new time.</p>
      `;
    } else {
      return; // no email for other transitions
    }

    const wrapEmail = (body: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0F172A;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#fff;font-size:18px;font-weight:bold">Morava</span>
          <span style="color:#94A3B8;font-size:13px;margin-left:8px">Appointment Update</span>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
          ${body}
          <a href="https://moravacare.com"
             style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:20px">
            Open Morava App →
          </a>
          <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:12px">
            Morava Care LLC · Oklahoma City, OK · support@moravacare.com
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: 'Morava <noreply@moravacare.com>',
      to: patientEmail,
      subject,
      html: wrapEmail(bodyHtml),
    });
  }
);

// ================================================================
// NIGHTLY AUTO-COMPLETE — marks past confirmed bookings as completed
// Runs every day at midnight Central time
// ================================================================
export const nightlyAutoComplete = onSchedule(
  {
    schedule: '0 5 * * *', // midnight CST = 5am UTC
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    const today = new Date().toISOString().split('T')[0];

    const snap = await db
      .collection('bookings')
      .where('status', '==', 'confirmed')
      .where('date', '<', today)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: 'system',
        billable: true,
      });
    });

    await batch.commit();
    console.log(`Auto-completed ${snap.docs.length} bookings for dates before ${today}`);
  }
);

// ================================================================
// MONTHLY BILLING — charges providers via Stripe on the 1st
// Runs on the 1st of each month at 8am Central
// ================================================================
export const monthlyBilling = onSchedule(
  {
    schedule: '0 13 1 * *', // 8am CST on the 1st = 1pm UTC
    timeZone: 'America/Chicago',
    region: 'us-central1',
    secrets: [stripeSecretKey, resendApiKey],
  },
  async () => {
    // Dynamically import stripe to avoid issues if key not yet set
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2026-04-22.dahlia' });
    const resend = new Resend(resendApiKey.value());

    // Find the billing window: first day of last month to first day of this month
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startDate = firstOfLastMonth.toISOString().split('T')[0];
    const endDate   = firstOfThisMonth.toISOString().split('T')[0];

    // Get all completed, billable bookings in the window
    const snap = await db
      .collection('bookings')
      .where('status', '==', 'completed')
      .where('billable', '==', true)
      .where('date', '>=', startDate)
      .where('date', '<', endDate)
      .get();

    if (snap.empty) {
      console.log('No billable bookings this month.');
      return;
    }

    // Group by providerId
    const byProvider: Record<string, { count: number; bookingIds: string[] }> = {};
    snap.docs.forEach((d) => {
      const pid = d.data().providerId;
      if (!pid) return;
      if (!byProvider[pid]) byProvider[pid] = { count: 0, bookingIds: [] };
      byProvider[pid].count++;
      byProvider[pid].bookingIds.push(d.id);
    });

    // For each provider: get their Stripe customer ID and charge them
    for (const [providerId, info] of Object.entries(byProvider)) {
      try {
        // Get provider document to find Stripe customer ID and founding rate
        const provSnap = await db.collection('providers').doc(providerId).get();
        if (!provSnap.exists) continue;

        const provData = provSnap.data()!;
        const stripeCustomerId: string | undefined = provData.stripeCustomerId;
        if (!stripeCustomerId) {
          // No card on file — log and skip (notify Moise)
          console.warn(`Provider ${providerId} has no Stripe customer ID — skipping`);
          await resend.emails.send({
            from: 'Morava Billing <noreply@moravacare.com>',
            to: 'moise@moravacare.com',
            subject: `⚠ Billing skipped — no card on file: ${provData.name || providerId}`,
            html: `<p>${provData.name || providerId} has ${info.count} completed visits but no card on file. Manual follow-up required.</p>`,
          });
          continue;
        }

        // Founding providers pay $6, standard pay $8
        const ratePerVisit = provData.foundingProvider === true ? 6 : 8;
        const amountCents  = info.count * ratePerVisit * 100;

        // Charge via Stripe
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: 'usd',
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          confirm: true,
          off_session: true,
          description: `Morava — ${info.count} completed visits (${startDate} to ${endDate})`,
          metadata: {
            providerId,
            visitCount: info.count.toString(),
            period: `${startDate} to ${endDate}`,
            bookingIds: info.bookingIds.slice(0, 10).join(','), // Stripe metadata limit
          },
        });

        console.log(`Charged ${providerId}: $${amountCents / 100} (${info.count} visits) — ${paymentIntent.id}`);

        // Mark bookings as invoiced
        const batch = db.batch();
        info.bookingIds.forEach((bid) => {
          batch.update(db.collection('bookings').doc(bid), {
            invoiced: true,
            invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripePaymentIntentId: paymentIntent.id,
          });
        });
        await batch.commit();

        // Send receipt email to provider
        const providerUsersSnap = await db
          .collection('providerUsers')
          .where('providerId', '==', providerId)
          .limit(1)
          .get();
        const providerEmail = providerUsersSnap.empty
          ? null
          : providerUsersSnap.docs[0].data().email;

        if (providerEmail) {
          await resend.emails.send({
            from: 'Morava Billing <noreply@moravacare.com>',
            to: providerEmail,
            subject: `Morava — Monthly billing receipt — $${(amountCents / 100).toFixed(2)}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#0F172A;padding:20px 24px;border-radius:12px 12px 0 0">
                  <span style="color:#fff;font-size:18px;font-weight:bold">Morava</span>
                  <span style="color:#94A3B8;font-size:13px;margin-left:8px">Monthly Billing Receipt</span>
                </div>
                <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
                  <h2 style="color:#0F172A;margin:0 0 16px">Receipt — ${new Date().toLocaleDateString('en-US', {month:'long', year:'numeric'})}</h2>
                  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
                    <p style="margin:0 0 8px;color:#475569"><strong>Period:</strong> ${startDate} to ${endDate}</p>
                    <p style="margin:0 0 8px;color:#475569"><strong>Completed visits:</strong> ${info.count}</p>
                    <p style="margin:0 0 8px;color:#475569"><strong>Rate:</strong> $${ratePerVisit}/visit ${provData.foundingProvider ? '(Founding Provider rate — locked for life)' : ''}</p>
                    <p style="margin:0;color:#0F172A;font-size:18px;font-weight:bold">Total charged: $${(amountCents / 100).toFixed(2)}</p>
                  </div>
                  <p style="color:#64748B;font-size:12px">Questions? Reply to this email or contact support@moravacare.com</p>
                </div>
              </div>
            `,
          });
        }
      } catch (err) {
        console.error(`Billing error for ${providerId}:`, err);
        await resend.emails.send({
          from: 'Morava Billing <noreply@moravacare.com>',
          to: 'moise@moravacare.com',
          subject: `⚠ Billing failed for provider: ${providerId}`,
          html: `<p>Billing failed for provider <strong>${providerId}</strong>. Error: ${(err as Error).message}</p>`,
        });
      }
    }

    console.log('Monthly billing run complete.');
  }
);
