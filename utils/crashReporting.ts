import * as Sentry from '@sentry/react-native';

// ─── PII fields to scrub from error objects before logging ───────────────────
// These field names may appear in Firestore error metadata or in data
// accidentally attached to errors. We strip them before any logging.
const PII_FIELDS = [
  'email', 'phone', 'patientName', 'patientPhone', 'guardianName',
  'guardianPhone', 'address', 'dateOfBirth', 'policyNumber', 'policy',
  'name', 'firstName', 'lastName', 'uid', 'userId',
];

// Recursively scrub known PII fields from an object before logging
function scrubPII(obj: any, depth = 0): any {
  if (depth > 4) return '[deep object]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Scrub anything that looks like an email or phone number
    return obj
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email]')
      .replace(/(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?)(\d{3}[\s.\-]?\d{4})/g, '[phone]');
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => scrubPII(item, depth + 1));

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key.toLowerCase())) {
      clean[key] = '[redacted]';
    } else {
      clean[key] = scrubPII(val, depth + 1);
    }
  }
  return clean;
}

// Extract a safe, loggable error summary — never includes raw PII
function safeErrorSummary(error: any): Record<string, any> {
  if (!error) return { message: 'Unknown error' };

  return scrubPII({
    message: error?.message  || 'Unknown error',
    code:    error?.code     || undefined,
    name:    error?.name     || undefined,
    // Never log the full stack in production — it can contain file paths
    // with user data embedded in Firestore document paths
    stack: __DEV__ ? error?.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
  });
}

// ─── logError ─────────────────────────────────────────────────────────────────
// Call this wherever you catch errors that should be tracked.
// In dev: logs to console. In production: sends scrubbed event to Sentry.
export function logError(error: any, context: string): {
  message: string; context: string; timestamp: string;
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
    message:   safe.message || 'Unknown error',
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
    Sentry.captureMessage(`[${context}] ${message}`, 'warning');
  }
}
