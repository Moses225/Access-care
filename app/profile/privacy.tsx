import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [shareData, setShareData] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const privacyDoc = await getDoc(doc(db, 'privacy', user.uid));
      if (privacyDoc.exists()) {
        const data = privacyDoc.data();
        setShareData(data.shareData ?? false);
        setTwoFactorAuth(data.twoFactorAuth ?? false);
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
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

  const saveSettings = async (settings: any) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await setDoc(doc(db, 'privacy', user.uid), {
        ...settings,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving privacy settings:', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Privacy Settings</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Control your data and security
          </Text>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Share Usage Data
              </Text>
              <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                Help improve the app with anonymous usage data
              </Text>
            </View>
            <Switch
              value={shareData}
              onValueChange={handleToggleShare}
              trackColor={{ false: '#ccc', true: colors.primary }}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Two-Factor Authentication
              </Text>
              <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                Add extra security to your account (coming soon)
              </Text>
            </View>
            <Switch
              value={twoFactorAuth}
              onValueChange={handleToggle2FA}
              trackColor={{ false: '#ccc', true: colors.primary }}
              disabled={true}
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
});