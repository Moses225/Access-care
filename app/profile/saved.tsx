import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { db } from '../../firebase';

export default function SavedProvidersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [savedProviders, setSavedProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const loadSavedProviders = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Read from AsyncStorage — matches how provider/[id].tsx saves favorites
      const favs = await AsyncStorage.getItem('favorites');
      const favoriteIds: string[] = favs ? JSON.parse(favs) : [];

      if (favoriteIds.length === 0) {
        setSavedProviders([]);
        setLoading(false);
        return;
      }

      const providerPromises = favoriteIds.map(async (providerId: string) => {
        try {
          const providerDoc = await getDoc(doc(db, 'providers', providerId));
          if (providerDoc.exists()) return { id: providerDoc.id, ...providerDoc.data() };
        } catch (error) {
          if (__DEV__) console.error(`Error loading provider ${providerId}:`, error);
        }
        return null;
      });

      const providers = await Promise.all(providerPromises);
      setSavedProviders(providers.filter(p => p !== null));
    } catch (error) {
      if (__DEV__) console.error('Error loading saved providers:', error);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  // Reload every time the screen comes into focus
  // so unfavoriting a provider is reflected immediately
  useFocusEffect(
    useCallback(() => {
      loadSavedProviders();
    }, [loadSavedProviders])
  );

  const renderProvider = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/provider/${item.id}` as any)}
      activeOpacity={0.7}
      accessibilityLabel={`View ${item.name}`}
      accessibilityRole="button"
    >
      <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.avatarText}>
          {item.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'PR'}
        </Text>
      </View>
      <View style={styles.providerInfo}>
        <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.providerSpecialty, { color: colors.primary }]} numberOfLines={1}>
          {item.specialty}
        </Text>
        <View style={styles.providerMeta}>
          <Text style={[styles.rating, { color: colors.text }]}>
            ⭐ {item.rating || 4.5}
          </Text>
        </View>
      </View>
      <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading saved providers...</Text>
        </View>
      </>
    );
  }

  if (isGuest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Saved Providers</Text>
          </View>

          <View style={styles.guestWall}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required</Text>
            <Text style={[styles.guestWallText, { color: colors.subtext }]}>
              Create a free account to save your favorite providers and access them anytime.
            </Text>
            <TouchableOpacity
              style={[styles.createAccountButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowUpgradePrompt(true)}
              accessibilityLabel="Create account to save providers"
              accessibilityRole="button"
            >
              <Text style={styles.createAccountButtonText}>Create Free Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backToProviderButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={[styles.backToProviderText, { color: colors.subtext }]}>Continue browsing</Text>
            </TouchableOpacity>
          </View>

          <GuestUpgradePrompt
            visible={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            reason="save providers"
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Saved Providers</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            {savedProviders.length} saved provider{savedProviders.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <FlatList
          data={savedProviders}
          renderItem={renderProvider}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>❤️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Saved Providers Yet</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Tap the heart icon on a provider page to save your favorites.
              </Text>
              <TouchableOpacity
                style={[styles.browseButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/' as any)}
                accessibilityLabel="Browse providers"
                accessibilityRole="button"
              >
                <Text style={styles.browseButtonText}>Browse Providers</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  list: { padding: 16, flexGrow: 1 },
  providerCard: {
    flexDirection: 'row', padding: 16, borderRadius: 16,
    marginBottom: 12, borderWidth: 1, alignItems: 'center',
  },
  providerAvatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  providerSpecialty: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  providerMeta: { flexDirection: 'row', alignItems: 'center' },
  rating: { fontSize: 14, fontWeight: '600' },
  chevron: { fontSize: 24 },
  emptyState: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 80, marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  browseButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  browseButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: {
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12,
    marginBottom: 16, width: '100%', alignItems: 'center',
  },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backToProviderButton: { paddingVertical: 12 },
  backToProviderText: { fontSize: 15 },
});
