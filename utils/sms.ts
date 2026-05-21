// SMS utility — routes through Firebase Cloud Function
// Twilio credentials are NEVER in the app bundle.
// Cloud Function: sendSMSNotification (functions/src/index.ts)
// PHI-FREE: No provider name, date, time, or patient identifier in any body.

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const callSendSMS = httpsCallable<{ to: string; body: string }, { success: boolean }>(
  functions,
  "sendSMSNotification"
);

async function sendSMS(to: string, body: string): Promise<boolean> {
  try {
    await callSendSMS({ to, body });
    if (__DEV__) console.log("✅ SMS dispatched via Cloud Function");
    return true;
  } catch (error) {
    if (__DEV__) console.error("❌ SMS Cloud Function failed:", error);
    return false;
  }
}

// PHI-FREE message bodies — all appointment details are behind the authenticated app.

export async function sendBookingConfirmationSMS(
  phoneNumber: string,
  providerName: string, // not used in body — kept for call-site compatibility
  date: string,         // not used in body — kept for call-site compatibility
  time: string,         // not used in body — kept for call-site compatibility
  bookingId?: string,   // not used in body — kept for call-site compatibility
): Promise<boolean> {
  const body =
    "Morava: Your appointment request has been submitted and is pending confirmation. " +
    "Open the app to view details. Reply STOP to unsubscribe.";
  return sendSMS(phoneNumber, body);
}

export async function sendBookingConfirmedSMS(
  phoneNumber: string,
  providerName: string, // not used in body
  date: string,         // not used in body
  time: string,         // not used in body
): Promise<boolean> {
  const body =
    "Morava: ✅ Your appointment has been confirmed. " +
    "Open the Morava app to view the details. Bring your ID and insurance card. " +
    "Reply STOP to unsubscribe.";
  return sendSMS(phoneNumber, body);
}

export async function sendBookingReminderSMS(
  phoneNumber: string,
  providerName: string, // not used in body
  date: string,         // not used in body
  time: string,         // not used in body
): Promise<boolean> {
  const body =
    "Morava: ⏰ You have an upcoming appointment tomorrow. " +
    "Open the Morava app to view the time and location. " +
    "Arrive 10 min early with your ID and insurance. Reply STOP to unsubscribe.";
  return sendSMS(phoneNumber, body);
}

export async function sendBooking2HourReminderSMS(
  phoneNumber: string,
): Promise<boolean> {
  const body =
    "Morava: ⏰ Your appointment is in 2 hours. " +
    "Open the Morava app to view details. Reply STOP to unsubscribe.";
  return sendSMS(phoneNumber, body);
}
