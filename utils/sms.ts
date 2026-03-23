// SMS utility — Twilio REST API
// Credentials loaded from env vars (never hardcoded)

const ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ?? "";
const AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ?? "";
const FROM_NUMBER = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER ?? "";

async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    if (__DEV__) console.warn("⚠️ Twilio credentials not configured");
    return false;
  }

  // Sanitize phone — ensure E.164 format
  const sanitized = to.replace(/[^\d+]/g, "");
  const e164 = sanitized.startsWith("+") ? sanitized : `+1${sanitized}`;

  if (e164.length < 10) {
    if (__DEV__) console.warn("⚠️ Invalid phone number:", to);
    return false;
  }

  try {
    const credentials = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: FROM_NUMBER,
        To: e164,
        Body: body,
      }).toString(),
    });

    const data = await response.json();

    if (response.ok) {
      if (__DEV__) console.log("✅ SMS sent:", data.sid, "→", e164);
      return true;
    } else {
      if (__DEV__) console.error("❌ Twilio error:", data.message, "code:", data.code);
      return false;
    }
  } catch (error) {
    if (__DEV__) console.error("❌ SMS send failed:", error);
    return false;
  }
}

export async function sendBookingConfirmationSMS(
  phoneNumber: string,
  providerName: string,
  date: string,
  time: string,
  bookingId: string,
): Promise<boolean> {
  const body =
    `Morava: Your appointment request with ${providerName} on ${date} at ${time} has been submitted. ` +
    `Booking ID: ${bookingId}. We'll text you when confirmed. Reply STOP to unsubscribe.`;

  if (__DEV__) console.log("📱 Sending confirmation SMS to:", phoneNumber);
  return sendSMS(phoneNumber, body);
}

export async function sendBookingConfirmedSMS(
  phoneNumber: string,
  providerName: string,
  date: string,
  time: string,
): Promise<boolean> {
  const body =
    `Morava: ✅ Confirmed! Your appointment with ${providerName} is set for ${date} at ${time}. ` +
    `Bring your ID and insurance card. Reply STOP to unsubscribe.`;

  if (__DEV__) console.log("📱 Sending confirmed SMS to:", phoneNumber);
  return sendSMS(phoneNumber, body);
}

export async function sendBookingReminderSMS(
  phoneNumber: string,
  providerName: string,
  date: string,
  time: string,
): Promise<boolean> {
  const body =
    `Morava: ⏰ Reminder — appointment with ${providerName} tomorrow at ${time}. ` +
    `Arrive 10 min early. Bring ID and insurance. Reply STOP to unsubscribe.`;

  if (__DEV__) console.log("📱 Sending reminder SMS to:", phoneNumber);
  return sendSMS(phoneNumber, body);
}
