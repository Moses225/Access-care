import { validateBooking, sanitizeText, sanitizePhone } from '../../utils/validation';
import { logError } from '../../utils/crashReporting';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';
import { sendBookingConfirmationSMS } from '../../utils/sms';

export default function BookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const [provider, setProvider] = useState<any>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProvider();
  }, [id]);

  const loadProvider = async () => {
    if (!id) return;

    try {
      const providerDoc = await getDoc(doc(db, 'providers', id));

      if (providerDoc.exists()) {
        setProvider({
          id: providerDoc.id,
          ...providerDoc.data()
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading provider:', error);
      Alert.alert('Error', 'Failed to load provider details');
    } finally {
      setLoadingProvider(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const today = new Date().toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  const maxDateString = maxDate.toISOString().split('T')[0];

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBooking = async () => {
  // Sanitize inputs
  const sanitizedData = {
    patientName: sanitizeText(patientName),
    patientPhone: sanitizePhone(patientPhone),
    date: selectedDate,
    time: selectedTime,
    notes: sanitizeText(notes),
  };

  // Validate with Zod
  const validation = validateBooking(sanitizedData);

  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    Alert.alert('Validation Error', firstError);
    return;
  }

  setLoading(true);

  try {
    const user = auth.currentUser;

    const bookingData = {
      userId: user?.uid || 'guest',
      providerId: id,
      providerName: provider.name,
      providerSpecialty: provider.specialty,
      date: sanitizedData.date,
      time: sanitizedData.time,
      patientName: sanitizedData.patientName,
      patientPhone: sanitizedData.patientPhone,
      notes: sanitizedData.notes,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const bookingRef = await addDoc(collection(db, 'bookings'), bookingData);

    if (__DEV__) console.log('✅ Booking created:', bookingRef.id);

    await sendBookingConfirmationSMS(
      sanitizedData.patientPhone,
      provider.name,
      formatDate(sanitizedData.date),
      sanitizedData.time,
      bookingRef.id
    );

    Alert.alert(
      'Booking Requested!',
      `Your appointment request for ${formatDate(sanitizedData.date)} at ${sanitizedData.time} has been submitted. The provider will confirm shortly.`,
      [
        {
          text: 'OK',
          onPress: () => router.push(`/booking/confirmation?bookingId=${bookingRef.id}` as any),
        },
      ]
    );
  } catch (error) {
    if (__DEV__) console.error('❌ Booking error:', error);
    logError(error, 'Booking');
    Alert.alert('Error', 'Failed to create booking. Please try again.');
  } finally {
    setLoading(false);
  }
};

  if (loadingProvider) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading provider...</Text>
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Book Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Provider Info */}
        <View style={[styles.providerCard, { backgroundColor: colors.card }]}>
          <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {provider.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'PR'}
            </Text>
          </View>
          <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
          <Text style={[styles.providerSpecialty, { color: colors.primary }]}>
            {provider.specialty}
          </Text>
        </View>

        {/* Calendar */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Date</Text>
          <Calendar
            minDate={today}
            maxDate={maxDateString}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              if (__DEV__) console.log('📅 Selected date:', day.dateString);
            }}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: colors.primary,
              },
            }}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.subtext,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
            }}
          />
          {selectedDate && (
            <View style={styles.selectedDateDisplay}>
              <Text style={[styles.selectedDateLabel, { color: colors.subtext }]}>
                Selected:
              </Text>
              <Text style={[styles.selectedDateValue, { color: colors.text }]}>
                {formatDate(selectedDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Time Slots */}
        {selectedDate && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Time</Text>
            <View style={styles.timeSlots}>
              {timeSlots.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: isSelected ? '#ffffff' : colors.text },
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Patient Information */}
        {selectedDate && selectedTime && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Information
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Full Name *"
              placeholderTextColor={colors.subtext}
              value={patientName}
              onChangeText={setPatientName}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Phone Number *"
              placeholderTextColor={colors.subtext}
              value={patientPhone}
              onChangeText={setPatientPhone}
              keyboardType="phone-pad"
            />

            <TextInput
              style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Notes (Optional)"
              placeholderTextColor={colors.subtext}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Booking Summary */}
        {selectedDate && selectedTime && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Provider:</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{provider.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Date:</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatDate(selectedDate)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Time:</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedTime}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      {selectedDate && selectedTime && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary }]}
            onPress={handleBooking}
            disabled={loading}
          >
            <Text style={styles.bookButtonText}>
              {loading ? 'Booking...' : 'Request Appointment'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginBottom: 10,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  providerCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  providerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  providerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  providerSpecialty: {
    fontSize: 16,
    fontWeight: '600',
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
  selectedDateDisplay: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  selectedDateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  selectedDateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 16,
    minHeight: 100,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
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
  backButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
