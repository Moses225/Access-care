import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../../context/ThemeContext';
import { mockProviders } from '../../data/providers';
import { auth, db } from '../../firebase';

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const provider = mockProviders.find(p => p.id === id);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  useEffect(() => {
    checkIfSaved();
  }, []);

  const checkIfSaved = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !provider) return;

    try {
      const q = query(
        collection(db, 'savedProviders'),
        where('userId', '==', uid),
        where('providerId', '==', provider.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setIsSaved(true);
        setSavedDocId(snapshot.docs[0].id);
      }
    } catch (error) {
      console.log('Error checking saved status:', error);
    }
  };

  const toggleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !provider) return;

    try {
      if (isSaved && savedDocId) {
        await deleteDoc(doc(db, 'savedProviders', savedDocId));
        setIsSaved(false);
        setSavedDocId(null);
        Alert.alert('Removed', 'Provider removed from saved list');
      } else {
        const docRef = await addDoc(collection(db, 'savedProviders'), {
          userId: uid,
          providerId: provider.id,
          name: provider.name,
          specialty: provider.specialty,
          rating: provider.rating,
          distance: provider.distance,
        });
        setIsSaved(true);
        setSavedDocId(docRef.id);
        Alert.alert('Saved', 'Provider added to your saved list');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update saved status');
    }
  };

  const openDirections = () => {
    if (!provider) return;

    const { latitude, longitude, name, address } = provider;
    
    // Create URLs for different platforms
    const appleMapsUrl = `maps://app?daddr=${latitude},${longitude}&q=${encodeURIComponent(name)}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(name)}`;
    const webMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

    // Platform-specific logic
    if (Platform.OS === 'ios') {
      // Try Apple Maps first on iOS
      Linking.canOpenURL(appleMapsUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(appleMapsUrl);
          } else {
            // Fallback to Google Maps web
            return Linking.openURL(webMapsUrl);
          }
        })
        .catch(() => {
          // Last resort: open in browser
          Linking.openURL(webMapsUrl);
        });
    } else {
      // Android or other platforms - use Google Maps
      Linking.openURL(googleMapsUrl).catch(() => {
        // Fallback to web
        Linking.openURL(webMapsUrl);
      });
    }
  };

  if (!provider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Provider not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{provider.name}</Text>
            <Text style={[styles.specialty, { color: colors.primary }]}>{provider.specialty}</Text>
            <Text style={[styles.category, { color: colors.subtext }]}>{provider.category}</Text>
          </View>
          <TouchableOpacity onPress={toggleSave}>
            <Text style={styles.saveIcon}>{isSaved ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>⭐ {provider.rating}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>📍 {provider.distance} mi</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: provider.available ? colors.success : colors.error }]}>
              {provider.available ? '✓ Available' : '✗ Unavailable'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Status</Text>
          </View>
        </View>
      </View>

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

      <TouchableOpacity style={[styles.directionsButton, { backgroundColor: colors.primary }]} onPress={openDirections}>
        <Text style={styles.directionsButtonText}>🗺️ Get Directions</Text>
      </TouchableOpacity>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.subtext }]}>Address:</Text>
        </View>
        <Text style={[styles.addressText, { color: colors.text }]}>{provider.address}</Text>
        
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.subtext }]}>Phone:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${provider.phone}`)}>
            <Text style={[styles.value, styles.phoneLink, { color: colors.primary }]}>{provider.phone}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {provider.services && provider.services.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Services Offered</Text>
          {provider.services.map((service, index) => (
            <View key={index} style={styles.serviceItem}>
              <Text style={styles.serviceBullet}>•</Text>
              <Text style={[styles.serviceText, { color: colors.text }]}>{service}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.bookButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push(`/booking/${provider.id}` as any)}
      >
        <Text style={styles.bookButtonText}>📅 Book Appointment</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: 20, paddingTop: 60 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  header: { padding: 20, marginHorizontal: 20, borderRadius: 15, marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  specialty: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  category: { fontSize: 13 },
  saveIcon: { fontSize: 32 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  statLabel: { fontSize: 11 },
  map: { height: 250, marginHorizontal: 20, borderRadius: 15, marginBottom: 15 },
  directionsButton: { marginHorizontal: 20, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  directionsButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  section: { marginHorizontal: 20, padding: 15, borderRadius: 12, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  infoRow: { marginBottom: 5 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5 },
  value: { fontSize: 16 },
  addressText: { fontSize: 16, lineHeight: 22, marginBottom: 15 },
  phoneLink: { fontWeight: '600', textDecorationLine: 'underline' },
  serviceItem: { flexDirection: 'row', marginBottom: 8, paddingLeft: 5 },
  serviceBullet: { fontSize: 16, marginRight: 10, color: '#667eea' },
  serviceText: { fontSize: 15, flex: 1 },
  bookButton: { marginHorizontal: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  bookButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bottomPadding: { height: 40 },
});