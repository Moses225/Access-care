import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
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
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    // Query the BOOKINGS collection (not appointments)
    const q = query(collection(db, "bookings"), where("userId", "==", uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Booking[] = snapshot.docs.map((doc) => {
          const record = doc.data() as BookingRecord;
          return { id: doc.id, ...record };
        });

        // Sort by date (newest first)
        data.sort((a, b) => {
          const dateA = new Date(a.date + ' ' + a.time);
          const dateB = new Date(b.date + ' ' + b.time);
          return dateB.getTime() - dateA.getTime();
        });

        setBookings(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching bookings:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const cancelBooking = (booking: Booking) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel appointment with ${booking.providerName} on ${formatDate(booking.date)} at ${booking.time}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update status to cancelled instead of deleting
              await updateDoc(doc(db, 'bookings', booking.id), {
                status: 'cancelled'
              });
              Alert.alert('Cancelled', 'Appointment has been cancelled');
            } catch (error) {
              console.error('Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#4caf50';
      case 'pending':
        return '#ff9800';
      case 'cancelled':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const filterBookings = () => {
    const now = new Date();

    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date + ' ' + booking.time);

      if (filter === 'upcoming') {
        return bookingDate >= now && booking.status !== 'cancelled';
      } else if (filter === 'past') {
        return bookingDate < now || booking.status === 'cancelled';
      }
      return true; // 'all'
    });
  };

  const filteredBookings = filterBookings();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'upcoming' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[
            styles.filterText,
            filter === 'upcoming' && styles.filterTextActive
          ]}>
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'past' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('past')}
        >
          <Text style={[
            styles.filterText,
            filter === 'past' && styles.filterTextActive
          ]}>
            Past
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterText,
            filter === 'all' && styles.filterTextActive
          ]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'upcoming' ? 'No upcoming appointments' :
             filter === 'past' ? 'No past appointments' :
             'No appointments yet'}
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
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) }
                ]}>
                  <Text style={styles.statusText}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.provider, { color: colors.text }]}>
                {item.providerName}
              </Text>
              <Text style={[styles.specialty, { color: colors.primary }]}>
                {item.providerSpecialty}
              </Text>

              <View style={styles.dateTime}>
                <Text style={[styles.date, { color: colors.text }]}>
                  📅 {formatDate(item.date)}
                </Text>
                <Text style={[styles.time, { color: colors.text }]}>
                  🕐 {item.time}
                </Text>
              </View>

              <View style={styles.patientInfo}>
                <Text style={[styles.patientLabel, { color: colors.subtext }]}>
                  Patient:
                </Text>
                <Text style={[styles.patientName, { color: colors.text }]}>
                  {item.patientName}
                </Text>
              </View>

              {item.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.background }]}>
                  <Text style={[styles.notesLabel, { color: colors.subtext }]}>
                    Notes:
                  </Text>
                  <Text style={[styles.notes, { color: colors.text }]}>
                    {item.notes}
                  </Text>
                </View>
              )}

              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => cancelBooking(item)}
                >
                  <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
                </TouchableOpacity>
              )}

              {item.status === 'cancelled' && (
                <View style={styles.cancelledNote}>
                  <Text style={styles.cancelledText}>
                    This appointment was cancelled
                  </Text>
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  provider: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  specialty: { fontSize: 14, marginBottom: 12, fontWeight: '600' },
  dateTime: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  date: { fontSize: 15, fontWeight: '500' },
  time: { fontSize: 15, fontWeight: '500' },
  patientInfo: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  patientLabel: { fontSize: 14 },
  patientName: { fontSize: 14, fontWeight: '600' },
  notesBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  notesLabel: { fontSize: 12, marginBottom: 4 },
  notes: { fontSize: 14 },
  cancelButton: {
    backgroundColor: '#ff4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelledNote: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  cancelledText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
