import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Notification behaviour while app is foregrounded ────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Register for push notifications ─────────────────────────────────────────
// Called from _layout.tsx on login. Saves push token to Firestore.
// Uses setDoc with merge so it works for both patients AND providers
// even if the users document doesn't exist yet.
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.log('📵 Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('🔕 Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointment Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#14B8A6',
      sound: 'default',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '995509b6-4f68-418d-b6ea-de1591eae79c',
    });
    const token = tokenData.data;

    if (__DEV__) console.log('🔔 Push token:', token);

    // setDoc with merge — creates the document if it doesn't exist,
    // updates it if it does. Fixes the "No document to update" error
    // that occurred for provider accounts with no users/ document.
    await setDoc(doc(db, 'users', uid), {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
      platform: Platform.OS,
    }, { merge: true });

    return token;
  } catch (error) {
    if (__DEV__) console.error('Error getting push token:', error);
    return null;
  }
}

// ─── Send an Expo push notification to a specific user ────────────────────────
// Used by the provider portal to notify the patient when a booking
// is confirmed or declined. Reads the patient's saved push token
// from Firestore then POSTs to the Expo Push API.
//
// This is the Option B "professional" pattern:
// Provider action → read patient token → POST to Expo → delivery to patient
// Works even when the patient's app is closed or in the background.
export async function sendExpoPushToUser({
  userId,
  title,
  body,
  data,
}: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  try {
    // Read the patient's push token from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      if (__DEV__) console.log('No user document for push — skipping');
      return false;
    }

    const token = userDoc.data()?.expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken[')) {
      if (__DEV__) console.log('No valid push token for user — skipping');
      return false;
    }

    // POST to Expo Push API — no backend server needed
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'appointments',
      }),
    });

    const result = await response.json();

    if (__DEV__) console.log('📤 Expo push result:', JSON.stringify(result));

    // Check for errors in Expo's response
    if (result.data?.status === 'error') {
      if (__DEV__) console.warn('Expo push error:', result.data.message);
      return false;
    }

    return true;
  } catch (error) {
    // Non-critical — notification failure should never block the booking action
    if (__DEV__) console.error('sendExpoPushToUser error:', error);
    return false;
  }
}

// ─── Fire a local notification immediately ────────────────────────────────────
// Used when the app is open and we detect a booking status change via onSnapshot.
export async function fireLocalNotification({
  title,
  body,
  data,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
      },
      trigger: null, // null = fire immediately
    });
  } catch (error) {
    if (__DEV__) console.error('Error firing local notification:', error);
  }
}

// ─── Booking status notification content ─────────────────────────────────────
export function getBookingStatusNotification(
  status: string,
  providerName: string,
  date: string,
  time: string,
  declineReason?: string
): { title: string; body: string } | null {
  switch (status) {
    case 'confirmed':
      return {
        title: '✅ Appointment Confirmed!',
        body: `${providerName} confirmed your appointment on ${date} at ${time}.`,
      };
    case 'cancelled':
      return {
        title: '❌ Appointment Cancelled',
        body: declineReason
          ? `${providerName} cancelled your appointment. Reason: ${declineReason}`
          : `Your appointment with ${providerName} was cancelled.`,
      };
    default:
      return null;
  }
}

// ─── Schedule a 24hr appointment reminder ─────────────────────────────────────
export async function scheduleAppointmentReminder({
  bookingId,
  providerName,
  appointmentDate,
  appointmentTime,
}: {
  bookingId: string;
  providerName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM
}): Promise<string | null> {
  try {
    const [year, month, day] = appointmentDate.split('-').map(Number);
    const [hours, minutes] = appointmentTime.split(':').map(Number);

    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes, 0);
    const reminderTime = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);

    if (reminderTime <= new Date()) {
      if (__DEV__) console.log('Reminder time already passed, skipping');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Appointment Tomorrow',
        body: `Reminder: You have an appointment with ${providerName} tomorrow at ${appointmentTime}. Bring your ID and insurance card.`,
        data: { bookingId, type: 'reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });

    if (__DEV__) console.log('📅 Reminder scheduled:', notificationId, 'for', reminderTime);
    return notificationId;
  } catch (error) {
    if (__DEV__) console.error('Error scheduling reminder:', error);
    return null;
  }
}

// ─── Cancel a scheduled reminder ─────────────────────────────────────────────
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    if (__DEV__) console.error('Error cancelling notification:', error);
  }
}
