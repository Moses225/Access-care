import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useProviderAuth } from "../../context/ProviderAuthContext";
import { auth } from "../../firebase";
import { sanitizeEmail } from "../../utils/validation";

// Provider portal uses invitation-only access — no signup flow.
// Password strength rules are not enforced here intentionally:
// revealing composition rules on login screens helps attackers enumerate accounts.

const ERROR_MAP: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.", // intentionally vague
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Please check your connection.",
  "auth/operation-not-allowed": "Provider login is currently unavailable.",
};

export default function ProviderLoginScreen() {
  const router = useRouter();
  const { isProvider, initializing } = useProviderAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initializing && isProvider) {
      router.replace("/provider-portal/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, initializing]);

  const handleLogin = async () => {
    setError("");

    const sanitizedEmail = sanitizeEmail(email);

    if (!sanitizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // Sign out any existing patient session before provider login
      await signOut(auth).catch(() => {});
      await signInWithEmailAndPassword(auth, sanitizedEmail, password);
      // ProviderAuthContext detects the custom claim and redirects via useEffect
    } catch (err: any) {
      if (__DEV__) console.error("Provider login error:", err);
      // Always sign out on failure to avoid stale auth state
      await signOut(auth).catch(() => {});
      setError(ERROR_MAP[err.code] ?? "Login failed. Please try again.");
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {/* Logo mark */}
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>AC</Text>
          </View>
          <Text style={styles.logoTitle}>Morava</Text>
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
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
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
              textContentType="password"
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
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.footerLink}>Patient app →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.accessNote}>
          Provider access is by invitation only.{"\n"}
          Contact support@moravacare.com to get set up.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  center: { justifyContent: "center", alignItems: "center" },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  logoSection: { alignItems: "center", marginBottom: 48 },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#14B8A6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoMarkText: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
  logoTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  portalBadge: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  portalBadgeText: {
    color: "#14B8A6",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heading: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subheading: {
    color: "#64748B",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  form: { gap: 20 },
  errorBanner: {
    backgroundColor: "#450A0A",
    borderWidth: 1,
    borderColor: "#7F1D1D",
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: "#FCA5A5", fontSize: 14 },
  inputGroup: { gap: 8 },
  inputLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 16,
    color: "#F8FAFC",
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: "#14B8A6",
    borderRadius: 10,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: "#0F172A", fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#475569", fontSize: 14 },
  footerLink: { color: "#14B8A6", fontSize: 14, fontWeight: "600" },
  accessNote: {
    color: "#334155",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
});
