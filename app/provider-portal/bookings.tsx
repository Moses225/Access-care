import { logBookingConfirmed, logBookingDeclined } from '../../utils/auditLog';
import { useRouter } from 'expo-router';
import {
  collection, doc, getDoc, onSnapshot, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { auth,db } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';
import { sendExpoPushToUser } from '../../utils/notifications';

type Booking = {
  id: string;
  patientName: string;
  patientPhone: string;
  date: string;
  time: string;
  notes?: string;
  status: string;
  createdAt: any;
  userId?: string;
  providerName?: string;
  visitTypeLabel?: string;
  serviceCategoryLabel?: string;
  reasonForVisit?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#F59E0B', bg: '#F59E0B20' },
  confirmed: { label: 'Confirmed', color: '#22C55E', bg: '#22C55E20' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#EF444420' },
  completed: { label: 'Completed', color: '#818CF8', bg: '#818CF820' },
};

const DECLINE_REASONS = [
  'Schedule conflict — no availability on this date',
  'No longer accepting this insurance plan',
  'Appointment type not available at this location',
  'Please call our office to reschedule',
  'Provider is out of office',
  'Other',
];

function formatDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatDateLong(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

// ─── Helper: get provider's display name from Firestore ──────────────────────
async function getProviderName(providerId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'providers', providerId));
    if (snap.exists()) return snap.data().name || 'Your provider';
  } catch { /* non-critical */ }
  return 'Your provider';
}

