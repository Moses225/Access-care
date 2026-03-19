import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';

const resendApiKey = defineSecret('RESEND_API_KEY');

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

    // ── Email to you ────────────────────────────────────────────
    await resend.emails.send({
      from: 'AccessCare <onboarding@resend.dev>',
      to: 'moisestephanekouassi@gmail.com',
      subject: `New Provider Application — ${data.name}`,
      html: `
        <h2>New Provider Application</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Practice:</strong> ${data.practice}</p>
        <p><strong>Specialty:</strong> ${data.specialty}</p>
        <p><strong>NPI:</strong> ${data.npi || 'Not provided'}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Message:</strong> ${data.message || 'None'}</p>
        <br/>
        <a href="https://console.firebase.google.com/project/accesscare-app/firestore/data/providerApplications">
          View in Firebase Console
        </a>
      `,
    });

    // ── Confirmation email to provider ──────────────────────────
    await resend.emails.send({
      from: 'AccessCare <onboarding@resend.dev>',
      to: "moisestephanekouassi@gmail.com",
      subject: 'We received your AccessCare provider application',
      html: `
        <h2>Thank you, ${data.name}!</h2>
        <p>We've received your application to join AccessCare as a verified provider.</p>
        <p>Here's what happens next:</p>
        <ol>
          <li>We'll verify your NPI number (usually within 24 hours)</li>
          <li>You'll receive a login link to access your provider dashboard</li>
          <li>Your profile will be marked as verified for patients to see</li>
        </ol>
        <p>If you have any questions, reply to this email or contact us at 
        <a href="mailto:moisestephanekouassi@gmail.com">moisestephanekouassi@gmail.com</a>.</p>
        <br/>
        <p>— The AccessCare Team</p>
      `,
    });
  }
);
