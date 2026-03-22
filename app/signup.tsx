import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { logError } from "../utils/crashReporting";
import { sanitizeEmail, validateSignup } from "../utils/validation";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sanitizeName = (name: string): string =>
  name
    .trim()
    .replace(/[^a-zA-Z\s'-]/g, "")
    .substring(0, 50);

const validateName = (name: string, field: string): string | null => {
  if (!name.trim()) return `${field} is required.`;
  if (name.trim().length < 2) return `${field} must be at least 2 characters.`;
  if (!/^[a-zA-Z\s'-]+$/.test(name.trim()))
    return `${field} contains invalid characters.`;
  return null;
};

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest, upgradeGuest, setIsVerifying } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSignup = async () => {
    // ── Name validation ──────────────────────────────────────────────────────
    const firstNameClean = sanitizeName(firstName);
    const lastNameClean = sanitizeName(lastName);

    const firstNameError = validateName(firstNameClean, "First name");
    if (firstNameError) {
      Alert.alert("Validation Error", firstNameError);
      return;
    }

    const lastNameError = validateName(lastNameClean, "Last name");
    if (lastNameError) {
      Alert.alert("Validation Error", lastNameError);
      return;
    }

    // ── Email / password validation ──────────────────────────────────────────
    const sanitizedEmail = sanitizeEmail(email);
    const validation = validateSignup({
      email: sanitizedEmail,
      password,
      confirmPassword,
    });
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      Alert.alert("Validation Error", firstError);
      return;
    }

    setLoading(true);
    try {
      if (isGuest) {
        // ── Upgrade anonymous guest to full account ───────────────────────────
        await upgradeGuest(sanitizedEmail, password);

        const currentUser = auth.currentUser;
        if (currentUser) {
          await setDoc(
            doc(db, "users", currentUser.uid),
            {
              firstName: firstNameClean,
              lastName: lastNameClean,
              displayName: `${firstNameClean} ${lastNameClean}`,
              email: sanitizedEmail,
              emailVerified: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              accountType: "patient",
              isActive: true,
            },
            { merge: true },
          );

          await updateProfile(currentUser, {
            displayName: `${firstNameClean} ${lastNameClean}`,
          });

          if (!currentUser.emailVerified) {
            await sendEmailVerification(currentUser);
            setIsVerifying(true);
            setVerificationSent(true);
          }
        }
      } else {
        // ── Create brand new account ─────────────────────────────────────────
        const { user } = await createUserWithEmailAndPassword(
          auth,
          sanitizedEmail,
          password,
        );

        await setDoc(doc(db, "users", user.uid), {
          firstName: firstNameClean,
          lastName: lastNameClean,
          displayName: `${firstNameClean} ${lastNameClean}`,
          email: sanitizedEmail,
          emailVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          accountType: "patient",
          isActive: true,
        });

        await updateProfile(user, {
          displayName: `${firstNameClean} ${lastNameClean}`,
        });

        await sendEmailVerification(user);
        setIsVerifying(true);
        setVerificationSent(true);
      }
    } catch (error: any) {
      logError(error, "Signup");

      const errorMap: Record<string, string> = {
        "auth/email-already-in-use":
          "This email is already registered. Please sign in instead.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password does not meet security requirements.",
        "auth/too-many-requests":
          "Too many attempts. Please wait a moment and try again.",
        "auth/network-request-failed":
          "Network error. Please check your connection.",
        "auth/operation-not-allowed":
          "Account creation is currently unavailable.",
      };

      const errorMessage =
        errorMap[error.code] ?? "Failed to create account. Please try again.";
      Alert.alert("Signup Failed", errorMessage);
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
            We sent a verification link to{"\n"}
            <Text style={{ fontWeight: "bold", color: colors.text }}>
              {email}
            </Text>
            {"\n\n"}
            Click the link in your email to verify your account. You can still
            use the app while you wait.{"\n\n"}
            Do not see it? Check your spam or junk folder.
          </Text>

          {/* Routes to onboarding on first signup instead of directly to tabs */}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setIsVerifying(false);
              router.replace("/onboarding" as any);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.continueButtonText}>Continue →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, { borderColor: colors.border }]}
            onPress={async () => {
              const currentUser = auth.currentUser;
              if (currentUser) {
                try {
                  await sendEmailVerification(currentUser);
                  Alert.alert("Sent", "Verification email resent.");
                } catch {
                  Alert.alert(
                    "Error",
                    "Could not resend. Please try again later.",
                  );
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require("../assets/images/Morava-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={[styles.title, { color: colors.text }]}>
          Create Account
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Join Morava today
        </Text>

        {/* ── Name row ───────────────────────────────────────────────────── */}
        <View style={styles.nameRow}>
          <TextInput
            style={[
              styles.input,
              styles.nameInput,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="First Name"
            placeholderTextColor={colors.subtext}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="First name"
            maxLength={50}
          />
          <TextInput
            style={[
              styles.input,
              styles.nameInput,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Last Name"
            placeholderTextColor={colors.subtext}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Last name"
            maxLength={50}
          />
        </View>

        {/* ── Email & password ────────────────────────────────────────────── */}
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
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!loading}
          accessibilityLabel="Email address"
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
          textContentType="newPassword"
          editable={!loading}
          accessibilityLabel="Password"
        />

        <Text style={[styles.passwordHint, { color: colors.subtext }]}>
          Min 8 characters · 1 uppercase · 1 number · 1 special character
          (!@#$%...)
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
          placeholder="Confirm Password"
          placeholderTextColor={colors.subtext}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          editable={!loading}
          onSubmitEditing={handleSignup}
          accessibilityLabel="Confirm password"
        />

        <TouchableOpacity
          style={[
            styles.signupButton,
            { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
          ]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.signupButtonText}>
            {loading ? "Creating Account..." : "Create Account"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.subtext }]}>
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/")} disabled={loading}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 30 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 24 },
  nameRow: { flexDirection: "row", gap: 10 },
  nameInput: { flex: 1 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordHint: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  signupButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  signupButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 30 },
  footerText: { fontSize: 16 },
  loginLink: { fontSize: 16, fontWeight: "bold" },
  // Verification screen
  verificationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  verificationIcon: { fontSize: 80, marginBottom: 24 },
  verificationTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  verificationText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  continueButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
  },
  resendButtonText: { fontSize: 15 },
});
