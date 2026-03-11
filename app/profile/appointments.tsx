import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db } from '../../firebase';

type BookingRecord = {
  userId: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  notes?: string;
  status: string;
  createdAt: string;
};

export type Booking = BookingRecord & { id: string };

export default function AppointmentsScreen() {
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }

    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(collection(db, 'bookings'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data: Booking[] = snapshot.docs.map((doc) => ({
          id: doc.id, ...(doc.data() as BookingRecord),
        }));
        data.sort((a, b) =>
          new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()
        );
        setBookings(data);
        setLoading(false);
      },
      (error) => {
        if (__DEV__) console.error('Error fetching bookings:', error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [isGuest]);

  const cancelBooking = (booking: Booking) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel appointment with ${booking.providerName} on ${formatDate(booking.date)} at ${booking.time}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel', style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', booking.id), { status: 'cancelled' });
              Alert.alert('Cancelled', 'Appointment has been cancelled');
            } catch (error) {
              if (__DEV__) console.error('Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4caf50';
      case 'pending': return '#ff9800';
      case 'cancelled': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const filterBookings = () => {
    const now = new Date();
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date + ' ' + booking.time);
      if (filter === 'upcoming') return bookingDate >= now && booking.status !== 'cancelled';
      if (filter === 'past') return bookingDate < now || booking.status === 'cancelled';
      return true;
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required</Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to book and manage your appointments.
          </Text>
          <TouchableOpacity
            style={[styles.createAccountButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePrompt(true)}
            accessibilityRole="button"
          >
            <Text style={styles.createAccountButtonText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>
        <GuestUpgradePrompt
          visible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          reason="manage appointments"
        />
      </View>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  const filteredBookings = filterBookings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.filterContainer}>
        {(['upcoming', 'past', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && { backgroundColor: colors.primary }]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'upcoming' ? 'No upcoming appointments' :
             filter === 'past' ? 'No past appointments' : 'No appointments yet'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Book your first appointment to get started
          </Text>
        </View>
      ) : (
        <FlatList<Booking>
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.provider, { color: colors.text }]}>{item.providerName}</Text>
              <Text style={[styles.specialty, { color: colors.primary }]}>{item.providerSpecialty}</Text>
              <View style={styles.dateTime}>
                <Text style={[styles.date, { color: colors.text }]}>📅 {formatDate(item.date)}</Text>
                <Text style={[styles.time, { color: colors.text }]}>🕐 {item.time}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={[styles.patientLabel, { color: colors.subtext }]}>Patient:</Text>
                <Text style={[styles.patientName, { color: colors.text }]}>{item.patientName}</Text>
              </View>
              {item.notes ? (
                <View style={[styles.notesBox, { backgroundColor: colors.background }]}>
                  <Text style={[styles.notesLabel, { color: colors.subtext }]}>Notes:</Text>
                  <Text style={[styles.notes, { color: colors.text }]}>{item.notes}</Text>
                </View>
              ) : null}
              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => cancelBooking(item)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
                </TouchableOpacity>
              )}
              {item.status === 'cancelled' && (
                <View style={styles.cancelledNote}>
                  <Text style={styles.cancelledText}>This appointment was cancelled</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterContainer: { flexDirection: 'row', padding: 16, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#E0E0E0', alignItems: 'center' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 0 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  provider: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  specialty: { fontSize: 14, marginBottom: 12, fontWeight: '600' },
  dateTime: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  date: { fontSize: 15, fontWeight: '500' },
  time: { fontSize: 15, fontWeight: '500' },
  patientInfo: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  patientLabel: { fontSize: 14 },
  patientName: { fontSize: 14, fontWeight: '600' },
  notesBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
  notesLabel: { fontSize: 12, marginBottom: 4 },
  notes: { fontSize: 14 },
  cancelButton: { backgroundColor: '#ff4444', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelledNote: { backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginTop: 8 },
  cancelledText: { color: '#c62828', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  // Guest wall
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
