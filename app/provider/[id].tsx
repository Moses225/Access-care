import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

let MapView: any;
let Marker: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExpoMaps = require('react-native-maps');
  MapView = ExpoMaps.default;
  Marker = ExpoMaps.Marker;
} catch {
  // Maps not available
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  insuranceAccepted: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  verified?: boolean;
  profilePicture?: string;
  welcomeMessage?: string;
  aboutMe?: string;
  specialInterests?: string[];
  education?: { degree: string; school: string; year: number }[];
  languagesSpoken?: string[];
  boardCertifications?: string[];
  interviewConsult?: {
    offered: boolean;
    duration: number;
    price: number;
    description: string;
  };
}

// ─── Pricing Estimate Card ────────────────────────────────────────────────────
const PricingEstimateCard = ({ colors }: { colors: any }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pricing Estimate</Text>
        <TouchableOpacity onPress={() => setShowInfo(!showInfo)}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.pricingGrid}>
        <View style={styles.pricingItem}>
          <Text style={[styles.pricingLabel, { color: colors.subtext }]}>
            SoonerCare/Medicaid
          </Text>
          <Text style={[styles.pricingValue, { color: colors.success }]}>$0 Copay</Text>
        </View>
        <View style={styles.pricingItem}>
          <Text style={[styles.pricingLabel, { color: colors.subtext }]}>Estimated Range</Text>
          <Text style={[styles.pricingValue, { color: colors.text }]}>$120 - $200</Text>
        </View>
      </View>

      {showInfo && (
        <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.infoBoxText, { color: colors.text }]}>
            This is an estimate. Actual costs may vary. Always verify with the provider office
            before your appointment.
          </Text>
          <TouchableOpacity onPress={() => setShowInfo(false)}>
            <Text style={[styles.infoClose, { color: colors.primary }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Interview Consult Card ───────────────────────────────────────────────────
const InterviewConsultCard = ({
  interviewConsult,
  colors,
}: {
  interviewConsult: Provider['interviewConsult'];
  colors: any;
}) => {
  if (!interviewConsult || !interviewConsult.offered) return null;

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Meet & Greet Available
        </Text>
      </View>

      <View style={[styles.consultBox, { backgroundColor: colors.background }]}>
        <View style={styles.consultHeader}>
          <Text style={[styles.consultPrice, { color: colors.primary }]}>
            ${interviewConsult.price}
          </Text>
          <Text style={[styles.consultDuration, { color: colors.subtext }]}>
            {interviewConsult.duration} minutes
          </Text>
        </View>
        <Text style={[styles.consultDescription, { color: colors.text }]}>
          {interviewConsult.description ||
            'Schedule a brief consultation to meet the provider and discuss your healthcare needs.'}
        </Text>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProviderDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // ─── Load single provider via getDoc (1 read, not full collection) ──────────
  const loadProvider = useCallback(async () => {
    try {
      if (!id || typeof id !== 'string') {
        Alert.alert('Error', 'Invalid provider ID');
        router.back();
        return;
      }

      setLoading(true);

      const providerRef = doc(db, 'providers', id);
      const docSnap = await getDoc(providerRef);

      if (!docSnap.exists()) {
        Alert.alert('Provider Not Found', 'This provider could not be loaded.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      const data = docSnap.data();

      // Safe rating parsing
      let safeRating = 0;
      if (typeof data.rating === 'number') {
        safeRating = data.rating;
      } else if (typeof data.rating === 'string') {
        const parsed = parseFloat(data.rating);
        safeRating = isNaN(parsed) ? 0 : parsed;
      }

      // Safe coordinates with Oklahoma City fallback
      const safeLatitude = typeof data.latitude === 'number' ? data.latitude : 35.4676;
      const safeLongitude = typeof data.longitude === 'number' ? data.longitude : -97.5164;

      // Safe insurance array
      let safeInsurance: string[] = [];
      if (Array.isArray(data.insuranceAccepted)) {
        safeInsurance = data.insuranceAccepted;
      } else if (typeof data.insuranceAccepted === 'string') {
        safeInsurance = [data.insuranceAccepted];
      }

      const foundProvider: Provider = {
        id: docSnap.id,
        name: typeof data.name === 'string' ? data.name : 'Unknown Provider',
        specialty: typeof data.specialty === 'string' ? data.specialty : 'General',
        address: typeof data.address === 'string' ? data.address : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        rating: safeRating,
        acceptsNewPatients: data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
        insuranceAccepted: safeInsurance,
        location: {
          latitude: safeLatitude,
          longitude: safeLongitude,
        },
        latitude: safeLatitude,
        longitude: safeLongitude,
        city: typeof data.city === 'string' ? data.city : '',
        state: typeof data.state === 'string' ? data.state : 'Oklahoma',
        verified: data.verified === true,
        profilePicture: typeof data.profilePicture === 'string' ? data.profilePicture : '',
        welcomeMessage: typeof data.welcomeMessage === 'string' ? data.welcomeMessage : '',
        aboutMe: typeof data.bio === 'string' && data.bio
        ? data.bio
        : typeof data.aboutMe === 'string' ? data.aboutMe : '',
        specialInterests: Array.isArray(data.specialInterests) ? data.specialInterests : [],
        education: Array.isArray(data.education) ? data.education : [],
        languagesSpoken: Array.isArray(data.languagesSpoken) ? data.languagesSpoken : [],
        boardCertifications: Array.isArray(data.boardCertifications)
          ? data.boardCertifications
          : [],
        interviewConsult: data.interviewConsult || null,
      };

      setProvider(foundProvider);
    } catch (error) {
      if (__DEV__) console.error('Error loading provider:', error);
      Alert.alert('Error', 'Could not load provider details', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // ─── Check favorites ─────────────────────────────────────────────────────────
  const checkIfFavorite = useCallback(async () => {
    try {
      const favs = await AsyncStorage.getItem('favorites');
      if (favs) {
        const favorites = JSON.parse(favs);
        setIsFavorite(favorites.includes(id));
      }
    } catch (error) {
      if (__DEV__) console.log('Error checking favorites:', error);
    }
  }, [id]);

  useEffect(() => {
    loadProvider();
    checkIfFavorite();
  }, [loadProvider, checkIfFavorite]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleCall = () => {
    if (provider?.phone) {
      Linking.openURL(`tel:${provider.phone}`);
    }
  };

  const handleDirections = () => {
    if (provider?.location) {
      const { latitude, longitude } = provider.location;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      Linking.openURL(url);
    }
  };

  const toggleFavorite = async () => {
    try {
      const favs = await AsyncStorage.getItem('favorites');
      let favorites = favs ? JSON.parse(favs) : [];

      if (isFavorite) {
        favorites = favorites.filter((fav: string) => fav !== id);
      } else {
        favorites.push(id);
      }

      await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
      setIsFavorite(!isFavorite);
    } catch (error) {
      if (__DEV__) console.log('Error toggling favorite:', error);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading provider...</Text>
      </View>
    );
  }

  // ─── Not found state ──────────────────────────────────────────────────────────
  if (!provider) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Provider not found</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasSoonerCare =
    provider.insuranceAccepted.includes('SoonerCare') ||
    provider.insuranceAccepted.includes('Medicaid');
  const acceptingPatients = provider.acceptsNewPatients ?? provider.acceptingNewPatients ?? true;

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          {provider.profilePicture && provider.profilePicture.startsWith('http') ? (
            <Image source={{ uri: provider.profilePicture }} style={styles.profilePic} />
          ) : (
            <View style={[styles.placeholderPic, { backgroundColor: colors.primary }]}>
              <Text style={styles.placeholderText}>{provider.name.charAt(0)}</Text>
            </View>
          )}

          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {provider.name}
              </Text>
              {provider.verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[styles.specialty, { color: colors.primary }]}>{provider.specialty}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={toggleFavorite}
          style={styles.favoriteBtn}
          accessibilityLabel={isFavorite ? 'Remove from saved providers' : 'Save provider'}
          accessibilityRole="button"
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={28}
            color={isFavorite ? colors.error : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Welcome Message */}
      {!!provider.welcomeMessage && (
        <View style={[styles.section, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.welcomeMessage, { color: colors.text }]}>
            {provider.welcomeMessage}
          </Text>
        </View>
      )}

      {/* About */}
      {!!provider.aboutMe && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.aboutText, { color: colors.text }]}>{provider.aboutMe}</Text>
        </View>
      )}

      {/* Special Interests */}
      {provider.specialInterests && provider.specialInterests.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Special Interests</Text>
          <View style={styles.interestsContainer}>
            {provider.specialInterests.map((interest, index) => (
              <View key={index} style={[styles.interestChip, { backgroundColor: colors.primary }]}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Education */}
      {provider.education && provider.education.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Education</Text>
          {provider.education.map((edu, index) => (
            <View key={index} style={styles.educationItem}>
              <Text style={[styles.degree, { color: colors.text }]}>{edu.degree}</Text>
              <Text style={[styles.school, { color: colors.subtext }]}>
                {edu.school} • {edu.year}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Languages */}
      {provider.languagesSpoken && provider.languagesSpoken.length > 1 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Languages Spoken</Text>
          <Text style={[styles.languages, { color: colors.text }]}>
            {provider.languagesSpoken.join(', ')}
          </Text>
        </View>
      )}

      {/* Board Certifications */}
      {provider.boardCertifications && provider.boardCertifications.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Board Certifications</Text>
          {provider.boardCertifications.map((cert, index) => (
            <Text key={index} style={[styles.certification, { color: colors.text }]}>
              • {cert}
            </Text>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleCall}
          accessibilityLabel="Call provider"
          accessibilityRole="button"
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleDirections}
          accessibilityLabel="Get directions to provider"
          accessibilityRole="button"
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.actionText}>Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{provider.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{provider.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="star" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            {provider.rating.toFixed(1)} Rating
          </Text>
        </View>
      </View>

      {/* Insurance */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Insurance Accepted</Text>
        {hasSoonerCare && (
          <View style={[styles.soonerCareHighlight, { backgroundColor: colors.success }]}>
            <Text style={styles.soonerCareText}>Accepts SoonerCare / Medicaid</Text>
          </View>
        )}
        <Text style={[styles.insuranceList, { color: colors.text }]}>
          {provider.insuranceAccepted.join(', ')}
        </Text>
      </View>

      {/* Pricing Estimate */}
      <PricingEstimateCard colors={colors} />

      {/* Interview Consult */}
      <InterviewConsultCard interviewConsult={provider.interviewConsult} colors={colors} />

      {/* Accepting Patients */}
      {acceptingPatients && (
        <View style={[styles.section, { backgroundColor: colors.success + '20' }]}>
          <Text style={[styles.acceptingText, { color: colors.success }]}>
            Currently Accepting New Patients
          </Text>
        </View>
      )}

      {/* Map */}
      {MapView && provider.location && (
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
              <Marker coordinate={provider.location} title={provider.name} />
            </MapView>
          </View>
        </View>
      )}

      {/* Book Appointment */}
      <View style={styles.bookContainer}>
        <TouchableOpacity
          style={[styles.bookButton, { backgroundColor: acceptingPatients ? colors.primary : colors.border }]}
          disabled={!acceptingPatients}
          activeOpacity={0.7}
          accessibilityLabel={acceptingPatients ? 'Book appointment' : 'Provider not accepting new patients'}
          accessibilityRole="button"
          onPress={() => {
            if (acceptingPatients && id) {
              router.push(`/booking/${id}` as any);
            }
          }}
        >
          <Text style={styles.bookButtonText}>
            {acceptingPatients ? 'Book Appointment' : 'Not Accepting New Patients'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorText: { fontSize: 18, marginBottom: 20 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  profilePic: { width: 70, height: 70, borderRadius: 35, marginRight: 12 },
  placeholderPic: {
    width: 70, height: 70, borderRadius: 35, marginRight: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  placeholderText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  verifiedText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  specialty: { fontSize: 14, fontWeight: '600' },
  favoriteBtn: { padding: 8 },
  section: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  welcomeMessage: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  aboutText: { fontSize: 15, lineHeight: 22 },
  interestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  interestText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  educationItem: { marginBottom: 12 },
  degree: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  school: { fontSize: 14 },
  languages: { fontSize: 15 },
  certification: { fontSize: 14, marginBottom: 6 },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8,
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  infoText: { fontSize: 14, flex: 1 },
  soonerCareHighlight: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 12 },
  soonerCareText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  insuranceList: { fontSize: 14, lineHeight: 20 },
  pricingGrid: { flexDirection: 'row', gap: 12 },
  pricingItem: { flex: 1 },
  pricingLabel: { fontSize: 12, marginBottom: 4 },
  pricingValue: { fontSize: 20, fontWeight: 'bold' },
  infoBox: { marginTop: 12, padding: 12, borderRadius: 8 },
  infoBoxText: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  infoClose: { fontSize: 14, fontWeight: '600' },
  consultBox: { padding: 16, borderRadius: 8 },
  consultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  consultPrice: { fontSize: 24, fontWeight: 'bold' },
  consultDuration: { fontSize: 14 },
  consultDescription: { fontSize: 14, lineHeight: 20 },
  acceptingText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  bookContainer: { paddingHorizontal: 16, marginTop: 16 },
  bookButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  bookButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
