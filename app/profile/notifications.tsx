import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function NotificationsScreen() {
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [generalUpdates, setGeneralUpdates] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const fetchNotifications = async () => {
      const ref = doc(db, 'notifications', uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAppointmentReminders(data.appointmentReminders ?? true);
        setGeneralUpdates(data.generalUpdates ?? true);
      }
    };
    fetchNotifications();
  }, []);

  const updateNotifications = async (field: string, value: boolean) => {
    if (!auth.currentUser?.uid) return;
    await setDoc(
      doc(db, 'notifications', auth.currentUser.uid),
      { [field]: value },
      { merge: true }
    );
    Alert.alert('Updated', 'Notification preferences saved.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Appointment Reminders</Text>
        <Switch
          value={appointmentReminders}
          onValueChange={(val) => {
            setAppointmentReminders(val);
            updateNotifications('appointmentReminders', val);
          }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>General Updates</Text>
        <Switch
          value={generalUpdates}
          onValueChange={(val) => {
            setGeneralUpdates(val);
            updateNotifications('generalUpdates', val);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 16, color: '#333' },
});