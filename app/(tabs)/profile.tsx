import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth } from '../../firebase';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, currentTheme, setTheme } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const user = auth.currentUser;

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              console.log('✅ User logged out');
            } catch (error) {
              console.error('❌ Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  // Get current theme name for display
  const getCurrentThemeName = () => {
    const themeNames: { [key: string]: string } = {
      maternal: 'Maternal Pink',
      ocean: 'Ocean Blue',
      lavender: 'Soft Lavender',
      peach: 'Peach Cream',
      mint: 'Mint Fresh',
    };
    const themeKey = currentTheme as unknown as string;
    return themeNames[themeKey] || 'Maternal Pink';
  };

  const themeOptions = [
    {
      id: 'maternal',
      name: 'Maternal Pink',
      description: 'Warm and nurturing',
      colors: ['#f093fb', '#f5576c', '#ff9a9e'],
    },
    {
      id: 'ocean',
      name: 'Ocean Blue',
      description: 'Calm and professional',
      colors: ['#4facfe', '#00f2fe', '#43e8d8'],
    },
    {
      id: 'lavender',
      name: 'Soft Lavender',
      description: 'Elegant and calming',
      colors: ['#a29bfe', '#6c5ce7', '#fd79a8'],
    },
    {
      id: 'peach',
      name: 'Peach Cream',
      description: 'Soft and warm',
      colors: ['#ff6b9d', '#ffa06b', '#fff5f0'],
    },
    {
      id: 'mint',
      name: 'Mint Fresh',
      description: 'Clean and refreshing',
      colors: ['#00d2a0', '#5ce1a5', '#f0fdf9'],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[styles.email, { color: colors.text }]}>{user?.email}</Text>
          <Text style={[styles.memberStatus, { color: colors.subtext }]}>
            AccessCare Member
          </Text>
        </View>

        {/* Account Settings */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/edit' as any)}
          >
            <Text style={styles.settingIcon}>👤</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Edit Profile
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Update profile picture
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/insurance' as any)}
          >
            <Text style={styles.settingIcon}>💳</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Insurance Information
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Manage your insurance details
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/payments' as any)}
          >
            <Text style={styles.settingIcon}>💰</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Payment Methods
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Manage payment cards
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={() => router.push('/profile/saved' as any)}
          >
            <Text style={styles.settingIcon}>❤️</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Saved Providers
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Your favorite providers
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Settings */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => setShowThemeSelector(true)}
          >
            <Text style={styles.settingIcon}>🎨</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>App Theme</Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                {getCurrentThemeName()}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/notifications' as any)}
          >
            <Text style={styles.settingIcon}>🔔</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Manage notification preferences
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={() => router.push('/profile/privacy' as any)}
          >
            <Text style={styles.settingIcon}>🔒</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Privacy & Security
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Control your data sharing
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/help' as any)}
          >
            <Text style={styles.settingIcon}>❓</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Help Center</Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                FAQs and support
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
            onPress={() => router.push('/profile/terms' as any)}
          >
            <Text style={styles.settingIcon}>📄</Text>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Terms of Service
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                Coming Soon
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: 'transparent' }]}
              onPress={() => router.push('/profile/about' as any)}
            >
              <Text style={styles.settingIcon}>ℹ️</Text>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  About AccessCare
                </Text>
                <Text style={[styles.settingSubtitle, { color: colors.subtext }]}>
                  Our mission and values
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
            </TouchableOpacity>
          </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#ef4444' }]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Theme Selector Modal */}
      <Modal
        visible={showThemeSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowThemeSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Theme</Text>

            <ScrollView style={styles.themeScroll} showsVerticalScrollIndicator={false}>
              {themeOptions.map((theme) => {
                const currentThemeStr = currentTheme as unknown as string;
                const isSelected = currentThemeStr === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.themeOption,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: 'rgba(0,0,0,0.05)' },
                    ]}
                    onPress={() => {
                      setTheme(theme.id as any);
                      setShowThemeSelector(false);
                    }}
                  >
                    <View style={styles.themePreview}>
                      {theme.colors.map((color, index) => (
                        <View
                          key={index}
                          style={[styles.colorCircle, { backgroundColor: color }]}
                        />
                      ))}
                    </View>
                    <View style={styles.themeInfo}>
                      <Text style={[styles.themeName, { color: colors.text }]}>
                        {theme.name}
                      </Text>
                      <Text style={[styles.themeDescription, { color: colors.subtext }]}>
                        {theme.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowThemeSelector(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberStatus: {
    fontSize: 14,
  },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 32,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
  },
  aboutItem: {
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  aboutValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutContainer: {
    padding: 16,
  },
  logoutButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  themeScroll: {
    maxHeight: 400,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  themePreview: {
    flexDirection: 'row',
    marginRight: 16,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 4,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  themeDescription: {
    fontSize: 13,
  },
  checkmark: {
    fontSize: 24,
    color: '#10b981',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});