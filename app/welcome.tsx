import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);

  const handleBrowseAsGuest = async () => {
    try {
      setGuestLoading(true);
      await signInAsGuest();
      // AuthContext will update user state → _layout.tsx navigates to /(tabs)
    } catch{
      Alert.alert('Error', 'Could not start guest session. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, { backgroundColor: colors.card }]}>
        <Image
          source={require('../assets/images/AccessCare-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.primary }]}>AccessCare</Text>
        <Text style={[styles.tagline, { color: colors.subtext }]}>
          Connecting Patients with Quality Healthcare
        </Text>

        <View style={styles.statsRow}>
          <StatCard number="23+" label="Providers" icon="👨‍⚕️" />
          <StatCard number="3" label="Categories" icon="📋" />
          <StatCard number="24/7" label="Support" icon="💬" />
        </View>
      </View>

      <View style={styles.featuresSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Bridging the Healthcare Gap</Text>
        <Text style={[styles.missionText, { color: colors.subtext }]}>
          Whether you are in a remote area or a busy city, AccessCare connects you to the care you need, when you need it.
        </Text>

        <FeatureCard icon="🌍" title="Find Nearby Care" description="Locate providers in your area, even in remote locations" gradient={['#667eea', '#764ba2']} />
        <FeatureCard icon="🔗" title="Direct Connection" description="Connect instantly with healthcare professionals" gradient={['#f093fb', '#f5576c']} />
        <FeatureCard icon="💬" title="Ask Questions" description="Get answers from professionals, no matter where you are" gradient={['#4facfe', '#00f2fe']} />
        <FeatureCard icon="🗺️" title="Navigate to Care" description="Turn-by-turn directions to your nearest provider" gradient={['#43e97b', '#38f9d7']} />
      </View>

      <View style={[styles.impactSection, { backgroundColor: colors.card }]}>
        <Text style={[styles.impactTitle, { color: colors.primary }]}>Healthcare Without Boundaries</Text>
        <Text style={[styles.impactText, { color: colors.subtext }]}>
          AccessCare breaks down barriers to healthcare access by connecting patients in underserved
          and remote communities with a comprehensive network of providers.
        </Text>
      </View>

      <View style={styles.ctaSection}>
        {/* Primary — Sign in */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/' as any)}
          activeOpacity={0.8}
          accessibilityLabel="Sign in to your account"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        {/* Secondary — Create account */}
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary, backgroundColor: colors.background }]}
          onPress={() => router.push('/signup' as any)}
          activeOpacity={0.8}
          accessibilityLabel="Create a new account"
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Create Account</Text>
        </TouchableOpacity>

        {/* Tertiary — Browse as guest */}
        <TouchableOpacity
          style={[styles.guestButton, { borderColor: colors.border }]}
          onPress={handleBrowseAsGuest}
          disabled={guestLoading}
          activeOpacity={0.7}
          accessibilityLabel="Browse providers without creating an account"
          accessibilityRole="button"
        >
          {guestLoading ? (
            <ActivityIndicator size="small" color={colors.subtext} />
          ) : (
            <Text style={[styles.guestButtonText, { color: colors.subtext }]}>
              Browse as Guest
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.guestNote, { color: colors.subtext }]}>
          Guest browsing lets you explore providers. Create a free account to book appointments.
        </Text>

        <Text style={[styles.footer, { color: colors.subtext }]}>
          Connecting communities to quality healthcare, one patient at a time
        </Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ number, label, icon }: { number: string; label: string; icon: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statNumber, { color: colors.primary }]}>{number}</Text>
      <Text style={[styles.statLabel, { color: colors.subtext }]}>{label}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, description, gradient }: {
  icon: string; title: string; description: string; gradient: string[];
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.featureCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: gradient[0] }]}>
        <Text style={styles.featureIcon}>{icon}</Text>
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: colors.subtext }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 80, paddingBottom: 40 },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 38, fontWeight: 'bold', marginBottom: 8 },
  tagline: { fontSize: 17, marginBottom: 30, textAlign: 'center', paddingHorizontal: 40 },
  statsRow: { flexDirection: 'row', gap: 15, paddingHorizontal: 20 },
  statCard: { flex: 1, borderRadius: 15, padding: 15, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statIcon: { fontSize: 24, marginBottom: 5 },
  statNumber: { fontSize: 22, fontWeight: 'bold', marginBottom: 3 },
  statLabel: { fontSize: 12 },
  featuresSection: { padding: 20, paddingTop: 30 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  missionText: { fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22, paddingHorizontal: 10 },
  featureCard: { flexDirection: 'row', padding: 18, borderRadius: 15, marginBottom: 15, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  featureIcon: { fontSize: 30 },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  featureDescription: { fontSize: 14, lineHeight: 20 },
  impactSection: { padding: 25, marginHorizontal: 20, borderRadius: 15, marginBottom: 20 },
  impactTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  impactText: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  ctaSection: { padding: 20, paddingTop: 10 },
  primaryButton: { paddingVertical: 18, borderRadius: 12, marginBottom: 15, shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  secondaryButton: { paddingVertical: 18, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  secondaryButtonText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  guestButton: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  guestButtonText: { fontSize: 16, fontWeight: '500' },
  guestNote: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18, paddingHorizontal: 10 },
  footer: { fontSize: 13, textAlign: 'center', fontStyle: 'italic', marginBottom: 20 },
});
