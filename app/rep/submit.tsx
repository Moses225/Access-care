import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

const INTEREST_OPTIONS = ["Very Interested", "Interested", "Neutral", "Not Interested", "Follow Up Later"];
const CONTACT_OPTIONS  = ["In-Person Visit", "Phone Call", "Email", "Text", "Social Media"];
const SPECIALTY_OPTIONS = [
  "Primary Care", "Internal Medicine", "Family Medicine", "Pediatrics",
  "OB/GYN", "Psychiatry", "Behavioral Health", "Cardiology", "Dermatology",
  "Orthopedics", "Neurology", "Oncology", "Urgent Care", "Telehealth",
  "Recovery / Addiction", "Other",
];

function SelectPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SubmitProvider() {
  const { user } = useAuth();
  const router   = useRouter();

  // Required
  const [providerName, setProviderName] = useState("");
  // Optional but useful
  const [practiceName, setPracticeName] = useState("");
  const [specialty, setSpecialty]       = useState("");
  const [city, setCity]                 = useState("");
  const [phone, setPhone]               = useState("");
  const [email, setEmail]               = useState("");
  const [npi, setNpi]                   = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [notes, setNotes]               = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!providerName.trim()) {
      Alert.alert("Required", "Please enter the provider's name.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "providerSubmissions"), {
        providerName:  providerName.trim(),
        practiceName:  practiceName.trim()  || null,
        specialty:     specialty            || null,
        city:          city.trim()          || null,
        providerPhone: phone.trim()         || null,
        providerEmail: email.trim().toLowerCase() || null,
        npi:           npi.trim()           || null,
        interestLevel: interestLevel        || null,
        contactMethod: contactMethod        || null,
        notes:         notes.trim()         || null,
        repEmail:      user?.email ?? "",
        repName:       user?.displayName ?? user?.email?.split("@")[0] ?? "",
        status:        "pending_verification",
        commissionPaid: false,
        source:        "rep_app",
        createdAt:     serverTimestamp(),
      });

      Alert.alert(
        "Submitted!",
        `${providerName.trim()} has been added to your pipeline. You'll see status updates on your dashboard.`,
        [{
          text: "Submit Another",
          onPress: () => {
            setProviderName(""); setPracticeName(""); setSpecialty(""); setCity("");
            setPhone(""); setEmail(""); setNpi(""); setInterestLevel("");
            setContactMethod(""); setNotes("");
          },
        }, {
          text: "Go to Dashboard",
          onPress: () => router.replace("/rep" as any),
        }]
      );
    } catch (err) {
      Alert.alert("Error", "Could not submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.pageTitle}>Provider Details</Text>
          <Text style={styles.pageSubtitle}>
            Fill in what you know — only the provider's name is required.
          </Text>

          {/* ── Provider info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PROVIDER INFO</Text>

            <Field label="Provider Full Name *" value={providerName} onChange={setProviderName} placeholder="Dr. Jane Smith" />
            <Field label="Practice / Clinic Name" value={practiceName} onChange={setPracticeName} placeholder="Sunrise Medical Group" />
            <Field label="City" value={city} onChange={setCity} placeholder="Chicago, IL" />
            <Field label="NPI Number" value={npi} onChange={setNpi} placeholder="1234567890" keyboardType="numeric" />
          </View>

          {/* ── Specialty ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPECIALTY</Text>
            <View style={styles.pillRow}>
              {SPECIALTY_OPTIONS.map((s) => (
                <SelectPill
                  key={s}
                  label={s}
                  selected={specialty === s}
                  onPress={() => setSpecialty(specialty === s ? "" : s)}
                />
              ))}
            </View>
          </View>

          {/* ── Contact info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONTACT INFO</Text>
            <Field label="Provider Phone" value={phone} onChange={setPhone} placeholder="(312) 555-0100" keyboardType="phone-pad" />
            <Field label="Provider Email" value={email} onChange={setEmail} placeholder="drsmith@clinic.com" keyboardType="email-address" autoCapitalize="none" />
          </View>

          {/* ── Outreach ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OUTREACH</Text>

            <Text style={styles.fieldLabel}>How did you reach them?</Text>
            <View style={styles.pillRow}>
              {CONTACT_OPTIONS.map((c) => (
                <SelectPill
                  key={c}
                  label={c}
                  selected={contactMethod === c}
                  onPress={() => setContactMethod(contactMethod === c ? "" : c)}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Interest Level</Text>
            <View style={styles.pillRow}>
              {INTEREST_OPTIONS.map((i) => (
                <SelectPill
                  key={i}
                  label={i}
                  selected={interestLevel === i}
                  onPress={() => setInterestLevel(interestLevel === i ? "" : i)}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional context about this provider…"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>
              {loading ? "Submitting…" : "Submit Provider"}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "words",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  textarea: {
    height: 90,
    paddingTop: 10,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
  },
  pillSelected: {
    backgroundColor: "#14B8A6",
    borderColor: "#14B8A6",
  },
  pillText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  pillTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#14B8A6",
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
