import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text,
  TouchableOpacity, View, FlatList,
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
  declineReason?: string;
  cancelledBy?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#F59E0B', icon: '⏳' },
  confirmed: { label: 'Confirmed', color: '#22C55E', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: '❌' },
  completed: { label: 'Completed', color: '#818CF8', icon: '🎉' },
};

export default function AppointmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }

    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    // Real-time listener — status changes appear immediately
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Appointment[] = snapshot.docs.map(d => ({
        id: d.id, ...(d.data() as Omit<Appointment, 'id'>),
      }));
      list.sort((a, b) => {
        // Sort: pending first, then by date descending
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime();
      });
      setAppointments(list);
      setLoading(false);
    }, (error) => {
      if (__DEV__) console.error('Appointments error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [isGuest]);

  // Timezone-safe date formatting
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

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
        <GuestUpgradePrompt visible={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} reason="manage appointments" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Appointments</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {appointments.length > 0 ? `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}` : 'Your scheduled visits'}
        </Text>
      </View>

      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No appointments yet</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Book your first appointment to get started
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/' as any)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Browse Providers</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const isCancelledByProvider = item.status === 'cancelled'
              && item.cancelledBy !== 'patient'
              && item.declineReason;

            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/booking/confirmation?bookingId=${item.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View appointment with ${item.providerName}`}
              >
                {/* Date + time column */}
                <View style={[styles.dateColumn, { borderRightColor: colors.border }]}>
                  <Text style={[styles.dateDay, { color: colors.subtext }]}>
                    {formatDate(item.date).split(',')[0]}
                  </Text>
                  <Text style={[styles.dateNum, { color: colors.text }]}>
                    {new Date(item.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
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

                  {/* Status pill */}
                  <View style={[styles.statusPill, { backgroundColor: statusConfig.color + '20' }]}>
                    <Text style={styles.statusPillIcon}>{statusConfig.icon}</Text>
                    <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>

                  {/* Decline reason preview */}
                  {isCancelledByProvider && (
                    <Text style={[styles.declinePreview, { color: colors.subtext }]} numberOfLines={1}>
                      Reason: {item.declineReason}
                    </Text>
                  )}
                </View>

                {/* Chevron */}
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
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  list: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  dateColumn: {
    width: 72, paddingVertical: 16, alignItems: 'center',
    borderRightWidth: 1,
  },
  dateDay: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  dateNum: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  dateTime: { fontSize: 13, fontWeight: '600' },
  infoColumn: { flex: 1, padding: 14, gap: 4 },
  providerName: { fontSize: 16, fontWeight: '700' },
  providerSpecialty: { fontSize: 13, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, marginTop: 4,
  },
  statusPillIcon: { fontSize: 11 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  declinePreview: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  chevron: { fontSize: 24, paddingHorizontal: 12 },

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
