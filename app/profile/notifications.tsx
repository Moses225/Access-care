import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [generalUpdates, setGeneralUpdates] = useState(false);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const notifDoc = await getDoc(doc(db, 'notifications', user.uid));
      if (notifDoc.exists()) {
        const data = notifDoc.data();
        setAppointmentReminders(data.appointmentReminders ?? true);
        setGeneralUpdates(data.generalUpdates ?? false);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleToggleReminders = async (value: boolean) => {
    setAppointmentReminders(value);
    await saveSettings({ appointmentReminders: value, generalUpdates });
  };

  const handleToggleUpdates = async (value: boolean) => {
    setGeneralUpdates(value);
    await saveSettings({ appointmentReminders, generalUpdates: value });
  };

  const saveSettings = async (settings: any) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await setDoc(doc(db, 'notifications', user.uid), {
        ...settings,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Manage how you receive updates
          </Text>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Appointment Reminders
              </Text>
              <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                Get notified before your appointments
              </Text>
            </View>
            <Switch
              value={appointmentReminders}
              onValueChange={handleToggleReminders}
              trackColor={{ false: '#ccc', true: colors.primary }}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                General Updates
              </Text>
              <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                News, features, and tips
              </Text>
            </View>
            <Switch
              value={generalUpdates}
              onValueChange={handleToggleUpdates}
              trackColor={{ false: '#ccc', true: colors.primary }}
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
});