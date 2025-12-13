import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { mockProviders } from "../../data/providers";
import { auth, db } from "../../firebase";

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const provider = mockProviders.find((p) => String(p.id) === String(id));
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  useEffect(() => {
    checkIfSaved();
  }, []);

  const checkIfSaved = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !provider) return;

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
  };

  const toggleSaveProvider = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !provider) return;

    try {
      if (isSaved && savedDocId) {
        // Remove from saved
        await deleteDoc(doc(db, 'savedProviders', savedDocId));
        setIsSaved(false);
        setSavedDocId(null);
        Alert.alert('Removed', `${provider.name} removed from saved providers`);
      } else {
        // Add to saved
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
        Alert.alert('Saved', `${provider.name} added to saved providers`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update saved providers');
      console.error('Save error:', error);
    }
  };

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text>Provider not found</Text>
      </View>
    );
  }

  const openDirections = () => {
    const lat = 35.4676;
    const lng = -97.5164;
    const label = encodeURIComponent(provider.name);

    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const handleBookAppointment = () => {
    router.push(`/booking/${provider.id}` as any);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveButton} onPress={toggleSaveProvider}>
          <Text style={styles.saveIcon}>{isSaved ? '⭐' : '☆'}</Text>
          <Text style={styles.saveText}>{isSaved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {provider.name.split(" ").map((n) => n[0]).join("")}
          </Text>
        </View>
        <Text style={styles.name}>{provider.name}</Text>
        <Text style={styles.specialty}>{provider.specialty}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>⭐ {provider.rating}</Text>
          <Text style={styles.distance}>📍 {provider.distance} miles away</Text>
        </View>
      </View>

      <View style={styles.section}>
  <Text style={styles.sectionTitle}>Contact Information</Text>
  <View style={styles.infoRow}>
    <Text style={styles.label}>Address:</Text>
  </View>
  <Text style={styles.addressText}>{provider.address}</Text>
  
  <View style={styles.infoRow}>
    <Text style={styles.label}>Phone:</Text>
    <Text style={styles.value}>{provider.phone}</Text>
  </View>
  </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        {["Prenatal Care", "Ultrasound", "Labor & Delivery", "Postpartum Care"].map((s) => (
          <View key={s} style={styles.serviceItem}>
            <Text style={styles.serviceBullet}>•</Text>
            <Text style={styles.serviceText}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 35.4676,
              longitude: -97.5164,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker
              coordinate={{ latitude: 35.4676, longitude: -97.5164 }}
              title={provider.name}
              description={provider.address}
            />
          </MapView>
        </View>

        <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.costSection}>
        <Text style={styles.sectionTitle}>Estimated Cost</Text>
        <View style={styles.costBox}>
          <Text style={styles.costLabel}>Typical Visit</Text>
          <Text style={styles.costAmount}>$150 - $250</Text>
          <Text style={styles.costNote}>*With insurance: $25-$50 copay</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.bookButton, !provider.available && styles.bookButtonDisabled]}
        onPress={handleBookAppointment}
        disabled={!provider.available}
      >
        <Text style={styles.bookButtonText}>
          {provider.available ? 'Book Appointment' : 'Currently Unavailable'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  addressText: { 
  fontSize: 16, 
  color: '#333',
  lineHeight: 22,
  marginBottom: 15,
},
  backButton: { },
  backButtonText: { fontSize: 16, color: "#667eea", fontWeight: "600" },
  saveButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveIcon: { fontSize: 18, marginRight: 5 },
  saveText: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  header: {
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 5 },
  specialty: { fontSize: 16, color: "#667eea", fontWeight: "600", marginBottom: 10 },
  ratingContainer: { flexDirection: "row", gap: 20 },
  rating: { fontSize: 16, color: "#666" },
  distance: { fontSize: 16, color: "#666" },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 15 },
  infoRow: { marginBottom: 10 },
  label: { fontSize: 14, color: "#666", marginBottom: 3 },
  value: { fontSize: 16, color: "#333", flexWrap: 'wrap',flex: 1,},
  serviceItem: { flexDirection: "row", marginBottom: 10 },
  serviceBullet: { marginRight: 10, color: "#667eea", fontSize: 16 },
  serviceText: { fontSize: 15, color: "#666", flex: 1 },
  mapContainer: { height: 200, borderRadius: 15, overflow: "hidden", marginBottom: 15 },
  map: { width: "100%", height: "100%" },
  directionsButton: {
    borderWidth: 2,
    borderColor: "#667eea",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  directionsButtonText: { color: "#667eea", fontWeight: "600", fontSize: 14 },
  costSection: { padding: 20 },
  costBox: {
    backgroundColor: "#f0f0ff",
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#667eea",
  },
  costLabel: { fontSize: 14, color: "#666", marginBottom: 5 },
  costAmount: { fontSize: 28, fontWeight: "bold", color: "#667eea", marginBottom: 5 },
  costNote: { fontSize: 12, color: "#999", fontStyle: "italic" },
  bookButton: {
    backgroundColor: "#667eea",
    margin: 20,
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  bookButtonDisabled: { backgroundColor: "#ccc" },
  bookButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  bottomPadding: { height: 40 },
});