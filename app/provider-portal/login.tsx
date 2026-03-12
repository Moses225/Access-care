import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { auth } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';

export default function ProviderLoginScreen() {
  const router = useRouter();
  const { isProvider, initializing } = useProviderAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initializing && isProvider) {
      router.replace('/provider-portal/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, initializing]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Sign out any existing patient session before provider login
      await signOut(auth).catch(() => {});
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // ProviderAuthContext will detect the claim and redirect via useEffect
    } catch (err: any) {
      if (__DEV__) console.error('Provider login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
      await signOut(auth).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#14B8A6" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo mark */}
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>AC</Text>
          </View>
          <Text style={styles.logoTitle}>AccessCare</Text>
          <View style={styles.portalBadge}>
            <Text style={styles.portalBadgeText}>PROVIDER PORTAL</Text>
          </View>
        </View>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>
          Sign in to manage your listing and appointments
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@practice.com"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              accessibilityLabel="Email address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#475569"
              secureTextEntry
              editable={!loading}
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in to provider portal"
          >
            {loading ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In →</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Not a provider? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.footerLink}>Patient app →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.accessNote}>
          Provider access is by invitation only.{'\n'}
          Contact support@accesscare.app to get set up.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoMark: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: '#14B8A6',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  logoMarkText: { color: '#0F172A', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  logoTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  portalBadge: {
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
  },
  portalBadgeText: { color: '#14B8A6', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  heading: { color: '#F8FAFC', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subheading: { color: '#64748B', fontSize: 15, lineHeight: 22, marginBottom: 32 },
  form: { gap: 20 },
  errorBanner: {
    backgroundColor: '#450A0A', borderWidth: 1, borderColor: '#7F1D1D',
    borderRadius: 8, padding: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 14 },
  inputGroup: { gap: 8 },
  inputLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 16,
    color: '#F8FAFC', fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#14B8A6',
    borderRadius: 10, padding: 18,
    alignItems: 'center', marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#475569', fontSize: 14 },
  footerLink: { color: '#14B8A6', fontSize: 14, fontWeight: '600' },
  accessNote: {
    color: '#334155', fontSize: 12, textAlign: 'center',
    marginTop: 24, lineHeight: 18,
  },
});
