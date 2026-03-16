import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Booking rate limit ────────────────────────────────────────────────────
// Max bookings a patient can create per rolling 24-hour window.
// This is client-side enforcement — a Cloud Function should enforce
// the same limit server-side before public launch.
const MAX_BOOKINGS_PER_DAY = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function getRateLimitKey(uid: string): string {
  return `rateLimit_bookings_${uid}`;
}

type RateLimitRecord = {
  timestamps: number[]; // Unix ms of each booking creation
};

// Returns true if the user is allowed to create a booking.
// Returns false and a reason string if they are rate-limited.
export async function checkBookingRateLimit(uid: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  try {
    const key = getRateLimitKey(uid);
    const raw = await AsyncStorage.getItem(key);
    const now = Date.now();

    let record: RateLimitRecord = raw ? JSON.parse(raw) : { timestamps: [] };

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
    // If AsyncStorage fails, allow the booking (fail open on client-side only)
    return { allowed: true };
  }
}

// Call this after a booking is successfully created to record the timestamp.
export async function recordBookingCreation(uid: string): Promise<void> {
  try {
    const key = getRateLimitKey(uid);
    const raw = await AsyncStorage.getItem(key);
    const now = Date.now();

    let record: RateLimitRecord = raw ? JSON.parse(raw) : { timestamps: [] };

    // Drop old timestamps and add new one
    record.timestamps = record.timestamps.filter(t => now - t < WINDOW_MS);
    record.timestamps.push(now);

    await AsyncStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Non-critical — rate limit record failed to save
    if (__DEV__) console.warn('Rate limit record failed to save');
  }
}
