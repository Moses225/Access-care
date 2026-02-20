import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../firebase';

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { colors } = useTheme();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    if (!bookingId) return;

    try {
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (bookingDoc.exists()) {
        setBooking({ id: bookingDoc.id, ...bookingDoc.data() });
      }
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date correctly (fixes timezone issue)
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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Booking not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={[styles.successCircle, { backgroundColor: colors.success }]}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Appointment Requested!
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Your appointment request has been submitted
        </Text>

        {/* Booking Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Provider:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{booking.providerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Specialty:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{booking.providerSpecialty}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Date:</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {formatDate(booking.date)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Time:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{booking.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Patient:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{booking.patientName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Phone:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{booking.patientPhone}</Text>
          </View>
          {booking.notes && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: colors.subtext }]}>Notes:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{booking.notes}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.subtext }]}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.statusText}>Pending Confirmation</Text>
            </View>
          </View>
        </View>

        {/* Next Steps */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Next Steps</Text>
          <Text style={[styles.info, { color: colors.subtext }]}>
            • The provider will review your request{'\n'}
            • You'll receive a confirmation via SMS{'\n'}
            • Check your phone for updates{'\n'}
            • Arrive 10 minutes early to your appointment
          </Text>
        </View>

        {/* Important Info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Important</Text>
          <Text style={[styles.info, { color: colors.subtext }]}>
            Please note that this is a booking REQUEST. Your appointment is not 
            confirmed until you receive a confirmation from the provider.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)' as any)}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: colors.primary }]}
          onPress={() => router.push(`/provider/${booking.providerId}` as any)}
        >
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
            View Provider Details
          </Text>
        </TouchableOpacity>

        {/* Booking ID */}
        <Text style={[styles.bookingId, { color: colors.subtext }]}>
          Booking ID: {booking.id}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  info: {
    fontSize: 14,
    lineHeight: 24,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
  },
  bookingId: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
});