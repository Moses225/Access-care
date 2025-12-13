import * as Notifications from 'expo-notifications';

// Configure how notifications are handled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  return true;
}

export async function scheduleAppointmentReminder(
  providerName: string,
  date: string,
  time: string
) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('No notification permission');
    return;
  }

  try {
    // Schedule notification (5 seconds from now for demo)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appointment Reminder 📅',
        body: `You have an appointment with ${providerName} on ${date} at ${time}`,
        data: { providerName, date, time },
        sound: true,
      },
      trigger: { seconds: 5 } as any, // Type assertion to bypass TypeScript error
    });

    console.log('Notification scheduled successfully');
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

export async function sendImmediateNotification(title: string, body: string) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
    console.log('Immediate notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}