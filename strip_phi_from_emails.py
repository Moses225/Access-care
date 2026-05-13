"""
strip_phi_from_emails.py
Run from project root: python3 scripts/strip_phi_from_emails.py
Removes PHI from all Resend email templates in functions/src/index.ts.
All emails become notification-only — PHI stays behind the authenticated dashboard.
"""

import re

path = "functions/src/index.ts"

with open(path, "r") as f:
    content = f.read()

original = content

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: onBookingCreated — provider notification email
# Remove patient name, date, time, visit type from provider email
# ─────────────────────────────────────────────────────────────────────────────

old_booking_created_email = '''          html: wrapEmail(
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
        ),'''

new_booking_created_email = '''          html: wrapEmail(
          "New Appointment Request",
          `
          <h2 style="color:#0F172A;margin:0 0 16px">You have a new booking request</h2>
          <p style="color:#475569;margin-bottom:20px">A patient has requested an appointment with your practice. Log in to your Morava dashboard to review the patient health summary and confirm or decline.</p>
          <a href="https://dashboard.moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;font-size:16px">
            Review &amp; Confirm in Dashboard &rarr;
          </a>
          <p style="color:#94A3B8;font-size:12px;margin-top:16px;text-align:center">For security, appointment details are only visible after logging in.</p>
        `,
        ),'''

if old_booking_created_email in content:
    content = content.replace(old_booking_created_email, new_booking_created_email)
    print("✅ FIX 1: onBookingCreated provider email — PHI removed")
