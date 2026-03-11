import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
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

  const handleSignup = async () => {
    const sanitizedEmail = sanitizeEmail(email);

    const validation = validateSignup({
      email: sanitizedEmail,
      password,
      confirmPassword,
    });

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      Alert.alert('Validation Error', firstError);
      return;
    }

    setLoading(true);
    try {
      if (isGuest) {
        // Guest upgrade — preserves UID and all Firestore data
        await upgradeGuest(sanitizedEmail, password);
        Alert.alert(
          'Account Created!',
          'Your guest session has been saved to your new account.',
        );
      } else {
        // Brand new signup
        await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
        Alert.alert('Success', 'Account created successfully!');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
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
        accessibilityLabel={isGuest ? 'Create account and save session' : 'Create account'}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  guestBanner: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, marginBottom: 20,
  },
  guestBannerText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input: { borderWidth: 2, borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 16 },
  signupButton: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  signupButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 16 },
  loginLink: { fontSize: 16, fontWeight: 'bold' },
});
