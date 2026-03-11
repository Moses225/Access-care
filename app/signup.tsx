import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { sanitizeEmail, validateSignup } from '../utils/validation';
import { logError } from '../utils/crashReporting';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest, upgradeGuest } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSignup = async () => {
    const sanitizedEmail = sanitizeEmail(email);

    const validation = validateSignup({ email: sanitizedEmail, password, confirmPassword });
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      Alert.alert('Validation Error', firstError);
      return;
    }

    setLoading(true);
    try {
      if (isGuest) {
        await upgradeGuest(sanitizedEmail, password);
        // Send verification email to newly upgraded account
        const currentUser = auth.currentUser;
        if (currentUser && !currentUser.emailVerified) {
          await sendEmailVerification(currentUser);
          setVerificationSent(true);
        }
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
        await sendEmailVerification(user);
        setVerificationSent(true);
      }
    } catch (error: any) {
      logError(error, 'Signup');

      let errorMessage = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters.';
      }

      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ─── Verification sent screen ──────────────────────────────────────────────
  if (verificationSent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.verificationContainer}>
          <Text style={styles.verificationIcon}>📧</Text>
          <Text style={[styles.verificationTitle, { color: colors.text }]}>
            Check Your Email
          </Text>
          <Text style={[styles.verificationText, { color: colors.subtext }]}>
            We sent a verification link to{'\n'}
            <Text style={{ fontWeight: 'bold', color: colors.text }}>{email}</Text>
            {'\n\n'}
            Click the link in your email to verify your account. You can still use the app while you wait.
          </Text>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(tabs)/'  as any)}
            accessibilityRole="button"
          >
            <Text style={styles.continueButtonText}>Continue to App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, { borderColor: colors.border }]}
            onPress={async () => {
              const currentUser = auth.currentUser;
              if (currentUser) {
                try {
                  await sendEmailVerification(currentUser);
                  Alert.alert('Sent', 'Verification email resent.');
                } catch {
                  Alert.alert('Error', 'Could not resend. Please try again later.');
                }
              }
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.resendButtonText, { color: colors.subtext }]}>
              Resend verification email
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Signup form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../assets/images/AccessCare-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={[styles.title, { color: colors.text }]}>
          {isGuest ? 'Save Your Session' : 'Create Account'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {isGuest
            ? 'Create a free account to book appointments and save providers'
            : 'Join AccessCare today'}
        </Text>

        {isGuest && (
          <View style={[styles.guestBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
            <Text style={[styles.guestBannerText, { color: colors.primary }]}>
              Your browsing history will be preserved when you create your account.
            </Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Email"
          placeholderTextColor={colors.subtext}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          accessibilityLabel="Email address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={colors.subtext}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          accessibilityLabel="Password"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Confirm Password"
          placeholderTextColor={colors.subtext}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
          onSubmitEditing={handleSignup}
          accessibilityLabel="Confirm password"
        />

        <TouchableOpacity
          style={[styles.signupButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.signupButtonText}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.subtext }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/')} disabled={loading}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  guestBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20 },
  guestBannerText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input: { borderWidth: 2, borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 16 },
  signupButton: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  signupButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 16 },
  loginLink: { fontSize: 16, fontWeight: 'bold' },
  // Verification screen
  verificationContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  verificationIcon: { fontSize: 80, marginBottom: 24 },
  verificationTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  verificationText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  continueButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 16 },
  continueButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  resendButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1 },
  resendButtonText: { fontSize: 15 },
});
