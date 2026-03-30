import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';

const resendApiKey = defineSecret('RESEND_API_KEY');

// ================================================================
// PROVIDER APPLICATION — notify you + confirm to provider
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

    // ── Notify you ──────────────────────────────────────────────
    await resend.emails.send({
      from: 'Morava <onboarding@resend.dev>',
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

    // ── Confirm to provider ─────────────────────────────────────
    if (data.email) {
      await resend.emails.send({
        from: 'Morava Care <onboarding@resend.dev>',
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
                <a href="mailto:moise@moravacare.com" style="color:#14B8A6">moise@moravacare.com</a>
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
// WAITLIST WELCOME EMAIL — fires when someone joins the waitlist
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

    // Basic email validation before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) return;

    const resend = new Resend(resendApiKey.value());

    // ── Welcome email to new subscriber ────────────────────────
    await resend.emails.send({
      from: 'Moise at Morava <onboarding@resend.dev>',
      to: data.email,
      subject: 'You\'re on the Morava list 🎉',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#14B8A6,#0ea5e9);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:#fff;margin:0 0 8px;font-size:28px">You're on the list!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px">Welcome to Morava — Oklahoma's free healthcare app</p>
          </div>
          <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0">
            <p style="color:#0f172a;font-size:16px;line-height:1.7">
              Hi there 👋
            </p>
            <p style="color:#475569;line-height:1.7">
              Thanks for joining the Morava waitlist. We're building Oklahoma's first free healthcare discovery and booking app — specifically for patients on SoonerCare, Medicaid, and most insurance plans.
            </p>
            <p style="color:#475569;line-height:1.7">
              <strong style="color:#0f172a">What Morava does:</strong><br/>
              Search 199+ Oklahoma providers, filter by your insurance, and book appointments — completely free, no hidden fees, ever.
            </p>

            <div style="background:#f0fdfb;border:1px solid #ccfbf1;border-radius:12px;padding:20px;margin:24px 0">
              <p style="color:#0f172a;font-weight:bold;margin:0 0 12px">📱 Already on Android?</p>
              <p style="color:#475569;margin:0 0 16px;font-size:14px">The app is available now on Google Play. Search "Morava" or visit:</p>
              <a href="https://moravacare.com"
                 style="background:#14B8A6;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">
                Find a Doctor Now →
              </a>
            </div>

            <p style="color:#475569;line-height:1.7">
              We'll email you when:
            </p>
            <ul style="color:#475569;line-height:1.8;padding-left:20px">
              <li>New providers join in your area</li>
              <li>The iOS app launches</li>
              <li>New features go live (recovery housing, telehealth, and more)</li>
            </ul>

            <p style="color:#475569;line-height:1.7;margin-top:24px">
              Built with ❤️ in Oklahoma City,<br/>
              <strong style="color:#0f172a">Moise Kouassi</strong><br/>
              Founder, Morava Care LLC
            </p>
          </div>
          <div style="padding:16px 24px;text-align:center">
            <p style="color:#94a3b8;font-size:12px;margin:0">
              Morava Care LLC · Oklahoma City, OK ·
              <a href="https://moravacare.com" style="color:#14B8A6;text-decoration:none">moravacare.com</a>
              <br/>To unsubscribe, reply with UNSUBSCRIBE.
            </p>
          </div>
        </div>
      `,
    });

    // ── Notify you of new signup ────────────────────────────────
    await resend.emails.send({
      from: 'Morava <onboarding@resend.dev>',
      to: 'moise@moravacare.com',
      subject: `New waitlist signup: ${data.email}`,
      html: `
        <p><strong>New waitlist signup:</strong> ${data.email}</p>
        <p><strong>Source:</strong> ${data.source || 'moravacare.com'}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})}</p>
        <p><a href="https://console.firebase.google.com/project/accesscare-app/firestore/data/waitlist">View all signups →</a></p>
      `,
    });
  }
);
