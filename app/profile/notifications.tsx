import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [generalUpdates, setGeneralUpdates] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const ref = doc(db, 'notifications', uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAppointmentReminders(data.appointmentReminders ?? true);
        setGeneralUpdates(data.generalUpdates ?? true);
      }
    } catch (error) {
      console.log('Error loading notification settings:', error);
    }
  };

  const updateSetting = async (field: string, value: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await setDoc(
        doc(db, 'notifications', uid),
        { [field]: value },
        { merge: true }
      );
      Alert.alert('Updated', 'Notification preferences saved.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Appointment Reminders</Text>
          <Switch
            value={appointmentReminders}
            onValueChange={(val) => {
              setAppointmentReminders(val);
              updateSetting('appointmentReminders', val);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={appointmentReminders ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>General Updates</Text>
          <Switch
            value={generalUpdates}
            onValueChange={(val) => {
              setGeneralUpdates(val);
              updateSetting('generalUpdates', val);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={generalUpdates ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  label: { fontSize: 16 },
});