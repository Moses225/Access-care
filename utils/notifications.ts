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
      console.log('Notification permission denied');
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

    console.log('Notification sent');
  } catch (error) {
    console.log('Notification error:', error);
  }
}