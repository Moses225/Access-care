import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { auth, db } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';

type BookingSummary = {
  total: number;
  pending: number;
  confirmed: number;
  today: number;
};

export default function ProviderDashboard() {
  const router = useRouter();
  const { providerProfile, isProvider, initializing, refreshProfile } = useProviderAuth();
  const [bookingSummary, setBookingSummary] = useState<BookingSummary>({
    total: 0, pending: 0, confirmed: 0, today: 0,
  });
  const [acceptingPatients, setAcceptingPatients] = useState(true);
  const [togglingAccepting, setTogglingAccepting] = useState(false);

  useEffect(() => {
    if (!initializing && !isProvider) {
      router.replace('/provider-portal/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, initializing]);

  useEffect(() => {
    if (providerProfile) {
      setAcceptingPatients(providerProfile.acceptingPatients);
    }
  }, [providerProfile]);

  useEffect(() => {
    if (!providerProfile?.providerId) return;

    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerProfile.providerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const today = new Date().toISOString().split('T')[0];
      let pending = 0, confirmed = 0, todayCount = 0;

      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.status === 'pending') pending++;
        if (data.status === 'confirmed') confirmed++;
        if (data.date === today && data.status !== 'cancelled') todayCount++;
      });

      setBookingSummary({
        total: snapshot.docs.length,
        pending, confirmed, today: todayCount,
      });
    });

    return unsubscribe;
  }, [providerProfile?.providerId]);

  const handleToggleAccepting = async (value: boolean) => {
    if (!providerProfile?.providerId) return;
    setTogglingAccepting(true);
    try {
      await updateDoc(doc(db, 'providers', providerProfile.providerId), {
        acceptingPatients: value,
      });
      setAcceptingPatients(value);
      await refreshProfile();
    } catch (error) {
      if (__DEV__) console.error('Error toggling accepting:', error);
      Alert.alert('Error', 'Failed to update status.');
      setAcceptingPatients(!value);
    } finally {
      setTogglingAccepting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/provider-portal/login');
        },
      },
    ]);
  };

  if (initializing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#14B8A6" size="large" />
      </View>
    );
  }

  const initials = providerProfile?.name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>
            {getGreeting()},
          </Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {providerProfile?.name || 'Doctor'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutButton}
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Accepting patients toggle */}
        <View style={styles.acceptingCard}>
          <View style={styles.acceptingLeft}>
            <View style={[
              styles.statusDot,
              { backgroundColor: acceptingPatients ? '#22C55E' : '#EF4444' }
            ]} />
            <View>
              <Text style={styles.acceptingLabel}>Accepting New Patients</Text>
              <Text style={styles.acceptingSubtext}>
                {acceptingPatients
                  ? 'Your listing is live and visible to patients'
                  : 'You are hidden from new patient searches'}
              </Text>
            </View>
          </View>
          {togglingAccepting ? (
            <ActivityIndicator color="#14B8A6" size="small" />
          ) : (
            <Switch
              value={acceptingPatients}
              onValueChange={handleToggleAccepting}
              trackColor={{ false: '#334155', true: '#14B8A6' }}
              thumbColor="#F8FAFC"
              accessibilityLabel="Toggle accepting new patients"
            />
          )}
        </View>

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>THIS MONTH</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Requests" value={bookingSummary.total} color="#14B8A6" />
          <StatCard label="Pending" value={bookingSummary.pending} color="#F59E0B" />
          <StatCard label="Confirmed" value={bookingSummary.confirmed} color="#22C55E" />
          <StatCard label="Today" value={bookingSummary.today} color="#818CF8" />
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="📋"
            label="Booking Requests"
            sublabel={bookingSummary.pending > 0 ? `${bookingSummary.pending} pending` : 'All caught up'}
            urgent={bookingSummary.pending > 0}
            onPress={() => router.push('/provider-portal/bookings')}
          />
          <ActionCard
            icon="👤"
            label="Edit Profile"
            sublabel="Update your listing"
            onPress={() => router.push('/provider-portal/profile')}
          />
        </View>

        {/* Provider info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Your Listing</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SPECIALTY</Text>
            <Text style={styles.infoValue}>{providerProfile?.specialty || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>STATUS</Text>
            <View style={[
              styles.statusPill,
              { backgroundColor: acceptingPatients ? '#14B8A620' : '#EF444420' }
            ]}>
              <Text style={[
                styles.statusPillText,
                { color: acceptingPatients ? '#14B8A6' : '#EF4444' }
              ]}>
                {acceptingPatients ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, label, sublabel, onPress, urgent }: {
  icon: string; label: string; sublabel: string;
  onPress: () => void; urgent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[actionStyles.card, urgent && actionStyles.cardUrgent]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={actionStyles.icon}>{icon}</Text>
      <Text style={actionStyles.label}>{label}</Text>
      <Text style={[actionStyles.sublabel, urgent && { color: '#F59E0B' }]}>{sublabel}</Text>
      <Text style={actionStyles.arrow}>→</Text>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155',
    alignItems: 'center', minWidth: '45%',
  },
  value: { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  label: { color: '#64748B', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

const actionStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#1E293B',
    borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#334155',
  },
  cardUrgent: { borderColor: '#F59E0B40', backgroundColor: '#1E293B' },
  icon: { fontSize: 28, marginBottom: 12 },
  label: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sublabel: { color: '#64748B', fontSize: 13 },
  arrow: { color: '#14B8A6', fontSize: 18, fontWeight: '700', marginTop: 12 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 64, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerGreeting: { color: '#64748B', fontSize: 14, marginBottom: 2 },
  headerName: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', maxWidth: 220 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#14B8A620', borderWidth: 1, borderColor: '#14B8A6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#14B8A6', fontSize: 14, fontWeight: '700' },
  signOutButton: { paddingVertical: 4 },
  signOutText: { color: '#475569', fontSize: 13 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 20 },
  acceptingCard: {
    backgroundColor: '#1E293B', borderRadius: 14,
    borderWidth: 1, borderColor: '#334155',
    padding: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  acceptingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  acceptingLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  acceptingSubtext: { color: '#64748B', fontSize: 12, lineHeight: 16 },
  sectionTitle: {
    color: '#475569', fontSize: 11,
    fontWeight: '700', letterSpacing: 1.5,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  infoCard: {
    backgroundColor: '#1E293B', borderRadius: 14,
    borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
  },
  infoCardTitle: {
    color: '#F8FAFC', fontSize: 16, fontWeight: '700',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  infoLabel: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  infoValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '500' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 13, fontWeight: '600' },
});
