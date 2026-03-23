import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

// ─── Sanitizers ───────────────────────────────────────────────────────────────
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

// ─── Comprehensive reference lists ────────────────────────────────────────────
const COMMON_MEDICATIONS = [
  "Acetaminophen (Tylenol)",
  "Ibuprofen (Advil/Motrin)",
  "Aspirin",
  "Lisinopril",
  "Metformin",
  "Atorvastatin (Lipitor)",
  "Levothyroxine",
  "Amlodipine",
  "Metoprolol",
  "Omeprazole",
  "Losartan",
  "Albuterol",
  "Gabapentin",
  "Sertraline (Zoloft)",
  "Fluoxetine (Prozac)",
  "Bupropion (Wellbutrin)",
  "Escitalopram (Lexapro)",
  "Duloxetine (Cymbalta)",
  "Hydrochlorothiazide",
  "Furosemide",
  "Carvedilol",
  "Simvastatin",
  "Rosuvastatin",
  "Pantoprazole",
  "Clopidogrel",
  "Montelukast",
  "Prednisone",
  "Amoxicillin",
  "Azithromycin",
  "Doxycycline",
  "Ciprofloxacin",
  "Insulin (various)",
  "Warfarin",
  "Apixaban (Eliquis)",
  "Rivaroxaban (Xarelto)",
  "Tamsulosin",
  "Sildenafil",
  "Methylphenidate (Ritalin)",
  "Amphetamine (Adderall)",
  "Hydroxychloroquine",
  "Vitamin D",
  "Fish Oil",
  "Multivitamin",
  "Magnesium",
  "Zinc",
  "Melatonin",
  "Biotin",
  "Iron supplement",
  "B12",
  "Folate",
  "Calcium",
];

const COMMON_ALLERGIES = [
  "Penicillin",
  "Amoxicillin",
  "Sulfa drugs",
  "Aspirin",
  "Ibuprofen (NSAIDs)",
  "Codeine",
  "Morphine",
  "Latex",
  "Shellfish",
  "Peanuts",
  "Tree nuts",
  "Milk/Dairy",
  "Eggs",
  "Wheat/Gluten",
  "Soy",
  "Fish",
  "Sesame",
  "Pollen",
  "Dust mites",
  "Pet dander (cats)",
  "Pet dander (dogs)",
  "Mold",
  "Bee/wasp stings",
  "Nickel",
  "Fragrance",
  "Contrast dye (iodine)",
  "No known allergies",
];

const COMMON_CONDITIONS = [
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Prediabetes",
  "Hypertension (High Blood Pressure)",
  "High Cholesterol",
  "Coronary Artery Disease",
  "Heart Failure",
  "Atrial Fibrillation",
  "Asthma",
  "COPD",
  "Sleep Apnea",
  "Hypothyroidism",
  "Hyperthyroidism",
  "PCOS",
  "Chronic Kidney Disease",
  "GERD / Acid Reflux",
  "IBS",
  "Crohn's Disease",
  "Ulcerative Colitis",
  "Celiac Disease",
  "Rheumatoid Arthritis",
  "Osteoarthritis",
  "Osteoporosis",
  "Lupus",
  "Multiple Sclerosis",
  "Epilepsy / Seizures",
  "Migraine",
  "Anxiety Disorder",
  "Depression",
  "Bipolar Disorder",
  "ADHD",
  "PTSD",
  "Schizophrenia",
  "Autism Spectrum Disorder",
  "HIV/AIDS",
  "Hepatitis B",
  "Hepatitis C",
  "Cancer (specify in notes)",
  "Sickle Cell Disease",
  "Anemia",
  "Obesity",
  "Fibromyalgia",
  "Chronic Pain",
  "Eczema",
  "Psoriasis",
  "Stroke (history of)",
  "TIA (mini-stroke)",
  "Deep Vein Thrombosis",
];

const COMMON_VACCINATIONS = [
  "COVID-19 (Pfizer)",
  "COVID-19 (Moderna)",
  "COVID-19 (J&J)",
  "Influenza (Flu) — Annual",
  "Tetanus/Tdap",
  "Hepatitis A",
  "Hepatitis B",
  "HPV",
  "MMR (Measles/Mumps/Rubella)",
  "Varicella (Chickenpox)",
  "Shingles (Shingrix)",
  "Pneumococcal (Pneumonia)",
  "Meningococcal",
  "Polio",
  "RSV",
  "Rabies",
  "Yellow Fever",
  "Typhoid",
];

