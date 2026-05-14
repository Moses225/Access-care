import * as Sentry from "@sentry/react-native";

// ─── PII fields to scrub from error objects before logging ───────────────────
// These field names may appear in Firestore error metadata or in data
// accidentally attached to errors. We strip them before any logging.
const PII_FIELDS = [
  // Identity
  "email", "phone", "name", "firstName", "lastName", "displayName",
  "patientName", "patientPhone", "guardianName", "guardianPhone",
  "address", "dateOfBirth", "birthYear", "uid", "userId", "providerId",
  // Insurance / Admin
  "policyNumber", "policy", "memberId", "groupNumber", "insuranceId",
  "medicaidId", "insuranceProvider", "insurancePlan",
  // Clinical — added per HIPAA audit
  "bloodType", "weight", "height", "medications", "allergies",
  "conditions", "surgeries", "vaccinations", "pregnancyStatus",
  "primaryCareProvider", "emergencyContact", "familyHistory",
  "mentalHealthHistory", "reasonForVisit", "notes", "intakeSummary",
  "chiefComplaint", "currentMedications", "pastMedications",
  "chronicConditions", "recentSurgeries", "immunizations",
  "socialHistory", "reviewOfSystems",
  // Scheduling PHI
  "bookingId", "appointmentDate", "appointmentTime", "providerName",
  "practiceName", "visitType", "visitTypeLabel",
  // Auth tokens
  "token", "accessToken", "refreshToken", "idToken", "sessionToken",
];

// Recursively scrub known PII fields from an object before logging
// Exported so Sentry.init beforeSend can reuse it as a belt-and-suspenders guard
export function scrubPII(obj: any, depth = 0): any {
  if (depth > 4) return "[deep object]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // Scrub anything that looks like an email or phone number
    return obj
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]")
      .replace(
        /(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?)(\d{3}[\s.\-]?\d{4})/g,
        "[phone]",
      )
      .replace(/\b\d{3}[\-]?\d{2}[\-]?\d{4}\b/g, "[ssn]")
      .replace(/\bMR[\-#]?\d{5,10}\b/gi, "[mrn]")
      .replace(/\b[A-Z]{1,3}\d{6,12}\b/g, "[insurance-id]");
  }
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => scrubPII(item, depth + 1));

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key.toLowerCase())) {
      clean[key] = "[redacted]";
    } else {
      clean[key] = scrubPII(val, depth + 1);
    }
  }
  return clean;
}

// Extract a safe, loggable error summary — never includes raw PII
function safeErrorSummary(error: any): Record<string, any> {
  if (!error) return { message: "Unknown error" };

  return scrubPII({
    message: error?.message || "Unknown error",
    code: error?.code || undefined,
    name: error?.name || undefined,
    // Never log the full stack in production — it can contain file paths
    // with user data embedded in Firestore document paths
    stack: __DEV__
      ? error?.stack?.split("\n").slice(0, 3).join(" | ")
      : undefined,
  });
}

// ─── logError ─────────────────────────────────────────────────────────────────
// Call this wherever you catch errors that should be tracked.
// In dev: logs to console. In production: sends scrubbed event to Sentry.
export function logError(
  error: any,
  context: string,
): {
  message: string;
  context: string;
  timestamp: string;
} {
  const safe = safeErrorSummary(error);

  if (__DEV__) {
    console.error(`[${context}] Error:`, safe);
  } else {
    // Send scrubbed error to Sentry — no PII ever reaches the dashboard
    Sentry.captureException(new Error(safe.message), {
      extra: { context, ...safe },
    });
  }

  return {
    message: safe.message || "Unknown error",
    context,
    timestamp: new Date().toISOString(),
  };
}

// ─── logWarning ───────────────────────────────────────────────────────────────
// For non-fatal issues worth tracking — degraded state, fallback behavior, etc.
export function logWarning(message: string, context: string): void {
  if (__DEV__) {
    console.warn(`[${context}] Warning:`, message);
  } else {
    const safeMessage =
      typeof message === "string" ? scrubPII(message) : "[redacted]";
    Sentry.captureMessage(`[${context}] ${safeMessage}`, "warning");
  }
}
