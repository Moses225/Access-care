import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { mockProviders } from '../../data/providers';
import { auth, db } from '../../firebase';
import { scheduleAppointmentReminder } from '../../utils/notifications';

export default function BookingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const provider = mockProviders.find(p => p.id === id);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const timeSlots = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !reason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid || !provider) return;

    setLoading(true);
    try {
      // Save appointment to Firebase
      await addDoc(collection(db, 'appointments'), {
        userId: uid,
        providerId: provider.id,
        provider: provider.name,
        specialty: provider.specialty,
        date: selectedDate,
        time: selectedTime,
        reason: reason,
        status: 'confirmed',
        createdAt: new Date(),
      });

      // Schedule notification reminder
      await scheduleAppointmentReminder(provider.name, selectedDate, selectedTime);

      Alert.alert(
        'Success!',
        `Appointment confirmed with ${provider.name} on ${selectedDate} at ${selectedTime}. You'll receive a reminder notification.`,
        [
          {
            text: 'View Appointments',
            onPress: () => router.replace('/profile/appointments' as any)
          },
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to book appointment. Please try again.');
      console.error('Booking error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text>Provider not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Book Appointment</Text>

      <View style={styles.providerCard}>
        <Text style={styles.providerName}>{provider.name}</Text>
        <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
        <Text style={styles.providerCategory}>{provider.category}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Select Date</Text>
        <TextInput
          style={styles.input}
          placeholder="MM/DD/YYYY (e.g., 12/20/2025)"
          placeholderTextColor="#999"
          value={selectedDate}
          onChangeText={setSelectedDate}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Select Time</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map(time => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeSlot,
                selectedTime === time && styles.timeSlotSelected
              ]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[
                styles.timeText,
                selectedTime === time && styles.timeTextSelected
              ]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Reason for Visit</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe your needs..."
          placeholderTextColor="#999"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.costBox}>
        <Text style={styles.costLabel}>Estimated Cost</Text>
        <Text style={styles.costAmount}>$150 - $250</Text>
        <Text style={styles.costNote}>*With insurance: $25-$50 copay</Text>
      </View>

      <TouchableOpacity 
        style={[styles.bookButton, loading && styles.bookButtonDisabled]}
        onPress={handleBooking}
        disabled={loading}
      >
        <Text style={styles.bookButtonText}>
          {loading ? 'Booking...' : 'Confirm Booking'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 20,
    paddingTop: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  providerCard: {
    backgroundColor: '#f0f0ff',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  providerSpecialty: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 3,
  },
  providerCategory: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  timeSlotSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  timeTextSelected: {
    color: '#fff',
  },
  textArea: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    height: 100,
    color: '#333',
  },
  costBox: {
    backgroundColor: '#f0f0ff',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#667eea',
    marginBottom: 20,
  },
  costLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  costAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  costNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  bookButton: {
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 40,
  },
});