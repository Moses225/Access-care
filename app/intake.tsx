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
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, maxLen);

const sanitizePhone = (val: string): string =>
  val
    .replace(/[^\d\s\-\(\)\+]/g, "")
    .trim()
    .substring(0, 20);

const sanitizeName = (val: string, maxLen = 100): string =>
  val
    .replace(/[^a-zA-Z\s'\-\.]/g, "")
    .trim()
    .substring(0, maxLen);

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: "welcome", title: "Health Profile", subtitle: "One-time setup" },
  { id: "basics", title: "Basic Health Info", subtitle: "Step 1 of 4" },
  { id: "history", title: "Medical History", subtitle: "Step 2 of 4" },
  { id: "lifestyle", title: "Lifestyle & Family", subtitle: "Step 3 of 4" },
  { id: "emergency", title: "Emergency Contact", subtitle: "Step 4 of 4" },
];

export default function IntakeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const redirectTo = (params.redirect as string) || null;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // ── Step 1: Basic health info ─────────────────────────────────────────────
  const [bloodType, setBloodType] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [primaryCareProvider, setPrimaryCareProvider] = useState("");
  const [lastPhysical, setLastPhysical] = useState("");
  const [lastDental, setLastDental] = useState("");
  const [lastEyeExam, setLastEyeExam] = useState("");
  const [currentInsurance, setCurrentInsurance] = useState("");

  // ── Step 2: Medical history ───────────────────────────────────────────────
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [vaccinations, setVaccinations] = useState("");

  // ── Step 3: Lifestyle & family history ────────────────────────────────────
  const [smoking, setSmoking] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [exercise, setExercise] = useState("");
  const [diet, setDiet] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [mentalHealthHistory, setMentalHealthHistory] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState("");

  // ── Step 4: Emergency contact ─────────────────────────────────────────────
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [emergencyName2, setEmergencyName2] = useState("");
  const [emergencyPhone2, setEmergencyPhone2] = useState("");
  const [emergencyRelation2, setEmergencyRelation2] = useState("");

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "intakeForms", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        // basics
        setBloodType(d.bloodType || "");
        setHeight(d.height || "");
        setWeight(d.weight || "");
        setPrimaryCareProvider(d.primaryCareProvider || "");
        setLastPhysical(d.lastPhysical || "");
        setLastDental(d.lastDental || "");
        setLastEyeExam(d.lastEyeExam || "");
        setCurrentInsurance(d.currentInsurance || "");
        // history
        setMedications(d.medications || "");
        setAllergies(d.allergies || "");
        setConditions(d.conditions || "");
        setSurgeries(d.surgeries || "");
        setVaccinations(d.vaccinations || "");
        // lifestyle
        setSmoking(d.lifestyle?.smoking || "");
        setAlcohol(d.lifestyle?.alcohol || "");
        setExercise(d.lifestyle?.exercise || "");
        setDiet(d.lifestyle?.diet || "");
        setFamilyHistory(d.familyHistory || "");
        setMentalHealthHistory(d.mentalHealthHistory || "");
        setPregnancyStatus(d.pregnancyStatus || "");
        // emergency
        setEmergencyName(d.emergencyContact?.name || "");
        setEmergencyPhone(d.emergencyContact?.phone || "");
        setEmergencyRelation(d.emergencyContact?.relation || "");
        setEmergencyName2(d.emergencyContact2?.name || "");
        setEmergencyPhone2(d.emergencyContact2?.phone || "");
        setEmergencyRelation2(d.emergencyContact2?.relation || "");
        if (d.updatedAt?.toDate) {
          setLastSaved(d.updatedAt.toDate().toLocaleDateString());
        }
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
        // basics
        bloodType: sanitizeField(bloodType, 10),
        height: sanitizeField(height, 20),
        weight: sanitizeField(weight, 20),
        primaryCareProvider: sanitizeName(primaryCareProvider),
        lastPhysical: sanitizeField(lastPhysical, 30),
        lastDental: sanitizeField(lastDental, 30),
        lastEyeExam: sanitizeField(lastEyeExam, 30),
        currentInsurance: sanitizeField(currentInsurance, 100),
        // history
        medications: sanitizeField(medications),
        allergies: sanitizeField(allergies),
        conditions: sanitizeField(conditions),
        surgeries: sanitizeField(surgeries),
        vaccinations: sanitizeField(vaccinations),
        // lifestyle
        lifestyle: {
          smoking: sanitizeField(smoking, 100),
          alcohol: sanitizeField(alcohol, 100),
          exercise: sanitizeField(exercise, 100),
          diet: sanitizeField(diet, 200),
        },
        familyHistory: sanitizeField(familyHistory),
        mentalHealthHistory: sanitizeField(mentalHealthHistory),
        pregnancyStatus: sanitizeField(pregnancyStatus, 100),
        // emergency
        emergencyContact: {
          name: sanitizeName(emergencyName),
          phone: sanitizePhone(emergencyPhone),
          relation: sanitizeField(emergencyRelation, 50),
        },
        emergencyContact2: {
          name: sanitizeName(emergencyName2),
          phone: sanitizePhone(emergencyPhone2),
          relation: sanitizeField(emergencyRelation2, 50),
        },
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 2,
      });
      await setDoc(
        doc(db, "users", user.uid),
        { intakeComplete: true },
        { merge: true },
      );
      if (redirectTo) {
        router.replace(redirectTo as any);
      } else {
        router.back();
      }
    } catch {
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
          onPress: () =>
            redirectTo ? router.replace(redirectTo as any) : router.back(),
        },
      ],
    );
  };

  const progress = step / (STEPS.length - 1);

  const Field = ({
    label,
    hint,
    value,
    onChange,
    multiline = false,
    placeholder = "",
    keyboardType = "default" as any,
    maxLength = 500,
  }: {
    label: string;
    hint?: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    keyboardType?: any;
    maxLength?: number;
  }) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      {hint && (
        <Text style={[styles.fieldHint, { color: colors.subtext }]}>
          {hint}
        </Text>
      )}
      <TextInput
        style={[
          multiline ? styles.textArea : styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.subtext}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        maxLength={maxLength}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {multiline && (
        <Text style={[styles.charCount, { color: colors.subtext }]}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );

  const SelectRow = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionChip,
              {
                backgroundColor: value === opt ? colors.primary : colors.card,
                borderColor: value === opt ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(value === opt ? "" : opt)}
          >
            <Text
              style={{
                color: value === opt ? "#fff" : colors.text,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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
        {/* ── Welcome ──────────────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.welcomeWrap}>
            <Text style={styles.welcomeEmoji}>🏥</Text>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              {lastSaved ? "Your Health Profile" : "Set up your Health Profile"}
            </Text>
            {lastSaved && (
              <View
                style={[
                  styles.savedBadge,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ fontSize: 13 }}>✅</Text>
                <Text style={[styles.savedText, { color: colors.subtext }]}>
                  Last updated {lastSaved} — tap Continue to edit
                </Text>
              </View>
            )}
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
                You fill this out{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  once
                </Text>
                , and it is saved securely to your Morava account. Only
                providers you book with can see it.
                {"\n\n"}
                Update it anytime from{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Profile → Health Profile
                </Text>
                .
              </Text>
            </View>
            <View style={[styles.privacyRow, { borderColor: colors.border }]}>
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <Text style={[styles.privacyText, { color: colors.subtext }]}>
                Encrypted and never sold or shared with advertisers.
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 1: Basic health info ─────────────────────────────────── */}
        {step === 1 && (
          <View>
            <SelectRow
              label="Blood Type"
              options={[
                "A+",
                "A−",
                "B+",
                "B−",
                "AB+",
                "AB−",
                "O+",
                "O−",
                "Unknown",
              ]}
              value={bloodType}
              onChange={setBloodType}
            />
            <Field
              label="Height"
              placeholder={"e.g. 5'8\" or 173 cm"}
              value={height}
              onChange={setHeight}
              maxLength={20}
            />
            <Field
              label="Weight"
              placeholder="e.g. 165 lbs or 75 kg"
              value={weight}
              onChange={setWeight}
              maxLength={20}
            />
            <Field
              label="Current Insurance / Plan"
              hint="Your active insurance at time of visit"
              placeholder="e.g. SoonerCare, BlueCross PPO, Uninsured"
              value={currentInsurance}
              onChange={setCurrentInsurance}
              maxLength={100}
            />
            <Field
              label="Primary Care Provider"
              hint="Your current main doctor, if any"
              placeholder='e.g. Dr. Jane Smith or "None"'
              value={primaryCareProvider}
              onChange={setPrimaryCareProvider}
              maxLength={100}
            />
            <Field
              label="Last Physical Exam"
              placeholder='e.g. March 2024 or "Never"'
              value={lastPhysical}
              onChange={setLastPhysical}
              maxLength={30}
            />
            <Field
              label="Last Dental Visit"
              placeholder='e.g. January 2025 or "Never"'
              value={lastDental}
              onChange={setLastDental}
              maxLength={30}
            />
            <Field
              label="Last Eye Exam"
              placeholder='e.g. 2023 or "Never"'
              value={lastEyeExam}
              onChange={setLastEyeExam}
              maxLength={30}
            />
          </View>
        )}

        {/* ── Step 2: Medical history ───────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Field
              label="Current Medications"
              hint="Include prescription, over-the-counter, and supplements. Type None if not applicable."
              placeholder={
                "e.g. Metformin 500mg, Lisinopril 10mg, Vitamin D\n\nOr type None"
              }
              value={medications}
              onChange={setMedications}
              multiline
            />
            <Field
              label="Known Allergies"
              hint="Medication, food, environmental, latex. Type None if not applicable."
              placeholder={
                "e.g. Penicillin, Shellfish, Latex, Pollen\n\nOr type None"
              }
              value={allergies}
              onChange={setAllergies}
              multiline
            />
            <Field
              label="Diagnosed Conditions"
              hint="Chronic illnesses, ongoing conditions. Type None if not applicable."
              placeholder={
                "e.g. Type 2 Diabetes, Hypertension, Asthma\n\nOr type None"
              }
              value={conditions}
              onChange={setConditions}
              multiline
            />
            <Field
              label="Surgeries & Hospitalizations"
              hint="Include dental and eye procedures in the last 10 years. Type None if not applicable."
              placeholder={
                "e.g. Appendectomy 2018, Wisdom teeth 2022, LASIK 2023\n\nOr type None"
              }
              value={surgeries}
              onChange={setSurgeries}
              multiline
            />
            <Field
              label="Vaccinations"
              hint="List vaccines received or type Unknown if unsure."
              placeholder={
                "e.g. COVID-19 (2021), Flu (annual), Tetanus (2019)\n\nOr type Unknown"
              }
              value={vaccinations}
              onChange={setVaccinations}
              multiline
            />
          </View>
        )}

        {/* ── Step 3: Lifestyle & family ────────────────────────────────── */}
        {step === 3 && (
          <View>
            <SelectRow
              label="Smoking / Tobacco"
              options={["Never", "Former", "Current", "E-cigarette"]}
              value={smoking}
              onChange={setSmoking}
            />
            <SelectRow
              label="Alcohol Use"
              options={["None", "Occasional", "Moderate", "Heavy"]}
              value={alcohol}
              onChange={setAlcohol}
            />
            <SelectRow
              label="Exercise Frequency"
              options={["None", "1–2×/week", "3–4×/week", "Daily"]}
              value={exercise}
              onChange={setExercise}
            />
            <Field
              label="Diet / Nutritional Notes"
              hint="Any dietary restrictions, preferences, or concerns."
              placeholder={
                "e.g. Vegetarian, Diabetic diet, Gluten-free\n\nOr type None"
              }
              value={diet}
              onChange={setDiet}
              multiline
              maxLength={200}
            />
            <Field
              label="Family Medical History"
              hint="Conditions that run in your immediate family (parents, siblings)."
              placeholder={
                "e.g. Father: Heart disease, Mother: Type 2 Diabetes\n\nOr type Unknown"
              }
              value={familyHistory}
              onChange={setFamilyHistory}
              multiline
            />
            <Field
              label="Mental Health History"
              hint="Any diagnosed mental health conditions or current treatment."
              placeholder={
                "e.g. Anxiety (treated), Depression (in remission)\n\nOr type None"
              }
              value={mentalHealthHistory}
              onChange={setMentalHealthHistory}
              multiline
            />
            <SelectRow
              label="Pregnancy Status (if applicable)"
              options={[
                "N/A",
                "Not pregnant",
                "Pregnant",
                "Postpartum",
                "Trying to conceive",
              ]}
              value={pregnancyStatus}
              onChange={setPregnancyStatus}
            />
          </View>
        )}

        {/* ── Step 4: Emergency contact ─────────────────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={[styles.sectionHeader, { color: colors.primary }]}>
              Primary Contact
            </Text>
            <Field
              label="Full Name"
              placeholder="Full name"
              value={emergencyName}
              onChange={(v) => setEmergencyName(sanitizeName(v))}
              maxLength={100}
            />
            <Field
              label="Phone Number"
              placeholder="Phone number"
              value={emergencyPhone}
              onChange={setEmergencyPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <Field
              label="Relationship"
              placeholder="e.g. Spouse, Parent, Sibling"
              value={emergencyRelation}
              onChange={setEmergencyRelation}
              maxLength={50}
            />

            <Text
              style={[
                styles.sectionHeader,
                { color: colors.primary, marginTop: 8 },
              ]}
            >
              Secondary Contact (optional)
            </Text>
            <Field
              label="Full Name"
              placeholder="Full name"
              value={emergencyName2}
              onChange={(v) => setEmergencyName2(sanitizeName(v))}
              maxLength={100}
            />
            <Field
              label="Phone Number"
              placeholder="Phone number"
              value={emergencyPhone2}
              onChange={setEmergencyPhone2}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <Field
              label="Relationship"
              placeholder="e.g. Friend, Sibling"
              value={emergencyRelation2}
              onChange={setEmergencyRelation2}
              maxLength={50}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer */}
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
  fieldLabel: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  fieldHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 100,
  },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 0,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 16,
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
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  savedText: { fontSize: 13, flex: 1 },
});
