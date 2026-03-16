import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

type Props = {
  visible: boolean;
  onClose: () => void;
  reason?: string;
};

export function GuestUpgradePrompt({ visible, onClose, reason = 'access this feature' }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleCreateAccount = () => {
    onClose();
    // Navigate to the full signup screen so users get
    // name fields, strong password validation, and onboarding
    router.push('/signup' as any);
  };

  const handleSignIn = () => {
    onClose();
    router.push('/login' as any);
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

          {/* Icon */}
          <Text style={styles.icon}>🔒</Text>

          {/* Header */}
          <Text style={[styles.title, { color: colors.text }]}>
            Account Required
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            You need a free account to {reason}.{'\n'}
            It only takes 30 seconds to sign up.
          </Text>

          {/* Create account button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleCreateAccount}
            accessibilityLabel="Create a free account"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Create Free Account →</Text>
          </TouchableOpacity>

          {/* Sign in instead */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleSignIn}
            accessibilityLabel="Sign in to existing account"
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onClose}
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
    paddingBottom: 44,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  icon: { fontSize: 44, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  primaryButton: {
    width: '100%', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  secondaryButton: {
    width: '100%', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, marginBottom: 16,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  dismissButton: { alignItems: 'center', paddingVertical: 8 },
  dismissText: { fontSize: 14 },
});
