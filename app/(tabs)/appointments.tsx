import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  visitTypeLabel?: string;
  serviceCategoryLabel?: string;
  reasonForVisit?: string;
  bookingFor?: 'self' | 'dependent';
  isMinorPatient?: boolean;
  declineReason?: string;
  cancelledBy?: string;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending Confirmation', color: '#F59E0B', icon: '⏳' },
  confirmed: { label: 'Confirmed',            color: '#22C55E', icon: '✅' },
  cancelled: { label: 'Cancelled',            color: '#EF4444', icon: '❌' },
  completed: { label: 'Completed',            color: '#818CF8', icon: '🎉' },
};

function formatDateParts(dateStr: string): { weekday: string; monthDay: string } {
  if (!dateStr || !dateStr.includes('-')) return { weekday: '—', monthDay: '—' };
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return { weekday: '—', monthDay: '—' };
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const snapshotUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }

    const authUnsub = auth.onAuthStateChanged((user) => {
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }

      if (!user || user.isAnonymous) {
        setAppointments([]); setLoading(false); return;
      }

      user.getIdTokenResult().then((tokenResult) => {
        if (tokenResult.claims.provider === true) {
          setAppointments([]); setLoading(false); return;
        }

        const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));

        const snapshotUnsub = onSnapshot(q,
          (snapshot) => {
            const list: Appointment[] = snapshot.docs.map(d => ({
              id: d.id,
              ...(d.data() as Omit<Appointment, 'id'>),
            }));

            list.sort((a, b) => {
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (a.status !== 'pending' && b.status === 'pending') return 1;
              const aTime = a.date ? new Date(a.date.replace(/-/g, '/')).getTime() : 0;
              const bTime = b.date ? new Date(b.date.replace(/-/g, '/')).getTime() : 0;
              return bTime - aTime;
            });

            setAppointments(list);
            setLoading(false);
          },
          (error) => {
            if (__DEV__) console.error('Appointments error:', error);
            setLoading(false);
          }
        );

        snapshotUnsubRef.current = snapshotUnsub;
      }).catch(() => setLoading(false));
    });

    return () => {
      authUnsub();
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }
    };
  }, [isGuest]);

  const today = new Date().toISOString().split('T')[0];
  const filteredAppointments = appointments.filter((a) => {
    if (filter === 'upcoming') return a.date >= today && a.status !== 'cancelled';
    if (filter === 'past') return a.date < today || a.status === 'completed' || a.status === 'cancelled';
    return true;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePrompt(true)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Create Free Account</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Appointments</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {appointments.length > 0
            ? `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`
            : 'Your scheduled visits'}
        </Text>

        <View style={styles.filterTabs}>
          {(['upcoming', 'all', 'past'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, {
                backgroundColor: filter === tab ? colors.primary : colors.background,
                borderColor: colors.border,
              }]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterTabText, {
                color: filter === tab ? '#fff' : colors.subtext,
              }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filteredAppointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'upcoming' ? 'No upcoming appointments' : 'No appointments found'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            {filter === 'upcoming'
              ? 'Book your next appointment to get started'
              : 'Try switching to a different filter'}
          </Text>
          {filter === 'upcoming' && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/' as any)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Browse Providers</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const { weekday, monthDay } = formatDateParts(item.date);
            const cancelledByProvider =
              item.status === 'cancelled' &&
              item.cancelledBy !== 'patient' &&
              !!item.declineReason;
            const isForDependent = item.bookingFor === 'dependent';

            return (
              <TouchableOpacity
                style={[styles.card, {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: statusConfig.color,
                }]}
                onPress={() => router.push(`/booking/confirmation?bookingId=${item.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View appointment with ${item.providerName}`}
              >
                {/* Date column */}
                <View style={[styles.dateColumn, { borderRightColor: colors.border }]}>
                  <Text style={[styles.dateDay, { color: colors.subtext }]}>{weekday}</Text>
                  <Text style={[styles.dateNum, { color: colors.text }]}>{monthDay}</Text>
                  <Text style={[styles.dateTime, { color: colors.primary }]}>{item.time}</Text>
                </View>

                {/* Main info */}
                <View style={styles.infoColumn}>
                  <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
                    {item.providerName}
                  </Text>
                  <Text style={[styles.providerSpecialty, { color: colors.primary }]} numberOfLines={1}>
                    {item.providerSpecialty}
                  </Text>

                  {/* Dependent tag */}
                  {isForDependent && item.patientName && (
                    <View style={[styles.patientTag, { backgroundColor: '#3B82F615' }]}>
                      <Text style={[styles.patientTagText, { color: '#3B82F6' }]}>
                        👤 For: {item.patientName}{item.isMinorPatient ? ' (Minor)' : ''}
                      </Text>
                    </View>
                  )}

                  {/* Visit type */}
                  {item.visitTypeLabel && (
                    <Text style={[styles.visitType, { color: colors.text }]} numberOfLines={1}>
                      🩺 {item.visitTypeLabel}
                    </Text>
                  )}

                  {/* Specific service — new */}
                  {item.serviceCategoryLabel && (
                    <Text style={[styles.serviceCategory, { color: colors.primary }]} numberOfLines={1}>
                      › {item.serviceCategoryLabel}
                    </Text>
                  )}

                  {/* Reason */}
                  {item.reasonForVisit && (
                    <Text style={[styles.reasonText, { color: colors.subtext }]} numberOfLines={1}>
                      {item.reasonForVisit}
                    </Text>
                  )}

                  {/* Status pill */}
                  <View style={[styles.statusPill, { backgroundColor: statusConfig.color + '20' }]}>
                    <Text style={styles.statusPillIcon}>{statusConfig.icon}</Text>
                    <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>

                  {/* Decline reason preview */}
                  {cancelledByProvider && (
                    <Text style={[styles.declinePreview, { color: colors.subtext }]} numberOfLines={1}>
                      Reason: {item.declineReason}
                    </Text>
                  )}
                </View>

                <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  filterTabs: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterTabText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'stretch',
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden',
  },
  dateColumn: {
    width: 72, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', borderRightWidth: 1,
  },
  dateDay: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  dateNum: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  dateTime: { fontSize: 13, fontWeight: '600' },
  infoColumn: { flex: 1, padding: 14, gap: 3 },
  providerName: { fontSize: 15, fontWeight: '700' },
  providerSpecialty: { fontSize: 13, fontWeight: '600' },
  patientTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  patientTagText: { fontSize: 11, fontWeight: '600' },
  visitType: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  serviceCategory: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  reasonText: { fontSize: 12, lineHeight: 16, fontStyle: 'italic', marginTop: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, marginTop: 4,
  },
  statusPillIcon: { fontSize: 11 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  declinePreview: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  chevron: { fontSize: 24, paddingHorizontal: 12, alignSelf: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 80, marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  primaryButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
});
