import { Stack, useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { GuestUpgradePrompt } from "../../components/GuestUpgradePrompt";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [shareData, setShareData] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (!isGuest) loadPrivacySettings();
  }, [isGuest]);

  const loadPrivacySettings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const privacyDoc = await getDoc(doc(db, "privacy", user.uid));
      if (privacyDoc.exists()) {
        const data = privacyDoc.data();
        setShareData(data.shareData ?? false);
        setTwoFactorAuth(data.twoFactorAuth ?? false);
      }
    } catch (error) {
      if (__DEV__) console.error("Error loading privacy settings:", error);
    }
  };

  const saveSettings = async (settings: any) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await setDoc(doc(db, "privacy", user.uid), {
        ...settings,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      if (__DEV__) console.error("Error saving privacy settings:", error);
    }
  };

  const handleToggleShare = async (value: boolean) => {
    setShareData(value);
    await saveSettings({ shareData: value, twoFactorAuth });
  };

  const handleToggle2FA = async (value: boolean) => {
    setTwoFactorAuth(value);
    await saveSettings({ shareData, twoFactorAuth: value });
  };

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={[styles.backText, { color: colors.primary }]}>
                ← Back
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.guestWall}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={[styles.guestWallTitle, { color: colors.text }]}>
              Account Required
            </Text>
            <Text style={[styles.guestWallText, { color: colors.subtext }]}>
              Create a free account to manage your privacy and security
              settings.
            </Text>
            <TouchableOpacity
              style={[
                styles.createAccountButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => setShowUpgradePrompt(true)}
              accessibilityRole="button"
            >
              <Text style={styles.createAccountButtonText}>
                Create Free Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={[styles.backToText, { color: colors.subtext }]}>
                Go back
              </Text>
            </TouchableOpacity>
          </View>
          <GuestUpgradePrompt
            visible={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            reason="manage privacy settings"
          />
        </View>
      </>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={[styles.backText, { color: colors.primary }]}>
              ← Back
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Privacy Settings
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Control your data and security
          </Text>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Share Anonymous Usage Data
              </Text>
              <Text
                style={[styles.settingDescription, { color: colors.subtext }]}
              >
                Help improve Morava by sharing anonymous crash reports and usage
                patterns. No personal or health data is ever shared.
              </Text>
            </View>
            <Switch
              value={shareData}
              onValueChange={handleToggleShare}
              trackColor={{ false: "#ccc", true: colors.primary }}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Two-Factor Authentication
              </Text>
              <Text
                style={[styles.settingDescription, { color: colors.subtext }]}
              >
                SMS verification at login — coming in a future update
              </Text>
            </View>
            <Switch
              value={twoFactorAuth}
              onValueChange={handleToggle2FA}
              trackColor={{ false: "#ccc", true: colors.primary }}
              disabled={true}
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: "600" },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 32 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  settingDescription: { fontSize: 13 },
  // Guest wall
  guestWall: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  guestWallText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  createAccountButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  createAccountButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  backToText: { fontSize: 15, paddingVertical: 12 },
});
