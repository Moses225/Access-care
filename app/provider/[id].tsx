import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
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
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../firebase';

interface ProviderData {
  id: string;
  name: string;
  specialty: string;
  category: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  rating: number;
  reviewCount: number;
  latitude: number;
  longitude: number;
  acceptingNewPatients: boolean;
  telehealthAvailable: boolean;
  insuranceAccepted: string[];
  languages: string[];
}

export default function ProviderDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProvider();
  }, [id]);

  const loadProvider = async () => {
    if (!id) {
      console.error('No provider ID provided');
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Loading provider:', id);
      
      // Get provider document from Firebase
      const providerDoc = await getDoc(doc(db, 'providers', id));
      
      if (providerDoc.exists()) {
        const data = providerDoc.data();
        console.log('✅ Provider found:', data.name);
        
        setProvider({
          id: providerDoc.id,
          name: data.name || 'Unknown Provider',
          specialty: data.specialty || 'Unknown',
          category: data.category || 'Extended',
          address: data.address || '',
          city: data.city || '',
          state: data.state || 'OK',
          zip: data.zip || '',
          phone: data.phone || '',
          website: data.website || '',
          rating: data.rating || 4.5,
          reviewCount: data.reviewCount || 0,
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          acceptingNewPatients: data.acceptingNewPatients !== false,
          telehealthAvailable: data.telehealthAvailable === true,
          insuranceAccepted: data.insuranceAccepted || ['SoonerCare'],
          languages: data.languages || ['English'],
        });
      } else {
        console.error('❌ Provider not found in Firebase');
        Alert.alert('Error', 'Provider not found');
      }
    } catch (error) {
      console.error('❌ Error loading provider:', error);
      Alert.alert('Error', 'Failed to load provider details');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (!provider?.phone) return;
    
    const phoneNumber = provider.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDirections = () => {
    if (!provider) return;
    
    const address = `${provider.address}, ${provider.city}, ${provider.state} ${provider.zip}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });
    
    if (url) {
      Linking.openURL(url);
    }
  };

  const handleWebsite = () => {
    if (!provider?.website) return;
    
    let url = provider.website;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    Linking.openURL(url);
  };

  const handleBookAppointment = () => {
    Alert.alert(
      'Book Appointment',
      `Would you like to book an appointment with ${provider?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call Now', 
          onPress: handleCall 
        },
      ]
    );
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading provider...</Text>
      </View>
    );
  }

  // Show error if provider not found
  if (!provider) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Provider Not Found</Text>
        <Text style={[styles.errorText, { color: colors.subtext }]}>
          This provider may have been removed or the link is invalid.
        </Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasValidLocation = provider.latitude !== 0 && provider.longitude !== 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={[styles.backBtnText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {provider.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
          
          <Text style={[styles.name, { color: colors.text }]}>{provider.name}</Text>
          <Text style={[styles.specialty, { color: colors.primary }]}>{provider.specialty}</Text>
          
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={[styles.rating, { color: colors.text }]}>{provider.rating}</Text>
            {provider.reviewCount > 0 && (
              <Text style={[styles.reviewCount, { color: colors.subtext }]}>
                ({provider.reviewCount} reviews)
              </Text>
            )}
          </View>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{provider.category}</Text>
            </View>
            {provider.acceptingNewPatients && (
              <View style={[styles.badge, styles.availableBadge]}>
                <Text style={styles.badgeText}>Accepting Patients</Text>
              </View>
            )}
            {provider.telehealthAvailable && (
              <View style={[styles.badge, styles.telehealthBadge]}>
                <Text style={styles.badgeText}>Telehealth</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact Information */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
          
          <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
            <Text style={styles.contactIcon}>📞</Text>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.subtext }]}>Phone</Text>
              <Text style={[styles.contactValue, { color: colors.primary }]}>{provider.phone}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.contactItem}>
            <Text style={styles.contactIcon}>📍</Text>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.subtext }]}>Address</Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>
                {provider.address}
              </Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>
                {provider.city}, {provider.state} {provider.zip}
              </Text>
            </View>
          </View>

          {provider.website && (
            <TouchableOpacity style={styles.contactItem} onPress={handleWebsite}>
              <Text style={styles.contactIcon}>🌐</Text>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.subtext }]}>Website</Text>
                <Text style={[styles.contactValue, { color: colors.primary }]} numberOfLines={1}>
                  {provider.website}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Map */}
        {hasValidLocation && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: provider.latitude,
                  longitude: provider.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: provider.latitude,
                    longitude: provider.longitude,
                  }}
                  title={provider.name}
                  description={provider.address}
                />
              </MapView>
            </View>
            <TouchableOpacity 
              style={[styles.directionsButton, { backgroundColor: colors.primary }]}
              onPress={handleDirections}
            >
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Insurance & Languages */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Additional Information</Text>
          
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>Languages</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {provider.languages.join(', ')}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>Insurance Accepted</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {provider.insuranceAccepted.join(', ')}
            </Text>
          </View>
        </View>

        {/* Spacer for bottom button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Appointment Button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.bookButton, { backgroundColor: colors.primary }]}
          onPress={handleBookAppointment}
        >
          <Text style={styles.bookButtonText}>Book Appointment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  specialty: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 14,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  availableBadge: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  telehealthBadge: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  directionsButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
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