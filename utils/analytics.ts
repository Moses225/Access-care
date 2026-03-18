import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
// ── Log a custom analytics event to Firestore ──────────────────────────────
// Events land in analytics_events collection — query in Firebase console
export async function logAnalyticsEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {}
) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'analytics_events'), {
      event: eventName,
      userId: user?.uid || 'anonymous',
      isAnonymous: user?.isAnonymous ?? true,
      ...params,
      timestamp: serverTimestamp(),
      platform: 'android', // update when iOS ships
    });
  } catch {
    // Analytics failures must never crash the app
  }
}