const COMMON_SURGERIES = [
  "Appendectomy",
  "Gallbladder removal (Cholecystectomy)",
  "Hernia repair",
  "Knee replacement",
  "Hip replacement",
  "ACL repair",
  "Rotator cuff repair",
  "Spinal fusion",
  "Discectomy",
  "C-section",
  "Hysterectomy",
  "Tubal ligation",
  "Vasectomy",
  "LASIK eye surgery",
  "Cataract surgery",
  "Wisdom teeth removal",
  "Tonsillectomy",
  "Adenoidectomy",
  "Cardiac stent placement",
  "Bypass surgery",
  "Pacemaker implant",
  "Thyroid surgery",
  "Kidney stone removal",
  "Colonoscopy / Polypectomy",
  "Gastric sleeve / Bypass",
  "Mastectomy",
  "Prostatectomy",
  "Skin biopsy",
  "Mole removal",
];

const FAMILY_CONDITIONS = [
  "Heart Disease",
  "Stroke",
  "Type 2 Diabetes",
  "High Blood Pressure",
  "High Cholesterol",
  "Cancer (Breast)",
  "Cancer (Colon)",
  "Cancer (Prostate)",
  "Cancer (Lung)",
  "Cancer (Other)",
  "Alzheimer's / Dementia",
  "Depression",
  "Anxiety",
  "Bipolar Disorder",
  "Schizophrenia",
  "Autoimmune Disease",
  "Kidney Disease",
  "Thyroid Disease",
  "Osteoporosis",
  "Sickle Cell Disease",
  "Asthma",
  "Obesity",
  "Alcoholism / Addiction",
  "Glaucoma",
];

const INSURANCE_PLANS = [
  "SoonerCare (Medicaid Oklahoma)",
  "Medicaid",
  "Medicare",
  "Medicare Advantage",
  "BlueCross BlueShield",
  "BlueCross BlueShield PPO",
  "BlueCross BlueShield HMO",
  "Aetna",
  "Aetna PPO",
  "Aetna HMO",
  "United Healthcare",
  "United Healthcare PPO",
  "Cigna",
  "Cigna PPO",
  "Humana",
  "Humana PPO",
  "Tricare (Military)",
  "VA Benefits",
  "CHIP",
  "Marketplace / Exchange Plan",
  "Employer-sponsored plan",
  "COBRA",
  "Uninsured / Self-pay",
  "Sliding scale / Charity care",
];

const DIET_OPTIONS = [
  "No restrictions",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Diabetic diet",
  "Low-sodium",
  "Low-fat",
  "Keto",
  "Mediterranean",
  "Halal",
  "Kosher",
  "Nut-free",
  "Low-FODMAP",
  "Intermittent fasting",
];

const MENTAL_HEALTH_OPTIONS = [
  "No history",
  "Anxiety (diagnosed)",
  "Anxiety (undiagnosed/suspected)",
  "Depression (diagnosed)",
  "Depression (undiagnosed/suspected)",
  "Bipolar Disorder",
  "PTSD",
  "ADHD",
  "OCD",
  "Eating disorder",
  "Substance use disorder",
  "Schizophrenia",
  "Currently in therapy",
  "Currently on psychiatric medication",
  "Past hospitalization",
];

// ─── Steps ─────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "welcome", title: "Health Profile", subtitle: "One-time setup" },
  { id: "basics", title: "Basic Health Info", subtitle: "Step 1 of 4" },
  { id: "history", title: "Medical History", subtitle: "Step 2 of 4" },
  { id: "lifestyle", title: "Lifestyle & Family", subtitle: "Step 3 of 4" },
  { id: "emergency", title: "Emergency Contact", subtitle: "Step 4 of 4" },
];

// ─── Sub-components (defined outside to prevent keyboard dismissal) ─────────

interface ChipSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  colors: any;
  single?: boolean;
  hint?: string;
}

const ChipSelect = React.memo(function ChipSelect({
  label,
  options,
  selected,
  onToggle,
  colors,
  single,
  hint,
}: ChipSelectProps) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>{label}</Text>
      {hint && (
        <Text style={[s.fieldHint, { color: colors.subtext }]}>{hint}</Text>
      )}
      <View style={s.chipWrap}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[
                s.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onToggle(opt)}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.text,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {single && selected.length > 0 && (
        <Text style={[s.selectedNote, { color: colors.primary }]}>
          Selected: {selected[0]}
        </Text>
      )}
    </View>
  );
});

