import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db } from '../../firebase';

interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (!isGuest) loadAppointments();
    else setLoading(false);
  }, [isGuest]);

  const loadAppointments = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }

      const appointmentsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(appointmentsQuery);
      const appointmentsList: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        appointmentsList.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      appointmentsList.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAppointments(appointmentsList);
    } catch (error) {
      if (__DEV__) console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const cancelAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel appointment with ${appointment.providerName} on ${formatDate(appointment.date)} at ${appointment.time}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', appointment.id), { status: 'cancelled' });
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4caf50';
      case 'pending': return '#ff9800';
      case 'cancelled': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Appointments</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>Your scheduled visits</Text>
        </View>
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
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Appointments</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Your scheduled visits</Text>
      </View>

      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No appointments yet</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Book your first appointment to get started
          </Text>
          <TouchableOpacity
            style={[styles.browseButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/' as any)}
            accessibilityRole="button"
          >
            <Text style={styles.browseButtonText}>Browse Providers</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <View style={[styles.appointmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.appointmentHeader}>
                <View style={styles.dateSection}>
                  <Text style={[styles.dayText, { color: colors.subtext }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.primary }]}>{item.time}</Text>
                </View>
                <View style={styles.providerSection}>
                  <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
                    {item.providerName}
                  </Text>
                  <Text style={[styles.providerSpecialty, { color: colors.primary }]} numberOfLines={1}>
                    {item.providerSpecialty}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>

              {item.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: '#f44336' }]}
                    onPress={() => cancelAppointment(item)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.actionButtonText, { color: '#f44336' }]}>Cancel</Text>
                  </TouchableOpacity>
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
  centerContainer: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  list: { padding: 16, flexGrow: 1 },
  appointmentCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center' },
  dateSection: { marginRight: 16, alignItems: 'center', minWidth: 60 },
  dayText: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  dateText: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  timeText: { fontSize: 16, fontWeight: '600' },
  providerSection: { flex: 1 },
  providerName: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  providerSpecialty: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 80, marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  browseButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  browseButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Guest wall
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
