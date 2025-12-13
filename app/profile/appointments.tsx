import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebase";

type AppointmentRecord = {
  userId: string;
  date: string;
  time: string;
  provider: string;
  specialty?: string;
  reason?: string;
  status?: string;
};

export type Appointment = AppointmentRecord & { id: string };

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "appointments"), where("userId", "==", uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Appointment[] = snapshot.docs.map((doc) => {
          const record = doc.data() as AppointmentRecord;
          return { id: doc.id, ...record };
        });
        setAppointments(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, []);

  const cancelAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel appointment with ${appointment.provider} on ${appointment.date}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'appointments', appointment.id));
              Alert.alert('Cancelled', 'Appointment has been cancelled');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          }
        }
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} color="#667eea" />;

  return (
    <View style={styles.container}>
      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No appointments yet</Text>
          <Text style={styles.emptyText}>Book your first appointment to get started</Text>
        </View>
      ) : (
        <FlatList<Appointment>
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status || 'Confirmed'}</Text>
                </View>
              </View>
              
              <Text style={styles.provider}>{item.provider}</Text>
              {item.specialty && <Text style={styles.specialty}>{item.specialty}</Text>}
              
              <View style={styles.dateTime}>
                <Text style={styles.date}>📅 {item.date}</Text>
                <Text style={styles.time}>🕐 {item.time}</Text>
              </View>
              
              {item.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason:</Text>
                  <Text style={styles.reason}>{item.reason}</Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => cancelAppointment(item)}
              >
                <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  card: {
    backgroundColor: "#f0f0ff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  provider: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 4 },
  specialty: { fontSize: 14, color: "#667eea", marginBottom: 10 },
  dateTime: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  date: { fontSize: 15, color: "#333", fontWeight: '500' },
  time: { fontSize: 15, color: "#333", fontWeight: '500' },
  reasonBox: { 
    backgroundColor: '#fff', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 10 
  },
  reasonLabel: { fontSize: 12, color: '#666', marginBottom: 3 },
  reason: { fontSize: 14, color: "#333" },
  cancelButton: {
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  cancelButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});