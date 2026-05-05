import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { GuestUpgradePrompt } from "../../components/GuestUpgradePrompt";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";

export default function BookingScreen() {
  const router = useRouter();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [providerData, setProviderData] = useState<{
    name: string;
    specialty: string;
  } | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    // Pre-fetch provider data so submit doesn't need a round trip
    if (!providerId) return;
    getDoc(doc(db, "providers", providerId))
      .then((snap) => {
        if (snap.exists())
          setProviderData(snap.data() as { name: string; specialty: string });
      })
      .catch(() => {});

    // Pre-fetch patient intake summary
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, "intakeForms", user.uid))
      .then((snap) => {
        if (snap.exists())
          setIntakeSummary(snap.data() as Record<string, unknown>);
      })
      .catch(() => {});
  }, [providerId]);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  const maxDateString = maxDate.toISOString().split("T")[0];

  const handleBooking = async () => {
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date");
      return;
    }
    if (!selectedTime) {
      Alert.alert("Error", "Please select a time");
      return;
    }
    if (!patientName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!patientPhone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }
    if (!providerData) {
      Alert.alert("Error", "Provider not found. Please go back and try again.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      const bookingData: Record<string, unknown> = {
        userId: user?.uid || "",
        providerId,
        providerName: providerData.name,
        providerSpecialty: providerData.specialty,
        date: selectedDate,
        time: selectedTime,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        notes: notes.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      };

      // Attach intake summary if available — provider sees full health profile
      if (intakeSummary) {
        bookingData.patientIntakeSummary = {
          medications: intakeSummary.medications || [],
          allergies: intakeSummary.allergies || [],
          conditions: intakeSummary.conditions || [],
          surgeries: intakeSummary.surgeries || [],
          vaccinations: intakeSummary.vaccinations || [],
          bloodType: intakeSummary.bloodType || "",
          height: intakeSummary.height || "",
          weight: intakeSummary.weight || "",
          insurance: intakeSummary.currentInsurance || [],
          primaryCareProvider: intakeSummary.primaryCareProvider || "",
          smoking:
            (intakeSummary.lifestyle as Record<string, unknown>)?.smoking || "",
          alcohol:
            (intakeSummary.lifestyle as Record<string, unknown>)?.alcohol || "",
          exercise:
            (intakeSummary.lifestyle as Record<string, unknown>)?.exercise ||
            "",
          diet:
            (intakeSummary.lifestyle as Record<string, unknown>)?.diet || [],
          familyHistory: intakeSummary.familyHistory || [],
          mentalHealthHistory: intakeSummary.mentalHealthHistory || [],
          pregnancyStatus: intakeSummary.pregnancyStatus || "",
          emergencyContact: intakeSummary.emergencyContact || null,
          emergencyContact2: intakeSummary.emergencyContact2 || null,
        };
      }

      const bookingRef = await addDoc(collection(db, "bookings"), bookingData);
      if (__DEV__) console.log("✅ Booking created:", bookingRef.id);

      Alert.alert(
        "Booking Requested!",
        `Your appointment request for ${selectedDate} at ${selectedTime} has been submitted.`,
        [
          {
            text: "OK",
            onPress: () =>
              router.push(
                `/booking/confirmation?bookingId=${bookingRef.id}` as any,
              ),
          },
        ],
      );
    } catch {
      Alert.alert("Error", "Failed to create booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.backText, { color: colors.primary }]}>
              ← Back
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Book Appointment
          </Text>
        </View>
        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>
            Account Required to Book
          </Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to book appointments. It only takes 30
            seconds.
          </Text>
          <TouchableOpacity
            style={[
              styles.createAccountButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => setShowUpgradePrompt(true)}
            accessibilityRole="button"
          >
            <Text style={styles.createAccountButtonText}>
              Create Free Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text
              style={[styles.backToProviderText, { color: colors.subtext }]}
            >
              Go back to provider
            </Text>
          </TouchableOpacity>
        </View>
        <GuestUpgradePrompt
          visible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          reason="book appointments"
        />
      </View>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Book Appointment
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Select Date
          </Text>
          <Calendar
            minDate={today}
            maxDate={maxDateString}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: colors.primary },
            }}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: "#ffffff",
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.subtext,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
            }}
          />
        </View>

        {selectedDate && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Time
            </Text>
            <View style={styles.timeSlots}>
              {timeSlots.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.background,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedTime(time)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${time}`}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: isSelected ? "#ffffff" : colors.text },
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

        {selectedDate && selectedTime && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Information
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Full Name *"
              placeholderTextColor={colors.subtext}
              value={patientName}
              onChangeText={setPatientName}
              accessibilityLabel="Full name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Phone Number *"
              placeholderTextColor={colors.subtext}
              value={patientPhone}
              onChangeText={setPatientPhone}
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
            />
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Notes (Optional)"
              placeholderTextColor={colors.subtext}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Notes"
            />
          </View>
        )}

        {selectedDate && selectedTime && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Booking Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>
                Date:
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>
                Time:
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {selectedTime}
              </Text>
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {selectedDate && selectedTime && (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary }]}
            onPress={handleBooking}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Request appointment"
          >
            <Text style={styles.bookButtonText}>
              {loading ? "Booking..." : "Request Appointment"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  section: { margin: 16, padding: 20, borderRadius: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  timeSlots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeSlot: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 80,
    alignItems: "center",
  },
  timeText: { fontSize: 16, fontWeight: "600" },
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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 16 },
  summaryValue: { fontSize: 16, fontWeight: "600" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  bookButton: { padding: 18, borderRadius: 12, alignItems: "center" },
  bookButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  // Guest wall
  guestWall: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  guestWallText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  createAccountButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  createAccountButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  backToProviderText: { fontSize: 15, paddingVertical: 12 },
});
