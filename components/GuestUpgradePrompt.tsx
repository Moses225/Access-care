import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

type Props = {
  visible: boolean;
  onClose: () => void;
  reason?: string; // e.g. "book appointments" or "save providers"
};

export function GuestUpgradePrompt({ visible, onClose, reason = 'access this feature' }: Props) {
  const { upgradeGuest } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      await upgradeGuest(email.trim().toLowerCase(), password);
      onClose();
      Alert.alert(
        'Account Created!',
        'Your guest session has been saved to your new account.',
      );
    } catch (error: any) {
      if (__DEV__) console.error('Upgrade error:', error);

      let message = 'Could not create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      }

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInInstead = () => {
    onClose();
    router.push('/');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>

          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <Text style={[styles.title, { color: colors.text }]}>
            Create a Free Account
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            You need an account to {reason}. It only takes 30 seconds — and your browsing session is preserved.
          </Text>

          {/* Inputs */}
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Email address"
            placeholderTextColor={colors.subtext}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            accessibilityLabel="Email address"
          />

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={colors.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            accessibilityLabel="Password"
          />

          {/* Create account button */}
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleUpgrade}
            disabled={loading}
            accessibilityLabel="Create account"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.upgradeButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Sign in instead */}
          <TouchableOpacity
            style={styles.signInLink}
            onPress={handleSignInInstead}
            disabled={loading}
            accessibilityLabel="Sign in to existing account"
            accessibilityRole="button"
          >
            <Text style={[styles.signInLinkText, { color: colors.primary }]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onClose}
            disabled={loading}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          >
            <Text style={[styles.dismissText, { color: colors.subtext }]}>
              Continue browsing as guest
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1.5, borderRadius: 10,
    padding: 14, fontSize: 16, marginBottom: 12,
  },
  upgradeButton: {
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  upgradeButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  signInLink: { alignItems: 'center', marginBottom: 16 },
  signInLinkText: { fontSize: 15, fontWeight: '600' },
  dismissButton: { alignItems: 'center' },
  dismissText: { fontSize: 14 },
});
