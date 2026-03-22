import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";

// ── Sanitizers ────────────────────────────────────────────────────────────────
const sanitizeField = (val: string, maxLen = 500): string =>
  val
    .replace(/<[^>]*>/g, "")
    .replace(/[<>{}]/g, "")
    .trim()
    .substring(0, maxLen);

const sanitizePhone = (val: string): string =>
  val
    .replace(/[^\d\s\-\(\)\+]/g, "")
    .trim()
    .substring(0, 20);

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: "welcome", title: "Health Profile", subtitle: "One-time setup" },
  { id: "medications", title: "Current Medications", subtitle: "Step 1 of 3" },
  { id: "allergies", title: "Allergies & Conditions", subtitle: "Step 2 of 3" },
  { id: "emergency", title: "Emergency Contact", subtitle: "Step 3 of 3" },
];

export default function IntakeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const redirectTo = (params.redirect as string) || "/(tabs)";

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  // Load existing intake if editing
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "intakeForms", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setMedications(d.medications || "");
        setAllergies(d.allergies || "");
        setConditions(d.conditions || "");
        setEmergencyName(d.emergencyContact?.name || "");
        setEmergencyPhone(d.emergencyContact?.phone || "");
        setEmergencyRelation(d.emergencyContact?.relation || "");
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "intakeForms", user.uid), {
        userId: user.uid,
        medications: sanitizeField(medications),
        allergies: sanitizeField(allergies),
        conditions: sanitizeField(conditions),
        emergencyContact: {
          name: sanitizeField(emergencyName, 100),
          phone: sanitizePhone(emergencyPhone),
          relation: sanitizeField(emergencyRelation, 50),
        },
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 1,
      });
      // Mark intake as complete on user doc
      await setDoc(
        doc(db, "users", user.uid),
        { intakeComplete: true },
        { merge: true },
      );
      router.replace(redirectTo as any);
    } catch (e) {
      Alert.alert(
        "Error",
        "Could not save your health profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else handleSave();
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Health Profile?",
      "Your provider won't have your health history before the visit. You can complete this later in Profile → Health Profile.",
      [
        { text: "Fill it out", style: "cancel" },
        {
          text: "Skip for now",
          onPress: () => router.replace(redirectTo as any),
        },
      ],
    );
  };

  const progress = step / (STEPS.length - 1);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.stepLabel, { color: colors.primary }]}>
              {STEPS[step].subtitle}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {STEPS[step].title}
            </Text>
          </View>
          {step > 0 && (
            <TouchableOpacity onPress={handleSkip}>
              <Text style={[styles.skipBtn, { color: colors.subtext }]}>
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Progress bar */}
        <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Welcome step ───────────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.welcomeWrap}>
            <Text style={styles.welcomeEmoji}>🏥</Text>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Set up your Health Profile
            </Text>
            <View
              style={[
                styles.trustCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.trustTitle, { color: colors.primary }]}>
                Why we ask
              </Text>
              <Text style={[styles.trustText, { color: colors.subtext }]}>
                Your health profile helps providers prepare for your visit
                before you arrive — so they can give you better, faster care.
                {"\n\n"}
                You only fill this out{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  once
                </Text>
                . It is saved securely to your Morava account and shared only
                with providers you book with.{"\n\n"}
                You can update it anytime from{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Profile → Health Profile
                </Text>
                .
              </Text>
            </View>
            <View style={[styles.privacyRow, { borderColor: colors.border }]}>
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <Text style={[styles.privacyText, { color: colors.subtext }]}>
                Your information is encrypted and never sold or shared with
                advertisers.
              </Text>
            </View>
          </View>
        )}

        {/* ── Medications step ───────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Current Medications
            </Text>
            <Text style={[styles.fieldHint, { color: colors.subtext }]}>
              List any medications you currently take, including
              over-the-counter drugs and supplements. Enter &quot;None&quot; if
              not applicable.
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={
                "e.g. Metformin 500mg, Lisinopril 10mg, Vitamin D\n\nOr type None"
              }
              placeholderTextColor={colors.subtext}
              value={medications}
              onChangeText={setMedications}
              multiline
              numberOfLines={6}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.subtext }]}>
              {medications.length}/500
            </Text>
          </View>
        )}

        {/* ── Allergies + conditions step ────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Allergies
            </Text>
            <Text style={[styles.fieldHint, { color: colors.subtext }]}>
              Include medication allergies, food allergies, and environmental
              allergies. Enter &quot;None&quot; if not applicable.
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={
                'e.g. Penicillin, Shellfish, Latex\n\nOr type "None"'
              }
              placeholderTextColor={colors.subtext}
              value={allergies}
              onChangeText={setAllergies}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.subtext }]}>
              {allergies.length}/500
            </Text>

            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 24 }]}
            >
              Medical Conditions
            </Text>
            <Text style={[styles.fieldHint, { color: colors.subtext }]}>
              List any diagnosed conditions or chronic illnesses. Enter
              &quot;None&quot; if not applicable.
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={
                'e.g. Type 2 Diabetes, Hypertension, Asthma\n\nOr type "None"'
              }
              placeholderTextColor={colors.subtext}
              value={conditions}
              onChangeText={setConditions}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.subtext }]}>
              {conditions.length}/500
            </Text>
          </View>
        )}

        {/* ── Emergency contact step ─────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Emergency Contact
            </Text>
            <Text style={[styles.fieldHint, { color: colors.subtext }]}>
              Who should be contacted in case of a medical emergency? This is
              shared with your provider.
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Full name"
              placeholderTextColor={colors.subtext}
              value={emergencyName}
              onChangeText={setEmergencyName}
              maxLength={100}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Phone number"
              placeholderTextColor={colors.subtext}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Relationship (e.g. Spouse, Parent, Sibling)"
              placeholderTextColor={colors.subtext}
              value={emergencyRelation}
              onChangeText={setEmergencyRelation}
              maxLength={50}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        {step > 0 && (
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: colors.border }]}
            onPress={() => setStep((s) => s - 1)}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>
              ← Back
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: colors.primary, flex: step > 0 ? 1 : undefined },
          ]}
          onPress={handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 0
                ? "Get Started →"
                : step === STEPS.length - 1
                  ? "Save Health Profile ✓"
                  : "Continue →"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "800" },
  skipBtn: { fontSize: 14, fontWeight: "600", paddingTop: 6 },
  progressBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  content: { padding: 20, paddingBottom: 40 },
  welcomeWrap: { alignItems: "center", paddingTop: 12 },
  welcomeEmoji: { fontSize: 56, marginBottom: 16 },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
  },
  trustCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    width: "100%",
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  trustText: { fontSize: 14, lineHeight: 22 },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: "100%",
  },
  privacyText: { fontSize: 13, lineHeight: 18, flex: 1 },
  fieldLabel: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  fieldHint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
  },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  backBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 15, fontWeight: "600" },
  nextBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 180,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
