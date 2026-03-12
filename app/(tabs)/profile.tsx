import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      setUserEmail(user.email || 'No email');
      const name = user.email?.split('@')[0] || 'User';
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfileImage(data.profileImage || null);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading user data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/');
          } catch (error) {
            if (__DEV__) console.error('Error logging out:', error);
            Alert.alert('Error', 'Failed to log out');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={[styles.profileSection, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.push('/profile/edit')} activeOpacity={0.7}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                onError={() => setProfileImage(null)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.name, { color: colors.text }]}>{userEmail}</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>AccessCare Member</Text>
        </View>

        {/* ── Account ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/edit')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>👤</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Edit Profile</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Update profile picture</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/insurance')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>💳</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Insurance Information</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Manage your insurance details</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/payments')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>💰</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Payment Methods</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Manage payment cards</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/saved')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>❤️</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Saved Providers</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Your favorite providers</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── App Settings ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/theme')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🎨</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>App Theme</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Customize appearance</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/notifications')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🔔</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Notifications</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Manage notification preferences</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/privacy')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🔒</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Privacy & Security</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Control your data</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Support ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/help')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>❓</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Help Center</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>FAQs and support</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          {/* ── Privacy Policy (opens live webpage) ── */}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => Linking.openURL('https://moses225.github.io/Access-care/')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🔐</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Privacy Policy</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>How we protect your data</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile/about')}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>ℹ️</Text>
              <View>
                <Text style={[styles.menuTitle, { color: colors.text }]}>About AccessCare</Text>
                <Text style={[styles.menuSubtitle, { color: colors.subtext }]}>Version 1.1.0</Text>
              </View>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Log Out ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.error }]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && (
          <TouchableOpacity onPress={() => router.push('/provider-portal/login' as any)}>
            <Text style={{ color: 'gray', fontSize: 12, textAlign: 'center', padding: 12 }}>
              Provider Portal (dev)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 32, fontWeight: 'bold' },
  profileSection: { alignItems: 'center', padding: 32, margin: 16, marginTop: 0, borderRadius: 16 },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 8 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIcon: { fontSize: 24, marginRight: 16 },
  menuTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  menuSubtitle: { fontSize: 12 },
  chevron: { fontSize: 24 },
  logoutButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