export default function ProviderBookingsScreen() {
  const router = useRouter();
  const { providerProfile, isProvider, initializing } = useProviderAuth();

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<'pending' | 'confirmed' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Decline modal state
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineTarget, setDeclineTarget]             = useState<Booking | null>(null);
  const [selectedReason, setSelectedReason]           = useState('');
  const [otherReason, setOtherReason]                 = useState('');

  useEffect(() => {
    if (!initializing && !isProvider) {
      router.replace('/provider-portal/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, initializing]);

  useEffect(() => {
    if (!providerProfile?.providerId) return;

    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerProfile.providerId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Booking[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<Booking, 'id'>),
        }));
        data.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });
        setBookings(data);
        setLoading(false);
      },
      (error) => {
        if (__DEV__) console.error('Provider bookings error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [providerProfile?.providerId]);

  // ── Confirm booking + notify patient ───────────────────────────────────────
  const handleConfirm = (booking: Booking) => {
    Alert.alert(
      'Confirm Appointment',
      `Confirm ${booking.patientName} on ${formatDate(booking.date)} at ${booking.time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(booking.id);
            try {
              // 1. Update Firestore
              await updateDoc(doc(db, 'bookings', booking.id), {
                status: 'confirmed',
                confirmedAt: serverTimestamp(),
              });

              logBookingConfirmed(auth.currentUser!.uid, booking.id, providerProfile!.providerId);

              // 2. Send push notification to patient (fire and forget)
              if (booking.userId) {
                const providerName = booking.providerName
                  || await getProviderName(providerProfile!.providerId);

                sendExpoPushToUser({
                  userId: booking.userId,
                  title: '✅ Appointment Confirmed!',
                  body: `${providerName} confirmed your appointment on ${formatDateLong(booking.date)} at ${booking.time}.`,
                  data: {
                    bookingId: booking.id,
                    screen: 'confirmation',
                    type: 'booking_confirmed',
                  },
                }).catch((err) => {
                  if (__DEV__) console.warn('Push notification failed (non-critical):', err);
                });
              }
            } catch (error) {
              if (__DEV__) console.error('Confirm error:', error);
              Alert.alert('Error', 'Failed to confirm. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const openDeclineModal = (booking: Booking) => {
    setDeclineTarget(booking);
    setSelectedReason('');
    setOtherReason('');
    setDeclineModalVisible(true);
  };

  // ── Decline booking + notify patient ───────────────────────────────────────
  const submitDecline = async () => {
    if (!declineTarget) return;

    const reason = selectedReason === 'Other'
      ? otherReason.trim()
      : selectedReason;

    if (!reason) {
      Alert.alert('Reason Required', 'Please select or enter a reason for declining.');
      return;
    }

    setDeclineModalVisible(false);
    setActionLoading(declineTarget.id);

    try {
      // 1. Update Firestore
      await updateDoc(doc(db, 'bookings', declineTarget.id), {
        status: 'cancelled',
        declinedAt: serverTimestamp(),
        declineReason: reason,
        cancelledBy: 'provider',
      });
      logBookingDeclined(auth.currentUser!.uid, declineTarget.id, providerProfile!.providerId, selectedReason);

      // 2. Send push notification to patient (fire and forget)
      if (declineTarget.userId) {
        const providerName = declineTarget.providerName
          || await getProviderName(providerProfile!.providerId);

        sendExpoPushToUser({
          userId: declineTarget.userId,
          title: '❌ Appointment Declined',
          body: `${providerName} declined your appointment on ${formatDateLong(declineTarget.date)} at ${declineTarget.time}. Reason: ${reason}`,
          data: {
            bookingId: declineTarget.id,
            screen: 'confirmation',
            type: 'booking_declined',
          },
        }).catch((err) => {
          if (__DEV__) console.warn('Push notification failed (non-critical):', err);
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Decline error:', error);
      Alert.alert('Error', 'Failed to decline. Please try again.');
    } finally {
      setActionLoading(null);
      setDeclineTarget(null);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#14B8A6" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Requests</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {(['pending', 'confirmed', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <Text style={styles.filterCount}>
                  {' '}({bookings.filter(b => b.status === f).length})
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{filter === 'pending' ? '🎉' : '📅'}</Text>
          <Text style={styles.emptyTitle}>
            {filter === 'pending' ? 'All caught up!' : `No ${filter} appointments`}
          </Text>
          <Text style={styles.emptySubtext}>
            {filter === 'pending'
              ? 'No pending requests at the moment'
              : `You have no ${filter} appointments`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const isActioning = actionLoading === item.id;

            return (
              <View style={styles.bookingCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.patientName}>{item.patientName}</Text>
                    <Text style={styles.patientPhone}>{item.patientPhone}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Visit type / service */}
                {(item.visitTypeLabel || item.serviceCategoryLabel) && (
                  <View style={styles.visitTypeRow}>
                    {item.visitTypeLabel && (
                      <View style={styles.visitTypePill}>
                        <Text style={styles.visitTypePillText}>{item.visitTypeLabel}</Text>
                      </View>
                    )}
                    {item.serviceCategoryLabel && (
                      <View style={[styles.visitTypePill, { backgroundColor: '#14B8A620' }]}>
                        <Text style={[styles.visitTypePillText, { color: '#14B8A6' }]}>
                          {item.serviceCategoryLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.dateTimeRow}>
                  <View style={styles.dateTimeItem}>
                    <Text style={styles.dateTimeLabel}>DATE</Text>
                    <Text style={styles.dateTimeValue}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.dateTimeDivider} />
                  <View style={styles.dateTimeItem}>
                    <Text style={styles.dateTimeLabel}>TIME</Text>
                    <Text style={styles.dateTimeValue}>{item.time}</Text>
                  </View>
                </View>

                {/* Reason for visit */}
                {item.reasonForVisit ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>REASON FOR VISIT</Text>
                    <Text style={styles.notesText}>{item.reasonForVisit}</Text>
                  </View>
                ) : item.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>PATIENT NOTES</Text>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                {item.status === 'pending' && (
                  <View style={styles.actions}>
                    {isActioning ? (
                      <ActivityIndicator color="#14B8A6" style={{ flex: 1 }} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => openDeclineModal(item)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.declineButtonText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.confirmButton}
                          onPress={() => handleConfirm(item)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.confirmButtonText}>Confirm →</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Decline Reason Modal */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclineModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reason for Declining</Text>
            <Text style={styles.modalSubtitle}>
              Select a reason — this helps patients understand next steps.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.reasonsScroll}
            >
              {DECLINE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  accessibilityRole="button"
                >
                  <View style={[
                    styles.reasonRadio,
                    selectedReason === reason && styles.reasonRadioSelected,
                  ]} />
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {selectedReason === 'Other' && (
                <TextInput
                  style={styles.otherInput}
                  placeholder="Please describe the reason..."
                  placeholderTextColor="#475569"
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />
              )}
              <View style={{ height: 8 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeclineModalVisible(false)}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeclineButton,
                  !selectedReason && styles.modalDeclineButtonDisabled,
                ]}
                onPress={submitDecline}
                disabled={!selectedReason}
                accessibilityRole="button"
              >
                <Text style={styles.modalDeclineText}>Decline Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 64, paddingBottom: 16, paddingHorizontal: 20, gap: 8 },
  backText: { color: '#14B8A6', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700' },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  filterTab: { paddingVertical: 14, paddingHorizontal: 16, marginRight: 4 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: '#14B8A6' },
  filterTabText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  filterTabTextActive: { color: '#14B8A6' },
  filterCount: { color: '#475569', fontWeight: '400' },
  list: { padding: 20, gap: 12 },
  bookingCard: {
    backgroundColor: '#1E293B', borderRadius: 14,
    borderWidth: 1, borderColor: '#334155',
    padding: 20, gap: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flex: 1, marginRight: 12 },
  patientName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  patientPhone: { color: '#64748B', fontSize: 13 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  visitTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  visitTypePill: {
    backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  visitTypePillText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  dateTimeRow: {
    flexDirection: 'row', backgroundColor: '#0F172A',
    borderRadius: 10, overflow: 'hidden',
  },
  dateTimeItem: { flex: 1, padding: 14, alignItems: 'center' },
  dateTimeDivider: { width: 1, backgroundColor: '#1E293B' },
  dateTimeLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  dateTimeValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  notesBox: { backgroundColor: '#0F172A', borderRadius: 10, padding: 14 },
  notesLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  notesText: { color: '#94A3B8', fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  declineButton: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  declineButtonText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  confirmButton: {
    flex: 2, padding: 14, borderRadius: 10,
    backgroundColor: '#14B8A6', alignItems: 'center',
  },
  confirmButtonText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: '#475569', fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
  },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalSubtitle: { color: '#64748B', fontSize: 13, marginBottom: 16 },
  reasonsScroll: { maxHeight: 360 },
  reasonOption: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#334155', marginBottom: 8,
  },
  reasonOptionSelected: { borderColor: '#EF4444', backgroundColor: '#EF444410' },
  reasonRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#475569',
    marginRight: 12, flexShrink: 0,
  },
  reasonRadioSelected: { borderColor: '#EF4444', backgroundColor: '#EF4444' },
  reasonText: { color: '#94A3B8', fontSize: 14, flex: 1 },
  reasonTextSelected: { color: '#F8FAFC' },
  otherInput: {
    backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 14,
    color: '#F8FAFC', fontSize: 14, minHeight: 80, marginBottom: 8,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancelButton: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  modalCancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  modalDeclineButton: {
    flex: 2, padding: 14, borderRadius: 10,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalDeclineButtonDisabled: { opacity: 0.4 },
  modalDeclineText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