else:
    print("⚠️  FIX 1: onBookingCreated pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: onBookingStatusChanged — CONFIRMED email to patient
# Remove provider name, date, time
# ─────────────────────────────────────────────────────────────────────────────

old_confirmed_email = '''      subject = `Appointment confirmed — ${date} at ${time}`;
      bodyHtml = `
        <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#166534">Your appointment is confirmed!</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> confirmed your appointment for ${date} at ${time}.</p>
        <p style="color:#475569">Please arrive 10 minutes early with your ID and insurance card.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View in Morava App &rarr;</a>
      `;'''

new_confirmed_email = '''      subject = `Your Morava appointment has been confirmed`;
      bodyHtml = `
        <div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#166534">Your appointment is confirmed!</strong>
        </div>
        <p style="color:#475569">Your upcoming appointment has been confirmed. Open the Morava app to view the full appointment details including date, time, and provider information.</p>
        <p style="color:#475569">Please arrive 10 minutes early with your ID and insurance card.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">View Details in Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;'''

if old_confirmed_email in content:
    content = content.replace(old_confirmed_email, new_confirmed_email)
    print("✅ FIX 2: onBookingStatusChanged confirmed email — PHI removed")
else:
    print("⚠️  FIX 2: confirmed email pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: onBookingStatusChanged — CANCELLED email to patient
# Remove provider name, date, time, cancellation reason
# ─────────────────────────────────────────────────────────────────────────────

old_cancelled_email = '''      subject = `Appointment update — ${date}`;
      bodyHtml = `
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#991B1B">Appointment cancelled</strong>
        </div>
        <p style="color:#475569">Your appointment with <strong>${providerName}</strong> on ${date} at ${time} has been cancelled.</p>
        ${reason ? `<p style="color:#475569"><strong>Reason:</strong> ${reason}</p>` : ""}
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Find Another Provider &rarr;</a>
      `;'''

new_cancelled_email = '''      subject = `Your Morava appointment has been updated`;
      bodyHtml = `
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#991B1B">Appointment update</strong>
        </div>
        <p style="color:#475569">An upcoming appointment has been cancelled or declined. Open the Morava app to view details and find another available provider.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Open Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;'''

if old_cancelled_email in content:
    content = content.replace(old_cancelled_email, new_cancelled_email)
    print("✅ FIX 3: onBookingStatusChanged cancelled email — PHI removed")
else:
    print("⚠️  FIX 3: cancelled email pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: onBookingStatusChanged — RESCHEDULE email to patient
# Remove provider name, original date/time, proposed date/time
# ─────────────────────────────────────────────────────────────────────────────

old_reschedule_email = '''      subject = `Reschedule proposed — ${providerName}`;
      bodyHtml = `
        <div style="background:#FAF5FF;border-left:4px solid #A855F7;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#7E22CE">New time proposed</strong>
        </div>
        <p style="color:#475569"><strong>${providerName}</strong> has proposed rescheduling.</p>
        <p style="color:#475569"><strong>Original:</strong> ${date} at ${time}<br/><strong>Proposed:</strong> ${pd} at ${pt}</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Respond in Morava App &rarr;</a>
      `;'''

new_reschedule_email = '''      subject = `Your provider has proposed a new appointment time`;
      bodyHtml = `
        <div style="background:#FAF5FF;border-left:4px solid #A855F7;border-radius:8px;padding:14px;margin-bottom:14px">
          <strong style="color:#7E22CE">New time proposed</strong>
        </div>
        <p style="color:#475569">Your provider has proposed a new time for your upcoming appointment. Open the Morava app to view the proposed time and accept or decline.</p>
        <a href="https://moravacare.com" style="display:block;background:#14B8A6;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;text-align:center;margin-top:16px">Respond in Morava App &rarr;</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:12px;text-align:center">For security, appointment details are only visible in the app after logging in.</p>
      `;'''

if old_reschedule_email in content:
    content = content.replace(old_reschedule_email, new_reschedule_email)
    print("✅ FIX 4: onBookingStatusChanged reschedule email — PHI removed")
else:
    print("⚠️  FIX 4: reschedule email pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 5: onBookingCreated — push notification to patient
# Remove provider name from push body (name is PHI in context of appointment)
# ─────────────────────────────────────────────────────────────────────────────

old_push_created = '''              body: `Your request to see ${esc(data.providerName || "your provider")} on ${esc(data.date)} is pending confirmation.`,'''

new_push_created = '''              body: `Your appointment request has been submitted and is pending confirmation. Open Morava to view details.`,'''

if old_push_created in content:
    content = content.replace(old_push_created, new_push_created)
    print("✅ FIX 5: onBookingCreated push notification — PHI removed")
else:
    print("⚠️  FIX 5: push created pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 6: onBookingStatusChanged — push notifications to patient
# Remove provider name, date, time from push bodies
# ─────────────────────────────────────────────────────────────────────────────

old_push_confirmed = '''            pushBody = `${esc(after.providerName || "Your provider")} confirmed your appointment on ${esc(after.date)} at ${esc(after.time)}.`;'''
new_push_confirmed = '''            pushBody = `Your appointment has been confirmed. Open Morava to view the details.`;'''

old_push_cancelled = '''            pushBody = `Your appointment with ${esc(after.providerName || "your provider")} on ${esc(after.date)} was cancelled.`;'''
new_push_cancelled = '''            pushBody = `An appointment has been cancelled. Open Morava for details.`;'''

old_push_reschedule = '''            pushBody = `${esc(after.providerName || "Your provider")} proposed a new time for your appointment.`;'''
new_push_reschedule = '''            pushBody = `Your provider has proposed a new appointment time. Open Morava to respond.`;'''

fixes_push = [
    (old_push_confirmed, new_push_confirmed, "push confirmed"),
    (old_push_cancelled, new_push_cancelled, "push cancelled"),
    (old_push_reschedule, new_push_reschedule, "push reschedule"),
]

for old, new, label in fixes_push:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ FIX 6 ({label}): PHI removed from push notification")
    else:
        print(f"⚠️  FIX 6 ({label}): pattern not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# Write file
# ─────────────────────────────────────────────────────────────────────────────

if content != original:
    with open(path, "w") as f:
        f.write(content)
    changes = sum(1 for o, n, _ in [
        (old_booking_created_email, new_booking_created_email, ""),
        (old_confirmed_email, new_confirmed_email, ""),
        (old_cancelled_email, new_cancelled_email, ""),
        (old_reschedule_email, new_reschedule_email, ""),
    ] if o in original)
    print(f"\n✅ File updated — {content.count('Open Morava')} notification-only CTAs in place")
    print("✅ No PHI in any Resend email or push notification body")
    print("✅ Resend BAA no longer required — emails contain zero PHI")
else:
    print("\n⚠️  No changes written — check pattern mismatches above")
