import { logBookingCancelledByPatient } from '../../utils/auditLog';
import { logAnalyticsEvent } from '../../utils/analytics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';
import {
  fireLocalNotification,
  getBookingStatusNotification,
  scheduleAppointmentReminder,
  cancelScheduledNotification,
} from '../../utils/notifications';

// ─── Patient cancellation reasons ─────────────────────────────────────────────
const PATIENT_CANCEL_REASONS = [
  { id: 'found_another',  label: 'Found another provider',       icon: '🔍' },
  { id: 'scheduling',     label: 'Scheduling conflict',          icon: '📅' },
  { id: 'feeling_better', label: 'Feeling better',               icon: '💪' },
  { id: 'cost',           label: 'Cost / affordability concern', icon: '💰' },
  { id: 'transportation', label: 'Transportation issue',         icon: '🚗' },
  { id: 'wait_too_long',  label: 'Wait time too long',           icon: '⏳' },
  { id: 'no_response',    label: 'Provider did not respond',     icon: '📵' },
  { id: 'mistake',        label: 'Booked by mistake',            icon: '🤷' },
  { id: 'other',          label: 'Other reason',                 icon: '💬' },
];

const STATUS_CONFIG: Record<string, {
  label: string; color: string; icon: string; message: string;
}> = {
  pending: {
    label: 'Pending Confirmation',
    color: '#F59E0B',
    icon: '⏳',
    message: "The provider will review your request shortly. You'll be notified when confirmed.",
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

function DetailRow({
  label, value, highlight, colors,
}: {
  label: string; value: string; highlight?: boolean; colors: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[
        styles.detailValue,
        { color: highlight ? colors.primary : colors.text },
      ]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Cancel Reason Modal ──────────────────────────────────────────────────────
const CancelReasonModal = ({
  visible, onClose, onConfirm, colors,
}: {
  visible: boolean; onClose: () => void;
  onConfirm: (reasonId: string, reasonLabel: string) => void;
  colors: any;
}) => {
  const [selectedReason, setSelectedReason] = useState('');

  const handleConfirm = () => {
    if (!selectedReason) { Alert.alert('Required', 'Please select a reason for cancelling.'); return; }
    const reason = PATIENT_CANCEL_REASONS.find((r) => r.id === selectedReason);
    onConfirm(selectedReason, reason?.label ?? selectedReason);
    setSelectedReason('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.text }]}>Why are you cancelling?</Text>
        <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>
          Your feedback helps improve the care experience. This stays private.
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
          {PATIENT_CANCEL_REASONS.map((reason) => {
            const isSelected = selectedReason === reason.id;
            return (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonOption, {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.background,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                }]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                <Text style={[styles.reasonLabel, {
                  color: isSelected ? colors.primary : colors.text,
                }]}>
                  {reason.label}
                </Text>
                {isSelected && (
                  <Text style={[styles.reasonCheck, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: colors.subtext }]}>Go Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: selectedReason ? '#EF4444' : colors.border }]}
            onPress={handleConfirm} disabled={!selectedReason}
          >
            <Text style={styles.modalConfirmText}>Cancel Appointment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { colors } = useTheme();

  const [booking, setBooking]           = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [cancelling, setCancelling]     = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const snapshotUnsubRef  = useRef<(() => void) | null>(null);
  // Track previous status to detect transitions and avoid re-notifying
  const prevStatusRef     = useRef<string | null>(null);
  // Store reminder notification ID so we can cancel it if booking is cancelled
  const reminderIdRef     = useRef<string | null>(null);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }

    const authUnsub = auth.onAuthStateChanged((user) => {
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }
      if (!user) { setBooking(null); setLoading(false); return; }

      const snapshotUnsub = onSnapshot(
        doc(db, 'bookings', bookingId),
        async (snap) => {
          if (!snap.exists()) { setBooking(null); setLoading(false); return; }

          const data = { id: snap.id, ...snap.data() };
          const newStatus  = (data as any).status;
          const prevStatus = prevStatusRef.current;

          setBooking(data);
          setLoading(false);

          // ── Notify on status transition ────────────────────────────────
          // Only fire when status actually changes (not on initial load)
          // and only when the current user is the booking owner.
          if (
            prevStatus !== null &&
            prevStatus !== newStatus &&
            auth.currentUser?.uid === (data as any).userId
          ) {
            const notification = getBookingStatusNotification(
              newStatus,
              (data as any).providerName || 'Your provider',
              formatDate((data as any).date),
              (data as any).time || '',
              (data as any).declineReason,
            );

            if (notification) {
              await fireLocalNotification({
                title: notification.title,
                body: notification.body,
                data: { bookingId, screen: 'confirmation' },
              });
            }

            // Schedule 24hr reminder when booking is confirmed
            if (newStatus === 'confirmed' && (data as any).date && (data as any).time) {
              const reminderId = await scheduleAppointmentReminder({
                bookingId,
                providerName: (data as any).providerName || 'Your provider',
                appointmentDate: (data as any).date,
                appointmentTime: (data as any).time,
              });
              if (reminderId) reminderIdRef.current = reminderId;
            }

            // Cancel scheduled reminder if booking is cancelled
            if (newStatus === 'cancelled' && reminderIdRef.current) {
              await cancelScheduledNotification(reminderIdRef.current);
              reminderIdRef.current = null;
            }
          }

          prevStatusRef.current = newStatus;
        },
        (error) => {
          if (error.code === 'permission-denied') { setLoading(false); return; }
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

  const handleCancelConfirmed = async (reasonId: string, reasonLabel: string) => {
    setShowCancelModal(false);
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'bookings', bookingId!), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'patient',
        patientCancelReasonId: reasonId,
        patientCancelReason: reasonLabel,
      });
      logBookingCancelledByPatient(auth.currentUser!.uid, bookingId!, reasonId);
      logAnalyticsEvent('booking_cancelled_by_patient', {
        reasonId,
        bookingId: bookingId!,
      });
      // onSnapshot updates the UI and fires cancel notification automatically
    } catch (error) {
      if (__DEV__) console.error('Cancel error:', error);
      Alert.alert('Error', 'Failed to cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
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

  const isForDependent = booking.bookingFor === 'dependent';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/appointments' as any)} accessibilityRole="button">
          <Text style={[styles.backText, { color: colors.primary }]}>← Appointments</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appointment Details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, {
          backgroundColor: statusConfig.color + '18',
          borderColor: statusConfig.color + '40',
        }]}>
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

        {/* Provider cancelled */}
        {cancelledByProvider && (
          <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: '#EF444430' }]}>
            <Text style={styles.reasonBoxLabel}>REASON FOR CANCELLATION</Text>
            <Text style={[styles.reasonBoxText, { color: colors.text }]}>{booking.declineReason}</Text>
            <Text style={[styles.reasonBoxNote, { color: colors.subtext }]}>— Provided by the provider</Text>
          </View>
        )}

        {/* Patient cancelled */}
        {booking.status === 'cancelled' && booking.cancelledBy === 'patient' && (
          <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: '#94A3B830' }]}>
            <Text style={[styles.reasonBoxLabel, { color: '#94A3B8' }]}>CANCELLED BY YOU</Text>
            {booking.patientCancelReason ? (
              <Text style={[styles.reasonBoxText, { color: colors.text }]}>{booking.patientCancelReason}</Text>
            ) : (
              <Text style={[styles.reasonBoxText, { color: colors.subtext }]}>You cancelled this appointment.</Text>
            )}
          </View>
        )}

        {/* Appointment Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Appointment</Text>
          <DetailRow label="Provider"  value={booking.providerName || '—'}    colors={colors} />
          <DetailRow label="Specialty" value={booking.providerSpecialty || '—'} colors={colors} />
          <DetailRow label="Date"      value={formatDate(booking.date)}         colors={colors} />
          <DetailRow label="Time"      value={booking.time || '—'}              colors={colors} />
          {!!booking.visitTypeLabel && (
            <DetailRow label="Visit Type" value={booking.visitTypeLabel} highlight colors={colors} />
          )}
          {!!booking.serviceCategoryLabel && (
            <DetailRow label="Service" value={booking.serviceCategoryLabel} highlight colors={colors} />
          )}
          {!!booking.reasonForVisit && (
            <DetailRow label="Reason" value={booking.reasonForVisit} colors={colors} />
          )}
        </View>

        {/* Patient Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Patient</Text>
          <DetailRow label="Name"  value={booking.patientName || '—'}  colors={colors} />
          {isForDependent && booking.isMinorPatient && (
            <DetailRow label="Type" value="Minor patient" colors={colors} />
          )}
          <DetailRow label="Phone" value={booking.patientPhone || '—'} colors={colors} />
          {booking.isMinorPatient && booking.guardianName && (
            <>
              <View style={[styles.divider, { borderColor: colors.border }]}>
                <Text style={[styles.dividerLabel, { color: colors.subtext }]}>Guardian</Text>
              </View>
              <DetailRow label="Guardian" value={booking.guardianName} colors={colors} />
              {!!booking.guardianPhone && (
                <DetailRow label="Guardian Phone" value={booking.guardianPhone} colors={colors} />
              )}
            </>
          )}
          {!!booking.notes && (
            <DetailRow label="Notes" value={booking.notes} colors={colors} />
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {canPatientCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: '#EF4444' }]}
              onPress={() => setShowCancelModal(true)}
              disabled={cancelling}
              accessibilityRole="button"
            >
              {cancelling
                ? <ActivityIndicator color="#EF4444" size="small" />
                : <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
              }
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

      <CancelReasonModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirmed}
        colors={colors}
      />
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
  reasonBox: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  reasonBoxLabel: { color: '#EF4444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  reasonBoxText: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  reasonBoxNote: { fontSize: 12, fontStyle: 'italic' },
  card: { borderRadius: 14, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16, opacity: 0.5, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' },
  detailLabel: { fontSize: 15 },
  detailValue: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  divider: { borderTopWidth: 1, paddingTop: 12, marginBottom: 12, marginTop: 2 },
  dividerLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  actions: { gap: 12, marginTop: 8 },
  cancelButton: { padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  primaryButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  outlineButton: { padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },
  ghostButton: { padding: 12, alignItems: 'center' },
  ghostButtonText: { fontSize: 14 },
  bookingId: { fontSize: 11, textAlign: 'center', marginTop: 24, opacity: 0.5 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  reasonOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 8,
  },
  reasonIcon: { fontSize: 20 },
  reasonLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  reasonCheck: { fontSize: 18, fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
