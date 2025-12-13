import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function NotificationsScreen() {
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
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Appointment Reminders</Text>
        <Switch
          value={appointmentReminders}
          onValueChange={(val) => {
            setAppointmentReminders(val);
            updateSetting('appointmentReminders', val);
          }}
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
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
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