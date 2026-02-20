import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const appointmentsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(appointmentsQuery);
      const appointmentsList: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointmentsList.push({
          id: doc.id,
          ...doc.data()
        } as Appointment);
      });

      // Sort by date (newest first)
      appointmentsList.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleCancelAppointment = (appointmentId: string, providerName: string) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel your appointment with ${providerName}?`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', appointmentId), {
                status: 'cancelled',
              });
              Alert.alert('Cancelled', 'Your appointment has been cancelled.');
              loadAppointments();
            } catch (error) {
              console.error('Error cancelling appointment:', error);
              Alert.alert('Error', 'Failed to cancel appointment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Reschedule Appointment',
      'To reschedule, please cancel this appointment and book a new one.',
      [
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', appointment.id), {
                status: 'cancelled',
              });
              // Navigate to provider booking page
              router.push(`/booking/${appointment.providerId}` as any);
            } catch (error) {
              console.error('Error cancelling appointment:', error);
              Alert.alert('Error', 'Failed to reschedule. Please try again.');
            }
          },
        },
        {
          text: 'Close',
          style: 'cancel',
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
        return '#10b981';
      case 'completed':
        return '#6366f1';
      case 'cancelled':
        return '#ef4444';
      default:
        return colors.subtext;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Waiting for provider confirmation';
      case 'confirmed':
        return 'Confirmed by provider';
      case 'completed':
        return 'Appointment completed';
      case 'cancelled':
        return 'Appointment cancelled';
      default:
        return '';
    }
  };

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <TouchableOpacity
      style={[styles.appointmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/booking/confirmation?bookingId=${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.appointmentHeader}>
        <View style={styles.dateSection}>
          <Text style={[styles.dayText, { color: colors.success }]}>
            {formatDate(item.date).split(',')[0]}
          </Text>
          <Text style={[styles.dateText, { color: colors.success }]}>
            {formatDate(item.date).split(',')[1].trim().split(' ')[1]} {formatDate(item.date).split(',')[1].trim().split(' ')[0]}
          </Text>
          <Text style={[styles.timeText, { color: colors.text }]}>{item.time}</Text>
        </View>

        <View style={styles.providerSection}>
          <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
            {item.providerName}
          </Text>
          <Text style={[styles.providerSpecialty, { color: colors.primary }]} numberOfLines={1}>
            {item.providerSpecialty}
          </Text>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>

          <Text style={[styles.statusDescription, { color: colors.subtext }]}>
            {getStatusText(item.status)}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
      </View>

      {/* Action Buttons - Only show for pending/confirmed appointments */}
      {(item.status === 'pending' || item.status === 'confirmed') && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation();
              handleRescheduleAppointment(item);
            }}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Reschedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.error }]}
            onPress={(e) => {
              e.stopPropagation();
              handleCancelAppointment(item.id, item.providerName);
            }}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Appointments</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={appointments}
        renderItem={renderAppointment}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Appointments Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Book your first appointment with a SoonerCare-friendly provider!
            </Text>
            <TouchableOpacity
              style={[styles.browseButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)' as any)}
            >
              <Text style={styles.browseButtonText}>Browse Providers</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  appointmentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSection: {
    marginRight: 16,
    alignItems: 'center',
    minWidth: 60,
  },
  dayText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  providerSection: {
    flex: 1,
  },
  providerName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  providerSpecialty: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  chevron: {
    fontSize: 24,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  browseButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});