import * as SecureStore from 'expo-secure-store';

// ─── Booking rate limit ────────────────────────────────────────────────────────
// Max bookings a patient can create per rolling 24-hour window.
// Client-side enforcement using SecureStore (encrypted) — mirrors the
// server-side limit enforced by the Cloud Function before Firestore write.
// Using SecureStore instead of AsyncStorage because rate-limit keys are
// tied to user identity — we don't want them visible in plaintext on disk.
const MAX_BOOKINGS_PER_DAY = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function getRateLimitKey(uid: string): string {
  // Prefix keeps SecureStore namespace clean; uid is already opaque
  return `rateLimit_bookings_${uid}`;
}

type RateLimitRecord = {
  timestamps: number[]; // Unix ms of each booking creation
};

async function readRecord(key: string): Promise<RateLimitRecord> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as RateLimitRecord) : { timestamps: [] };
  } catch {
    return { timestamps: [] };
  }
}

async function writeRecord(key: string, record: RateLimitRecord): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(record), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    if (__DEV__) console.warn('[RateLimit] SecureStore write failed');
  }
}

// Returns true if the user is allowed to create a booking.
// Returns false and a reason string if they are rate-limited.
export async function checkBookingRateLimit(uid: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  try {
    const key = getRateLimitKey(uid);
    const now = Date.now();
    const record = await readRecord(key);

    // Drop timestamps outside the rolling window
    record.timestamps = record.timestamps.filter(t => now - t < WINDOW_MS);

    if (record.timestamps.length >= MAX_BOOKINGS_PER_DAY) {
      const oldestInWindow = Math.min(...record.timestamps);
      const resetsInMs = WINDOW_MS - (now - oldestInWindow);
      const resetsInHours = Math.ceil(resetsInMs / (60 * 60 * 1000));

      return {
        allowed: false,
        reason: `You have reached the maximum of ${MAX_BOOKINGS_PER_DAY} booking requests in 24 hours. You can book again in approximately ${resetsInHours} hour${resetsInHours !== 1 ? 's' : ''}.`,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: MAX_BOOKINGS_PER_DAY - record.timestamps.length,
    };
  } catch {
    // If SecureStore fails (e.g. simulator without keychain), allow the
    // booking — fail open on client-side only (server-side enforces anyway)
    return { allowed: true };
  }
}

// Call this after a booking is successfully created to record the timestamp.
export async function recordBookingCreation(uid: string): Promise<void> {
  try {
    const key = getRateLimitKey(uid);
    const now = Date.now();
    const record = await readRecord(key);

    // Drop old timestamps and add new one
    record.timestamps = record.timestamps.filter(t => now - t < WINDOW_MS);
    record.timestamps.push(now);

    await writeRecord(key, record);
  } catch {
    // Non-critical — rate limit record failed to save
    if (__DEV__) console.warn('[RateLimit] Failed to record booking creation');
  }
}