interface SearchPickerProps {
  label: string;
  hint?: string;
  items: string[];
  selected: string[];
  onToggle: (val: string) => void;
  placeholder: string;
  colors: any;
}

const SearchPicker = React.memo(function SearchPicker({
  label,
  hint,
  items,
  selected,
  onToggle,
  placeholder,
  colors,
}: SearchPickerProps) {
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);
  const [customText, setCustomText] = useState("");
  const filtered = items
    .filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>{label}</Text>
      {hint && (
        <Text style={[s.fieldHint, { color: colors.subtext }]}>{hint}</Text>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={s.chipWrap}>
          {selected.map((sel) => (
            <TouchableOpacity
              key={sel}
              style={[
                s.chip,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => onToggle(sel)}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {sel} ✕
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search input */}
      <TouchableOpacity
        style={[
          s.searchBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => setShowList(true)}
        activeOpacity={0.7}
      >
        <Text
          style={{
            fontSize: 14,
            color: selected.length > 0 ? colors.primary : colors.subtext,
          }}
        >
          🔍{" "}
          {selected.length > 0
            ? `${selected.length} selected — tap to add more`
            : placeholder}
        </Text>
      </TouchableOpacity>

      {/* Modal picker */}
      <Modal
        visible={showList}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[s.modalContainer, { backgroundColor: colors.background }]}
        >
          <View
            style={[
              s.modalHeader,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>{label}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowList(false);
                setQuery("");
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              s.modalSearch,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.text }}
              placeholder="Search..."
              placeholderTextColor={colors.subtext}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 16,
                    paddingLeft: 8,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(i) => i}
            renderItem={({ item }) => {
              const active = selected.includes(item);
              return (
                <TouchableOpacity
                  style={[
                    s.modalItem,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: active
                        ? colors.primary + "10"
                        : colors.background,
                    },
                  ]}
                  onPress={() => onToggle(item)}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: active ? colors.primary : colors.text,
                      fontWeight: active ? "700" : "400",
                    }}
                  >
                    {item}
                  </Text>
                  {active && (
                    <Text style={{ color: colors.primary, fontSize: 18 }}>
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              <View style={{ padding: 20 }}>
                <Text
                  style={[
                    s.fieldLabel,
                    { color: colors.text, marginBottom: 8 },
                  ]}
                >
                  Not in the list? Add custom:
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[
                      s.input,
                      {
                        flex: 1,
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Type here..."
                    placeholderTextColor={colors.subtext}
                    value={customText}
                    onChangeText={setCustomText}
                  />
                  <TouchableOpacity
                    style={[s.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      const clean = sanitizeField(customText, 100);
                      if (clean && !selected.includes(clean)) {
                        onToggle(clean);
                        setCustomText("");
                      }
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
});

interface DateFieldProps {
  label: string;
  hint?: string;
  value: Date | null;
  onChange: (d: Date) => void;
  colors: any;
  maxDate?: Date;
  minDate?: Date;
}

const DateField = React.memo(function DateField({
  label,
  hint,
  value,
  onChange,
  colors,
  maxDate,
  minDate,
}: DateFieldProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const displayDate =
    value && value.getTime() > 0
      ? value.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>{label}</Text>
      {hint && (
        <Text style={[s.fieldHint, { color: colors.subtext }]}>{hint}</Text>
      )}
      <TouchableOpacity
        style={[
          s.dateBox,
          {
            backgroundColor: colors.card,
            borderColor: displayDate ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          setTempDate(value && value.getTime() > 0 ? value : new Date());
          setShow(true);
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: displayDate ? colors.text : colors.subtext,
          }}
        >
          📅 {displayDate || "Tap to select date"}
        </Text>
        {displayDate && (
          <TouchableOpacity onPress={() => onChange(new Date(0))}>
            <Text style={{ color: colors.subtext, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* iOS — modal wrapper so spinner is visible */}
      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: 32,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text
                    style={{
                      color: colors.subtext,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {label}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(tempDate);
                    setShow(false);
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                maximumDate={maxDate || new Date()}
                minimumDate={minDate}
                onChange={(_, date) => {
                  if (date) setTempDate(date);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            maximumDate={maxDate || new Date()}
            minimumDate={minDate}
            onChange={(_, date) => {
              setShow(false);
              if (date) onChange(date);
            }}
          />
        )
      )}
    </View>
  );
});

interface HeightPickerProps {
  feet: string;
  inches: string;
  onFeetChange: (v: string) => void;
  onInchesChange: (v: string) => void;
  colors: any;
}

const HeightPicker = React.memo(function HeightPicker({
  feet,
  inches,
  onFeetChange,
  onInchesChange,
  colors,
}: HeightPickerProps) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>Height</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.fieldHint, { color: colors.subtext }]}>Feet</Text>
          <View style={s.chipWrap}>
            {["1", "2", "3", "4", "5", "6", "7", "8"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  s.chip,
                  {
                    backgroundColor: feet === f ? colors.primary : colors.card,
                    borderColor: feet === f ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => onFeetChange(f)}
              >
                <Text
                  style={{
                    color: feet === f ? "#fff" : colors.text,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {f}′
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ flex: 2 }}>
          <Text style={[s.fieldHint, { color: colors.subtext }]}>Inches</Text>
          <View style={s.chipWrap}>
            {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map(
              (i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        inches === i ? colors.primary : colors.card,
                      borderColor:
                        inches === i ? colors.primary : colors.border,
                      minWidth: 36,
                    },
                  ]}
                  onPress={() => onInchesChange(inches === i ? "" : i)}
                >
                  <Text
                    style={{
                      color: inches === i ? "#fff" : colors.text,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {i}″
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

interface WeightPickerProps {
  value: string;
  onChange: (v: string) => void;
  colors: any;
}

const WeightPicker = React.memo(function WeightPicker({
  value,
  onChange,
  colors,
}: WeightPickerProps) {
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const weights =
    unit === "lbs"
      ? Array.from({ length: 41 }, (_, i) => `${80 + i * 5} lbs`)
      : Array.from({ length: 41 }, (_, i) => `${35 + i * 3} kg`);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>Weight</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {(["lbs", "kg"] as const).map((u) => (
          <TouchableOpacity
            key={u}
            style={[
              s.chip,
              {
                backgroundColor: unit === u ? colors.primary : colors.card,
                borderColor: unit === u ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setUnit(u);
              onChange("");
            }}
          >
            <Text
              style={{
                color: unit === u ? "#fff" : colors.text,
                fontWeight: "700",
              }}
            >
              {u}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
          {weights.map((w) => (
            <TouchableOpacity
              key={w}
              style={[
                s.chip,
                {
                  backgroundColor: value === w ? colors.primary : colors.card,
                  borderColor: value === w ? colors.primary : colors.border,
                  minWidth: 72,
                },
              ]}
              onPress={() => onChange(w)}
            >
              <Text
                style={{
                  color: value === w ? "#fff" : colors.text,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {w}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.subtext, flex: 1 }}>
          Or type exact weight:
        </Text>
        <TextInput
          style={[
            s.input,
            {
              flex: 1,
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
              paddingVertical: 10,
            },
          ]}
          placeholder={`e.g. 143 ${unit}`}
          placeholderTextColor={colors.subtext}
          value={!weights.includes(value) ? value : ""}
          onChangeText={(v) => onChange(sanitizeField(v, 10))}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IntakeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const redirectTo = (params.redirect as string) || null;
  const patientId = (params.patientId as string) || null;
  const patientName = (params.patientName as string) || null;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // ── Step 1: Basic health info ───────────────────────────────────────────
  const [bloodType, setBloodType] = useState<string[]>([]);
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [currentInsurance, setCurrentInsurance] = useState<string[]>([]);
  const [primaryCareProvider, setPrimaryCareProvider] = useState("");
  const [lastPhysical, setLastPhysical] = useState<Date | null>(null);
  const [lastDental, setLastDental] = useState<Date | null>(null);
  const [lastEyeExam, setLastEyeExam] = useState<Date | null>(null);

  // ── Step 2: Medical history ─────────────────────────────────────────────
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [surgeries, setSurgeries] = useState<string[]>([]);
  const [vaccinations, setVaccinations] = useState<string[]>([]);

  // ── Step 3: Lifestyle & family ──────────────────────────────────────────
  const [smoking, setSmoking] = useState<string[]>([]);
  const [alcohol, setAlcohol] = useState<string[]>([]);
  const [exercise, setExercise] = useState<string[]>([]);
  const [diet, setDiet] = useState<string[]>([]);
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [mentalHealthHistory, setMentalHealthHistory] = useState<string[]>([]);
  const [pregnancyStatus, setPregnancyStatus] = useState<string[]>([]);

  // ── Step 4: Emergency contact ───────────────────────────────────────────
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [emergencyName2, setEmergencyName2] = useState("");
  const [emergencyPhone2, setEmergencyPhone2] = useState("");
  const [emergencyRelation2, setEmergencyRelation2] = useState("");

  const toggle = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<string[]>>,
      single?: boolean,
    ) =>
      (val: string) =>
        setter((prev) =>
          prev.includes(val)
            ? prev.filter((v) => v !== val)
            : single
              ? [val]
              : [...prev, val],
        ),
    [],
  );

  // ── Load existing data ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Pre-populate insurance from insurance collection
      try {
        const insSnap = await getDoc(doc(db, "insurance", user.uid));
        if (insSnap.exists()) {
          const ins = insSnap.data();
          if (ins.provider) setCurrentInsurance([ins.provider]);
        }
      } catch {
        /* non-critical */
      }

      // Load existing intake
      try {
        const docId = patientId || user.uid;
        const snap = await getDoc(doc(db, "intakeForms", docId));
        if (snap.exists()) {
          const d = snap.data();
          if (d.bloodType) setBloodType([d.bloodType]);
          if (d.heightFeet) setHeightFeet(d.heightFeet);
          if (d.heightInches) setHeightInches(d.heightInches);
          if (d.weight) setWeight(d.weight);
          if (d.currentInsurance)
            setCurrentInsurance(
              Array.isArray(d.currentInsurance)
                ? d.currentInsurance
                : [d.currentInsurance],
            );
          if (d.primaryCareProvider)
            setPrimaryCareProvider(d.primaryCareProvider);
          if (d.lastPhysical?.toDate) setLastPhysical(d.lastPhysical.toDate());
          if (d.lastDental?.toDate) setLastDental(d.lastDental.toDate());
          if (d.lastEyeExam?.toDate) setLastEyeExam(d.lastEyeExam.toDate());
          if (d.medications)
            setMedications(Array.isArray(d.medications) ? d.medications : []);
          if (d.allergies)
            setAllergies(Array.isArray(d.allergies) ? d.allergies : []);
          if (d.conditions)
            setConditions(Array.isArray(d.conditions) ? d.conditions : []);
          if (d.surgeries)
            setSurgeries(Array.isArray(d.surgeries) ? d.surgeries : []);
          if (d.vaccinations)
            setVaccinations(
              Array.isArray(d.vaccinations) ? d.vaccinations : [],
            );
          if (d.lifestyle?.smoking) setSmoking([d.lifestyle.smoking]);
          if (d.lifestyle?.alcohol) setAlcohol([d.lifestyle.alcohol]);
          if (d.lifestyle?.exercise) setExercise([d.lifestyle.exercise]);
          if (d.lifestyle?.diet)
            setDiet(Array.isArray(d.lifestyle.diet) ? d.lifestyle.diet : []);
          if (d.familyHistory)
            setFamilyHistory(
              Array.isArray(d.familyHistory) ? d.familyHistory : [],
            );
          if (d.mentalHealthHistory)
            setMentalHealthHistory(
              Array.isArray(d.mentalHealthHistory) ? d.mentalHealthHistory : [],
            );
          if (d.pregnancyStatus) setPregnancyStatus([d.pregnancyStatus]);
          if (d.emergencyContact?.name)
            setEmergencyName(d.emergencyContact.name);
          if (d.emergencyContact?.phone)
            setEmergencyPhone(d.emergencyContact.phone);
          if (d.emergencyContact?.relation)
            setEmergencyRelation(d.emergencyContact.relation);
          if (d.emergencyContact2?.name)
            setEmergencyName2(d.emergencyContact2.name);
          if (d.emergencyContact2?.phone)
            setEmergencyPhone2(d.emergencyContact2.phone);
          if (d.emergencyContact2?.relation)
            setEmergencyRelation2(d.emergencyContact2.relation);
          if (d.updatedAt?.toDate)
            setLastSaved(d.updatedAt.toDate().toLocaleDateString());
        }
      } catch {
        /* non-critical */
      }
    };
    load();
  }, [patientId]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      const docId = patientId || user.uid;
      const heightStr =
        heightFeet && heightInches
          ? `${heightFeet}'${heightInches}"`
          : heightFeet
            ? `${heightFeet}'`
            : "";
      await setDoc(doc(db, "intakeForms", docId), {
        userId: user.uid,
        patientId: docId,
        bloodType: bloodType[0] ? sanitizeField(bloodType[0], 10) : "",
        heightFeet: sanitizeField(heightFeet, 5),
        heightInches: sanitizeField(heightInches, 5),
        height: heightStr,
        weight: sanitizeField(weight, 20),
        currentInsurance: currentInsurance.map((v) => sanitizeField(v, 100)),
        primaryCareProvider: sanitizeName(primaryCareProvider),
        lastPhysical:
          lastPhysical && lastPhysical.getTime() > 0 ? lastPhysical : null,
        lastDental: lastDental && lastDental.getTime() > 0 ? lastDental : null,
        lastEyeExam:
          lastEyeExam && lastEyeExam.getTime() > 0 ? lastEyeExam : null,
        medications: medications.map((v) => sanitizeField(v, 100)),
        allergies: allergies.map((v) => sanitizeField(v, 100)),
        conditions: conditions.map((v) => sanitizeField(v, 100)),
        surgeries: surgeries.map((v) => sanitizeField(v, 100)),
        vaccinations: vaccinations.map((v) => sanitizeField(v, 100)),
        lifestyle: {
          smoking: smoking[0] ? sanitizeField(smoking[0], 50) : "",
          alcohol: alcohol[0] ? sanitizeField(alcohol[0], 50) : "",
          exercise: exercise[0] ? sanitizeField(exercise[0], 50) : "",
          diet: diet.map((v) => sanitizeField(v, 50)),
        },
        familyHistory: familyHistory.map((v) => sanitizeField(v, 100)),
        mentalHealthHistory: mentalHealthHistory.map((v) =>
          sanitizeField(v, 100),
        ),
        pregnancyStatus: pregnancyStatus[0]
          ? sanitizeField(pregnancyStatus[0], 50)
          : "",
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
        version: 3,
      });
      if (!patientId) {
        await setDoc(
          doc(db, "users", user.uid),
          { intakeComplete: true },
          { merge: true },
        );
      }
      if (redirectTo) router.replace(redirectTo as any);
      else router.back();
    } catch (err) {
      console.error("❌ Intake save error:", err);
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
      "Your provider won't have your health history before the visit. Complete it later in Profile → Health Profile.",
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

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          s.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={s.headerTop}>
          <View>
            <Text style={[s.stepLabel, { color: colors.primary }]}>
              {STEPS[step].subtitle}
            </Text>
            <Text style={[s.title, { color: colors.text }]}>
              {STEPS[step].title}
            </Text>
          </View>
          {step > 0 && (
            <TouchableOpacity onPress={handleSkip}>
              <Text style={[s.skipBtn, { color: colors.subtext }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[s.progressBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              s.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Welcome ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <View style={s.welcomeWrap}>
            <Text style={s.welcomeEmoji}>🏥</Text>
            <Text style={[s.welcomeTitle, { color: colors.text }]}>
              {patientName
                ? lastSaved
                  ? `${patientName}'s Health Profile`
                  : `Set up ${patientName}'s Health Profile`
                : lastSaved
                  ? "Your Health Profile"
                  : "Set up your Health Profile"}
            </Text>
            {lastSaved && (
              <View
                style={[
                  s.savedBadge,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ fontSize: 13 }}>✅</Text>
                <Text style={[s.savedText, { color: colors.subtext }]}>
                  Last updated {lastSaved} — tap Continue to edit
                </Text>
              </View>
            )}
            <View
              style={[
                s.trustCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[s.trustTitle, { color: colors.primary }]}>
                Why we ask
              </Text>
              <Text style={[s.trustText, { color: colors.subtext }]}>
                Your health profile helps providers prepare for your visit
                before you arrive — so they can give you better, faster care.
                {"\n\n"}
                You fill this out{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  once
                </Text>
                , and it is saved securely to your Morava account. Only
                providers you book with can see it.{"\n\n"}
                Update it anytime from{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Profile → Health Profile
                </Text>
                .
              </Text>
            </View>
            <View style={[s.privacyRow, { borderColor: colors.border }]}>
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <Text style={[s.privacyText, { color: colors.subtext }]}>
                Encrypted and never sold or shared with advertisers.
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 1: Basic health info ────────────────────────────────── */}
        {step === 1 && (
          <View>
            <ChipSelect
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
              selected={bloodType}
              onToggle={toggle(setBloodType, true)}
              colors={colors}
              single
            />
            <HeightPicker
              feet={heightFeet}
              inches={heightInches}
              onFeetChange={setHeightFeet}
              onInchesChange={setHeightInches}
              colors={colors}
            />
            <WeightPicker value={weight} onChange={setWeight} colors={colors} />
            <SearchPicker
              label="Insurance / Coverage"
              hint="Your active insurance — pre-filled from your saved plan if available"
              items={INSURANCE_PLANS}
              selected={currentInsurance}
              onToggle={toggle(setCurrentInsurance, true)}
              placeholder="Search insurance plans..."
              colors={colors}
            />
            <View style={{ marginBottom: 20 }}>
              <Text style={[s.fieldLabel, { color: colors.text }]}>
                Primary Care Provider
              </Text>
              <Text style={[s.fieldHint, { color: colors.subtext }]}>
                Your current main doctor, if any
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder='e.g. Dr. Jane Smith or "None"'
                placeholderTextColor={colors.subtext}
                value={primaryCareProvider}
                onChangeText={setPrimaryCareProvider}
                maxLength={100}
              />
            </View>
            <DateField
              label="Last Physical Exam"
              hint="Approximate date is fine"
              value={lastPhysical}
              onChange={setLastPhysical}
              colors={colors}
            />
            <DateField
              label="Last Dental Visit"
              value={lastDental}
              onChange={setLastDental}
              colors={colors}
            />
            <DateField
              label="Last Eye Exam"
              value={lastEyeExam}
              onChange={setLastEyeExam}
              colors={colors}
            />
          </View>
        )}

        {/* ── Step 2: Medical history ──────────────────────────────────── */}
        {step === 2 && (
          <View>
            <SearchPicker
              label="Current Medications"
              hint="Include prescription, OTC, and supplements. Select all that apply."
              items={COMMON_MEDICATIONS}
              selected={medications}
              onToggle={toggle(setMedications)}
              placeholder="Search medications..."
              colors={colors}
            />
            <SearchPicker
              label="Known Allergies"
              hint="Medications, food, environmental, latex."
              items={COMMON_ALLERGIES}
              selected={allergies}
              onToggle={toggle(setAllergies)}
              placeholder="Search allergies..."
              colors={colors}
            />
            <SearchPicker
              label="Diagnosed Conditions"
              hint="Chronic illnesses and ongoing conditions."
              items={COMMON_CONDITIONS}
              selected={conditions}
              onToggle={toggle(setConditions)}
              placeholder="Search conditions..."
              colors={colors}
            />
            <SearchPicker
              label="Surgeries & Hospitalizations"
              hint="Include dental and eye procedures in the last 10 years."
              items={COMMON_SURGERIES}
              selected={surgeries}
              onToggle={toggle(setSurgeries)}
              placeholder="Search procedures..."
              colors={colors}
            />
            <SearchPicker
              label="Vaccinations Received"
              hint="Select all vaccines you have received."
              items={COMMON_VACCINATIONS}
              selected={vaccinations}
              onToggle={toggle(setVaccinations)}
              placeholder="Search vaccines..."
              colors={colors}
            />
          </View>
        )}

        {/* ── Step 3: Lifestyle & family ───────────────────────────────── */}
        {step === 3 && (
          <View>
            <ChipSelect
              label="Smoking / Tobacco"
              options={[
                "Never",
                "Former smoker",
                "Current — occasional",
                "Current — daily",
                "E-cigarette / Vape",
              ]}
              selected={smoking}
              onToggle={toggle(setSmoking, true)}
              colors={colors}
              single
            />
            <ChipSelect
              label="Alcohol Use"
              options={[
                "None",
                "Social / Occasional",
                "Moderate (1–2 drinks/day)",
                "Heavy (3+/day)",
                "In recovery",
              ]}
              selected={alcohol}
              onToggle={toggle(setAlcohol, true)}
              colors={colors}
              single
            />
            <ChipSelect
              label="Exercise Frequency"
              options={[
                "Sedentary (none)",
                "Light (1–2×/week)",
                "Moderate (3–4×/week)",
                "Active (5+×/week)",
                "Athlete",
              ]}
              selected={exercise}
              onToggle={toggle(setExercise, true)}
              colors={colors}
              single
            />
            <ChipSelect
              label="Diet / Nutrition"
              hint="Select all that apply"
              options={DIET_OPTIONS}
              selected={diet}
              onToggle={toggle(setDiet)}
              colors={colors}
            />
            <SearchPicker
              label="Family Medical History"
              hint="Conditions in your immediate family (parents, siblings)."
              items={FAMILY_CONDITIONS}
              selected={familyHistory}
              onToggle={toggle(setFamilyHistory)}
              placeholder="Search conditions..."
              colors={colors}
            />
            <ChipSelect
              label="Mental Health History"
              hint="Select all that apply"
              options={MENTAL_HEALTH_OPTIONS}
              selected={mentalHealthHistory}
              onToggle={toggle(setMentalHealthHistory)}
              colors={colors}
            />
            <ChipSelect
              label="Pregnancy Status (if applicable)"
              options={[
                "N/A",
                "Not pregnant",
                "Currently pregnant",
                "Postpartum (within 1 year)",
                "Trying to conceive",
                "Breastfeeding",
              ]}
              selected={pregnancyStatus}
              onToggle={toggle(setPregnancyStatus, true)}
              colors={colors}
              single
            />
          </View>
        )}

        {/* ── Step 4: Emergency contact ────────────────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={[s.sectionHeader, { color: colors.primary }]}>
              Primary Contact
            </Text>
            {[
              {
                label: "Full Name",
                value: emergencyName,
                onChange: (v: string) => setEmergencyName(sanitizeName(v)),
                placeholder: "Full name",
                maxLen: 100,
              },
              {
                label: "Phone Number",
                value: emergencyPhone,
                onChange: setEmergencyPhone,
                placeholder: "Phone number",
                keyboard: "phone-pad" as any,
                maxLen: 20,
              },
              {
                label: "Relationship",
                value: emergencyRelation,
                onChange: setEmergencyRelation,
                placeholder: "e.g. Spouse, Parent, Sibling",
                maxLen: 50,
              },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 16 }}>
                <Text style={[s.fieldLabel, { color: colors.text }]}>
                  {f.label}
                </Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.card,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.subtext}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard || "default"}
                  maxLength={f.maxLen}
                />
              </View>
            ))}
            <Text
              style={[s.sectionHeader, { color: colors.primary, marginTop: 8 }]}
            >
              Secondary Contact (optional)
            </Text>
            {[
              {
                label: "Full Name",
                value: emergencyName2,
                onChange: (v: string) => setEmergencyName2(sanitizeName(v)),
                placeholder: "Full name",
                maxLen: 100,
              },
              {
                label: "Phone Number",
                value: emergencyPhone2,
                onChange: setEmergencyPhone2,
                placeholder: "Phone number",
                keyboard: "phone-pad" as any,
                maxLen: 20,
              },
              {
                label: "Relationship",
                value: emergencyRelation2,
                onChange: setEmergencyRelation2,
                placeholder: "e.g. Friend, Sibling",
                maxLen: 50,
              },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 16 }}>
                <Text style={[s.fieldLabel, { color: colors.text }]}>
                  {f.label}
                </Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.card,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.subtext}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard || "default"}
                  maxLength={f.maxLen}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          s.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        {step > 0 && (
          <TouchableOpacity
            style={[s.backBtn, { borderColor: colors.border }]}
            onPress={() => setStep((st) => st - 1)}
          >
            <Text style={[s.backBtnText, { color: colors.text }]}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            s.nextBtn,
            { backgroundColor: colors.primary, flex: step > 0 ? 1 : undefined },
          ]}
          onPress={handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.nextBtnText}>
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

const s = StyleSheet.create({
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
  fieldLabel: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  fieldHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  selectedNote: { fontSize: 12, marginTop: 6, fontWeight: "600" },
  searchBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSearch: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
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
});
