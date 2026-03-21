import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase";
import { logError } from "../utils/crashReporting";
import { sanitizeEmail, validateLogin } from "../utils/validation";

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (__DEV__) console.log("🔑 handleLogin called");

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);

    // Validate inputs
    const validation = validateLogin({
      email: sanitizedEmail,
      password: password,
    });

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      Alert.alert("Validation Error", firstError);
      return;
    }

    if (__DEV__) console.log("🔑 Attempting to sign in with:", sanitizedEmail);
    setLoading(true);

    try {
      if (__DEV__) console.log("🔑 Calling signInWithEmailAndPassword...");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        sanitizedEmail,
        password,
      );
      if (__DEV__)
        console.log("✅ Sign in SUCCESS!", userCredential.user.email);
      if (__DEV__) console.log("✅ User UID:", userCredential.user.uid);
      if (__DEV__)
        console.log(
          "⏳ Waiting for auth state change to trigger navigation...",
        );

      // Navigation will happen automatically via _layout.tsx
    } catch (error: any) {
      if (__DEV__) console.error("❌ Sign in FAILED:", error);
      logError(error, "Login");

      let errorMessage = "Failed to sign in. Please try again.";

      if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection.";
      }

      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
      if (__DEV__) console.log("🔑 Login attempt complete (loading=false)");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Image
        source={require("../assets/images/Morava-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        Sign in to access your care network
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Email"
        placeholderTextColor={colors.subtext}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Password"
        placeholderTextColor={colors.subtext}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity
        style={[
          styles.loginButton,
          { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.loginButtonText}>
          {loading ? "Signing In..." : "Sign In"}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.subtext }]}>
          Don&apos;t have an account?{" "}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/signup")}
          disabled={loading}
        >
          <Text style={[styles.signupLink, { color: colors.primary }]}>
            Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 30 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 40 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  loginButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  loginButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 30 },
  footerText: { fontSize: 16 },
  signupLink: { fontSize: 16, fontWeight: "bold" },
});
