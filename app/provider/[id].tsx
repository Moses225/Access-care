import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

// Conditionally import MapView only on mobile
let MapView: any;
let Marker: any;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch (e) {
    console.log('MapView not available');
  }
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients: boolean;
  location: {
    latitude: number;
    longitude: number;
  };
  insuranceAccepted: string[];
  categories?: string[];
  category?: string;
  hours?: string;
  website?: string;
  city?: string;
  state?: string;
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProvider();
    checkIfFavorite();
  }, [id]);

  const loadProvider = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id || typeof id !== 'string') {
        throw new Error('Invalid provider ID');
      }

      console.log('Loading provider with ID:', id);

      const providerDoc = await getDoc(doc(db, 'providers', id));
      
      if (!providerDoc.exists()) {
        throw new Error('Provider not found');
      }

      const data = providerDoc.data();
      console.log('Provider data:', data);

      if (!data.name || !data.specialty) {
        throw new Error('Invalid provider data - missing required fields');
      }

      setProvider({
        id: providerDoc.id,
        name: data.name || 'Unknown Provider',
        specialty: data.specialty || 'General',
        address: data.address || 'Address not available',
        phone: data.phone || 'Phone not available',
        rating: data.rating || 0,
        acceptsNewPatients: data.acceptingNewPatients ?? true,
        location: {
          latitude: data.latitude || 35.4676,
          longitude: data.longitude || -97.5164
        },
        insuranceAccepted: Array.isArray(data.insuranceAccepted) ? data.insuranceAccepted : [],
        categories: Array.isArray(data.categories) ? data.categories : (data.category ? [data.category] : []),
        category: data.category || '',
        hours: data.hours || 'Hours not available',
        website: data.website || '',
        city: data.city || '',
        state: data.state || 'Oklahoma',
      });

    } catch (err: any) {
      console.error('Error loading provider:', err);
      setError(err.message || 'Failed to load provider');
      Alert.alert(
        'Error Loading Provider',
        'Could not load provider details. Please try again.',
        [
          { text: 'Go Back', onPress: () => router.back() },
          { text: 'Retry', onPress: () => loadProvider() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const checkIfFavorite = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !id) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const favorites = userDoc.data().favorites || [];
        setIsFavorite(favorites.includes(id));
      }
    } catch (err) {
      console.error('Error checking favorite status:', err);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Not Logged In', 'Please log in to save favorites');
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const favorites = userDoc.exists() ? (userDoc.data().favorites || []) : [];

      if (isFavorite) {
        const updatedFavorites = favorites.filter((fav: string) => fav !== id);
        await setDoc(userRef, { favorites: updatedFavorites }, { merge: true });
        setIsFavorite(false);
      } else {
        const updatedFavorites = [...favorites, id];
        await setDoc(userRef, { favorites: updatedFavorites }, { merge: true });
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      Alert.alert('Error', 'Failed to update favorites');
    }
  };

  const handleCall = () => {
    if (!provider?.phone || provider.phone === 'Phone not available') {
      Alert.alert('No Phone Number', 'Phone number not available for this provider');
      return;
    }
    Linking.openURL(`tel:${provider.phone}`);
  };

  const handleDirections = () => {
    if (!provider?.location) {
      Alert.alert('No Location', 'Location not available for this provider');
      return;
    }
    const { latitude, longitude } = provider.location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const handleBookAppointment = () => {
    if (!id) return;
    router.push(`/booking/${id}` as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading provider...</Text>
      </View>
    );
  }

  if (error || !provider) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorIcon, { color: colors.error }]}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Oops!</Text>
        <Text style={[styles.errorMessage, { color: colors.subtext }]}>
          {error || 'Provider not found'}
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasSoonerCare = provider.insuranceAccepted.includes('SoonerCare') || 
                        provider.insuranceAccepted.includes('Medicaid');
  const otherInsurances = provider.insuranceAccepted.filter(
    ins => ins !== 'SoonerCare' && ins !== 'Medicaid'
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={2}>
                {provider.name}
              </Text>
              <Text style={[styles.specialty, { color: colors.primary }]}>{provider.specialty}</Text>
            </View>
            <TouchableOpacity onPress={handleToggleFavorite}>
              <Text style={styles.heartIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.star}>⭐</Text>
            <Text style={[styles.rating, { color: colors.text }]}>{provider.rating.toFixed(1)}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: provider.acceptsNewPatients ? colors.success : colors.error }
            ]}>
              <Text style={styles.statusText}>
                {provider.acceptsNewPatients ? 'Accepting Patients' : 'Not Accepting'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCall}
          >
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={[styles.actionText, { color: colors.text }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleDirections}
          >
            <Text style={styles.actionIcon}>🗺️</Text>
            <Text style={[styles.actionText, { color: colors.text }]}>Directions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleToggleFavorite}
          >
            <Text style={styles.actionIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
            <Text style={[styles.actionText, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>{provider.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>{provider.phone}</Text>
          </View>
          {provider.hours && provider.hours !== 'Hours not available' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🕐</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>{provider.hours}</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Insurance Accepted</Text>
          
          {hasSoonerCare && (
            <View style={[styles.insuranceBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.insuranceBadgeText}>✅ SoonerCare / Medicaid</Text>
            </View>
          )}

          {otherInsurances.length > 0 && (
            <View style={styles.insuranceList}>
              {otherInsurances.map((insurance, index) => (
                <Text key={index} style={[styles.insuranceItem, { color: colors.text }]}>
                  • {insurance}
                </Text>
              ))}
            </View>
          )}

          <Text style={[styles.insuranceNote, { color: colors.subtext }]}>
            💡 Always verify coverage with provider before booking
          </Text>
        </View>

        {/* Map - Only on mobile */}
        {Platform.OS !== 'web' && MapView && provider.location && provider.location.latitude !== 0 && provider.location.longitude !== 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: provider.location.latitude,
                  longitude: provider.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: provider.location.latitude,
                    longitude: provider.location.longitude,
                  }}
                  title={provider.name}
                  description={provider.address}
                />
              </MapView>
            </View>
          </View>
        )}

        {/* Web alternative */}
        {Platform.OS === 'web' && provider.location && provider.location.latitude !== 0 && provider.location.longitude !== 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
            <TouchableOpacity
              style={[styles.webMapButton, { backgroundColor: colors.primary }]}
              onPress={handleDirections}
            >
              <Text style={styles.webMapButtonText}>🗺️ Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bookingSection}>
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary }]}
            onPress={handleBookAppointment}
          >
            <Text style={styles.bookButtonText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  providerName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 16,
    fontWeight: '600',
  },
  heartIcon: {
    fontSize: 32,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  star: {
    fontSize: 20,
  },
  rating: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  insuranceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  insuranceBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  insuranceList: {
    marginBottom: 12,
  },
  insuranceItem: {
    fontSize: 16,
    marginBottom: 8,
  },
  insuranceNote: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  webMapButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  webMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingSection: {
    padding: 16,
  },
  bookButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});