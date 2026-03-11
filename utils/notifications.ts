import * as Notifications from 'expo-notifications';

export async function scheduleAppointmentReminder(
  providerName: string,
  date: string,
  time: string
) {
  try {
    // Request permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      if (__DEV__) console.log('Notification permission denied');
      return;
    }

    // Show notification immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appointment Confirmed! 📅',
        body: `Appointment with ${providerName} on ${date} at ${time}`,
      },
      trigger: null,
    });

    if (__DEV__) console.log('Notification sent');
  } catch (error) {
    if (__DEV__) console.log('Notification error:', error);
  }
}