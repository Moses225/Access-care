import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

const STATUS_CONFIG: Record<string, {
  label: string; color: string; icon: string; message: string;
}> = {
  pending: {
    label: 'Pending Confirmation',
    color: '#F59E0B',
    icon: '⏳',
    message: "The provider will review your request shortly. You'll receive an SMS when confirmed.",
  },
  confirmed: {
    label: 'Confirmed',
    color: '#22C55E',
    icon: '✅',
    message: 'Your appointment is confirmed! Please arrive 10 minutes early.',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    icon: '❌',
    message: 'This appointment was cancelled. You can book a new appointment with this provider.',
  },
  completed: {
    label: 'Completed',
    color: '#818CF8',
    icon: '🎉',
    message: 'This appointment has been completed. We hope your visit went well.',
  },
};

function formatDate(dateString: string): string {
  if (!dateString || !dateString.includes('-')) return dateString || '—';
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateString;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { colors } = useTheme();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const snapshotUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    // Wrap in auth listener so the Firestore snapshot tears down
    // cleanly when the user switches between patient and provider accounts
    const authUnsub = auth.onAuthStateChanged((user) => {
      // Clean up existing Firestore listener whenever auth changes
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }

      if (!user) {
        setBooking(null);
        setLoading(false);
        return;
      }

      const snapshotUnsub = onSnapshot(
        doc(db, 'bookings', bookingId),
        (snap) => {
          if (snap.exists()) {
            setBooking({ id: snap.id, ...snap.data() });
          } else {
            setBooking(null);
          }
          setLoading(false);
        },
        (error) => {
          // permission-denied fires when auth switches mid-session — not a real error
          if (error.code === 'permission-denied') {
            setLoading(false);
            return;
          }
          if (__DEV__) console.error('Error loading booking:', error);
          setLoading(false);
        }
      );

      snapshotUnsubRef.current = snapshotUnsub;
    });

    return () => {
      authUnsub();
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }
    };
  }, [bookingId]);

  const handleCancel = () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be signed in to cancel.');
      return;
    }
    if (booking?.userId !== user.uid) {
      Alert.alert('Error', 'You can only cancel your own appointments.');
      return;
    }

    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await updateDoc(doc(db, 'bookings', bookingId!), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: 'patient',
              });
              // onSnapshot updates the UI automatically
            } catch (error) {
              if (__DEV__) console.error('Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Booking not found</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={() => router.push('/(tabs)/appointments' as any)}
        >
          <Text style={styles.primaryButtonText}>Back to Appointments</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  const cancelledByProvider =
    booking.status === 'cancelled' &&
    booking.cancelledBy !== 'patient' &&
    typeof booking.declineReason === 'string' &&
    booking.declineReason.length > 0;

  const canPatientCancel =
    booking.status === 'pending' &&
    auth.currentUser?.uid === booking.userId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/appointments' as any)}
          accessibilityRole="button"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Appointments</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appointment Details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          {
            backgroundColor: statusConfig.color + '18',
            borderColor: statusConfig.color + '40',
          },
        ]}>
          <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
          <View style={styles.statusBannerText}>
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={[styles.statusMessage, { color: colors.subtext }]}>
              {statusConfig.message}
            </Text>
          </View>
        </View>

        {/* Provider declined — show reason */}
        {cancelledByProvider && (
          <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: '#EF444430' }]}>
            <Text style={styles.reasonBoxLabel}>REASON FOR CANCELLATION</Text>
            <Text style={[styles.reasonBoxText, { color: colors.text }]}>
              {booking.declineReason}
            </Text>
            <Text style={[styles.reasonBoxNote, { color: colors.subtext }]}>
              — Provided by the provider
            </Text>
          </View>
        )}

        {/* Patient cancelled themselves */}
        {booking.status === 'cancelled' && booking.cancelledBy === 'patient' && (
          <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: '#94A3B830' }]}>
            <Text style={[styles.reasonBoxLabel, { color: '#94A3B8' }]}>CANCELLED BY YOU</Text>
            <Text style={[styles.reasonBoxText, { color: colors.subtext }]}>
              You cancelled this appointment.
            </Text>
          </View>
        )}

        {/* Appointment Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Appointment</Text>
          <DetailRow label="Provider" value={booking.providerName || '—'} colors={colors} />
          <DetailRow label="Specialty" value={booking.providerSpecialty || '—'} colors={colors} />
          <DetailRow label="Date" value={formatDate(booking.date)} colors={colors} />
          <DetailRow label="Time" value={booking.time || '—'} colors={colors} />
        </View>

        {/* Patient Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Patient</Text>
          <DetailRow label="Name" value={booking.patientName || '—'} colors={colors} />
          <DetailRow label="Phone" value={booking.patientPhone || '—'} colors={colors} />
          {booking.notes ? (
            <DetailRow label="Notes" value={booking.notes} colors={colors} />
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {canPatientCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: '#EF4444' }]}
              onPress={handleCancel}
              disabled={cancelling}
              accessibilityRole="button"
            >
              {cancelling ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
              )}
            </TouchableOpacity>
          )}

          {booking.status === 'cancelled' && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/booking/${booking.providerId}` as any)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Book Again with This Provider</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => router.push(`/provider/${booking.providerId}` as any)}
            accessibilityRole="button"
          >
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>View Provider</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => router.push('/(tabs)/appointments' as any)}
            accessibilityRole="button"
          >
            <Text style={[styles.ghostButtonText, { color: colors.subtext }]}>← All Appointments</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.bookingId, { color: colors.subtext }]}>
          Booking ID: {booking.id}
        </Text>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: 'bold' },
  scroll: { padding: 16, paddingBottom: 48 },
  errorText: { fontSize: 18 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  statusIcon: { fontSize: 28, marginTop: 2 },
  statusBannerText: { flex: 1 },
  statusLabel: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  statusMessage: { fontSize: 13, lineHeight: 18 },

  reasonBox: {
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  reasonBoxLabel: {
    color: '#EF4444', fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8,
  },
  reasonBoxText: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  reasonBoxNote: { fontSize: 12, fontStyle: 'italic' },

  card: { borderRadius: 14, padding: 20, marginBottom: 16 },
  cardTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 16, opacity: 0.5, textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap',
  },
  detailLabel: { fontSize: 15 },
  detailValue: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },

  actions: { gap: 12, marginTop: 8 },
  cancelButton: {
    padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2,
  },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  primaryButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  outlineButton: { padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },
  ghostButton: { padding: 12, alignItems: 'center' },
  ghostButtonText: { fontSize: 14 },

  bookingId: { fontSize: 11, textAlign: 'center', marginTop: 24, opacity: 0.5 },
});
