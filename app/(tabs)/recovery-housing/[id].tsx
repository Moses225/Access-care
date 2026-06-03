// ================================================================
// RECOVERY HOUSING FACILITY DETAIL SCREEN
// app/recovery-housing/[id].tsx
//
// Shows full facility profile including photos, house rules,
// certifications, availability, funding, and contact info.
// ================================================================

import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase";
import {
  RecoveryHousingFacility,
  mapFirestoreToFacility,
  getAvailabilityLabel,
  getAvailabilityColor,
  getGenderLabel,
  getFundingLabel,
} from "../../../data/recoveryHousing";

export default function RecoveryHousingDetailScreen() {
  const { id, intake } = useLocalSearchParams<{ id: string; intake?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [facility, setFacility]         = useState<RecoveryHousingFacility | null>(null);
  const [listingPlan, setListingPlan]   = useState<"free" | "standard" | "growth">("free");
  const [loading, setLoading]           = useState(true);
  const [photoIndex, setPhotoIndex]     = useState(0);

  // Intake form state
  const [showIntake, setShowIntake]           = useState(false);
  const [intakeName, setIntakeName]           = useState("");
  const [intakePhone, setIntakePhone]         = useState("");
  const [intakeSobriety, setIntakeSobriety]   = useState("");
  const [intakeGender, setIntakeGender]       = useState("");
  const [intakeFunding, setIntakeFunding]     = useState("");
  const [intakeMAT, setIntakeMAT]             = useState<boolean | null>(null);
  const [intakeMessage, setIntakeMessage]     = useState("");
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);
  const viewCounted = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "recoveryHousing", id));
        if (snap.exists()) {
          const plan = (snap.data().listingPlan as "free" | "standard" | "growth") || "free";
          setFacility(mapFirestoreToFacility(snap.id, snap.data()));
          setListingPlan(plan);

          // ── Auto-open intake modal when arriving from list card "Request Admission" ──
          if (intake === "1" && (plan === "standard" || plan === "growth")) {
            // Small delay so the screen finishes rendering before modal appears
            setTimeout(() => setShowIntake(true), 350);
          }

          // ── View count tracking ────────────────────────────────────────────
          // Increment once per screen visit. viewCounted ref prevents double-fire
          // in React Strict Mode. Anonymous guests count too — they're real eyes.
          if (!viewCounted.current) {
            viewCounted.current = true;
            updateDoc(doc(db, "recoveryHousing", id), {
              viewCount: increment(1),
            }).catch(() => {/* non-critical — don't surface to user */});
          }
        }
      } catch (err) {
        console.error("❌ Error loading facility:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, intake]);

  // ── Intake form submission ───────────────────────────────────────────────────
  const handleIntakeSubmit = async () => {
    if (!intakeName.trim()) {
      Alert.alert("Name required", "Please enter your name so the facility can reach you.");
      return;
    }
    if (!intakePhone.trim()) {
      Alert.alert("Phone required", "Please enter a phone number so the facility can contact you.");
      return;
    }
    if (!id) return;

    setIntakeSubmitting(true);
    try {
      // ── Rate limit: 1 active (pending or contacted) request per user per facility ──
      // Anonymous users skip this check — only signed-in accounts are tracked.
      // Wrapped in its own try-catch: a permission error here must never block the
      // actual submission (e.g. if the user's token is stale or rule hasn't propagated).
      if (user?.uid) {
        try {
          const existing = await getDocs(
            query(
              collection(db, "recoveryHousing", id, "intakeRequests"),
              where("userId", "==", user.uid),
              where("status", "in", ["pending", "contacted"]),
              limit(1),
            )
          );
          if (!existing.empty) {
            setIntakeSubmitting(false);
            Alert.alert(
              "Request already submitted",
              "You already have an active admission request at this facility. " +
              "They will reach out to you soon. You can submit again once it's been resolved.",
              [{ text: "OK" }]
            );
            return;
          }
        } catch {
          // Rate-limit check failed (permissions or network) — allow submission to proceed.
          // The Firestore create rule is the real gatekeeper.
          console.warn("Rate-limit check skipped — proceeding with submission.");
        }
      }

      // Build the doc without null fields — Firestore rules reject null on
      // optional string checks (validOptionalString returns false for null).
      const requestData: Record<string, unknown> = {
        patientName:  intakeName.trim(),
        phone:        intakePhone.trim(),
        status:       "pending",
        facilityId:   id,
        facilityName: facility?.facilityName ?? "",
        facilityCity: facility?.city ?? "",
        createdAt:    serverTimestamp(),
      };
      if (user?.uid)              requestData.userId      = user.uid;
      if (intakeGender.trim())    requestData.gender       = intakeGender.trim();
      if (intakeSobriety.trim())  requestData.sobrietyDays = parseInt(intakeSobriety, 10) || 0;
      if (intakeFunding.trim())   requestData.fundingType  = intakeFunding.trim();
      if (intakeMAT !== null)     requestData.onMAT        = intakeMAT;
      if (intakeMessage.trim())   requestData.message      = intakeMessage.trim();

      await addDoc(collection(db, "recoveryHousing", id, "intakeRequests"), requestData);

      // Increment inquiry counter on the facility doc for analytics
      updateDoc(doc(db, "recoveryHousing", id), {
        inquiryCount: increment(1),
      }).catch(() => {});

      setIntakeSubmitted(true);
    } catch (err) {
      console.error("❌ Intake submission failed:", err);
      Alert.alert("Submission failed", "Please try again or contact the facility directly.");
    } finally {
      setIntakeSubmitting(false);
    }
  };

  const resetIntakeForm = () => {
    setIntakeName(""); setIntakePhone(""); setIntakeSobriety("");
    setIntakeGender(""); setIntakeFunding(""); setIntakeMAT(null);
    setIntakeMessage("");
    setIntakeSubmitted(false); setShowIntake(false);
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!facility) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={[s.errorText, { color: colors.text }]}>Facility not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 12 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availColor = getAvailabilityColor(facility);
  const availLabel = getAvailabilityLabel(facility);
  const fundingLabels = getFundingLabel(facility);

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={[s.section, { backgroundColor: colors.card }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
        {children}
      </View>
    );
  }

  function Row({ label, value, icon }: { label: string; value: string; icon?: string }) {
    if (!value) return null;
    return (
      <View style={s.row}>
        {icon && <Text style={s.rowIcon}>{icon}</Text>}
        <View style={s.rowContent}>
          <Text style={[s.rowLabel, { color: colors.subtext }]}>{label}</Text>
          <Text style={[s.rowValue, { color: colors.text }]}>{value}</Text>
        </View>
      </View>
    );
  }

  function BoolRow({ label, value, icon }: { label: string; value?: boolean; icon?: string }) {
    if (value === undefined || value === null) return null;
    return (
      <View style={s.row}>
        {icon && <Text style={s.rowIcon}>{icon}</Text>}
        <View style={s.rowContent}>
          <Text style={[s.rowLabel, { color: colors.subtext }]}>{label}</Text>
          <Text style={[s.rowValue, { color: value ? "#22C55E" : "#EF4444" }]}>
            {value ? "Yes" : "No"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <View style={[s.backBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/recovery-housing' as never)} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[s.backText, { color: colors.text }]}>Recovery Housing</Text>
        </TouchableOpacity>
      </View>

      {/* Photo carousel */}
      {facility.photos && facility.photos.length > 0 ? (
        <View style={s.photoContainer}>
          <Image
            source={{ uri: facility.photos[photoIndex] }}
            style={s.photo}
            resizeMode="cover"
          />
          {facility.photos.length > 1 && (
            <View style={s.photoDots}>
              {facility.photos.map((_: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)}>
                  <View style={[
                    s.dot,
                    { backgroundColor: i === photoIndex ? "#fff" : "rgba(255,255,255,0.4)" }
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[s.photoPlaceholder, { backgroundColor: "#E0F2FE" }]}>
          <Text style={s.photoPlaceholderText}>🌱</Text>
          <Text style={{ color: "#0369A1", fontSize: 13, marginTop: 4 }}>Photos coming soon</Text>
        </View>
      )}

      {/* Facility name + certifications */}
      <View style={[s.nameSection, { backgroundColor: colors.card }]}>
        <View style={s.nameRow}>
          <Text style={[s.facilityName, { color: colors.text }]}>
            {facility.facilityName}
          </Text>
          <View style={s.badgesRow}>
            {facility.verified && (
              <View style={[s.badge, { backgroundColor: "#00838F" }]}>
                <Text style={s.badgeText}>✓ Verified</Text>
              </View>
            )}
            {facility.okarrCertified && (
              <View style={[s.badge, { backgroundColor: "#059669" }]}>
                <Text style={s.badgeText}>OKARR</Text>
              </View>
            )}
            {facility.oxfordHouseAffiliated && (
              <View style={[s.badge, { backgroundColor: "#7C3AED" }]}>
                <Text style={s.badgeText}>Oxford House</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[s.cityText, { color: colors.subtext }]}>
          {facility.address}, {facility.city}, OK {facility.zip}
        </Text>

        {/* Availability prominently displayed */}
        <View style={[s.availBox, { borderColor: availColor + "40", backgroundColor: availColor + "15" }]}>
          <View style={[s.availDot, { backgroundColor: availColor }]} />
          <Text style={[s.availText, { color: availColor }]}>{availLabel}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={s.actionsRow}>
        {/* Request Admission — Standard+ facilities only */}
        {(listingPlan === "standard" || listingPlan === "growth") && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: "#00838F", flex: 1.6, paddingHorizontal: 10 }]}
            onPress={() => setShowIntake(true)}
          >
            <Ionicons name="document-text-outline" size={15} color="#fff" />
            <Text
              style={s.actionBtnText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              Request Admission
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.actionBtn, {
            backgroundColor: (listingPlan === "standard" || listingPlan === "growth") ? colors.card : "#00838F",
            borderWidth: (listingPlan === "standard" || listingPlan === "growth") ? 1.5 : 0,
            borderColor: "#00838F",
          }]}
          onPress={() => facility.phone && Linking.openURL(`tel:${facility.phone}`)}
        >
          <Ionicons name="call" size={18} color={(listingPlan === "standard" || listingPlan === "growth") ? "#00838F" : "#fff"} />
          <Text style={[s.actionBtnText, { color: (listingPlan === "standard" || listingPlan === "growth") ? "#00838F" : "#fff" }]}>Call</Text>
        </TouchableOpacity>
        {facility.email && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: "#00838F" }]}
            onPress={() => Linking.openURL(`mailto:${facility.email}`)}
          >
            <Ionicons name="mail-outline" size={18} color="#00838F" />
            <Text style={[s.actionBtnText, { color: "#00838F" }]}>Email</Text>
          </TouchableOpacity>
        )}
        {facility.website && !(listingPlan === "standard" || listingPlan === "growth") && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border }]}
            onPress={() => Linking.openURL(facility.website!)}
          >
            <Ionicons name="globe-outline" size={18} color={colors.text} />
            <Text style={[s.actionBtnText, { color: colors.text }]}>Website</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admissions info */}
      <Section title="Admissions">
        <Row label="Gender served" value={getGenderLabel(facility.genderServed)} icon="👥" />
        {facility.sobrietyRequirementDays !== undefined && (
          <Row
            label="Sobriety requirement"
            value={facility.sobrietyRequirementDays === 0
              ? "No requirement — all stages welcome"
              : `${facility.sobrietyRequirementDays} days clean/sober`}
            icon="📅"
          />
        )}
        {facility.minimumAge && <Row label="Minimum age" value={`${facility.minimumAge} years old`} icon="🎂" />}
        {facility.maximumAge && <Row label="Maximum age" value={`${facility.maximumAge} years old`} icon="🎂" />}
        <BoolRow label="MAT (Suboxone/Methadone) allowed" value={facility.medicationAssistedTreatment} icon="💊" />
        <BoolRow label="Accepts applicants with mental health history" value={facility.acceptsWithActiveMentalHealth} icon="🧠" />
        <BoolRow label="Accepts applicants with criminal history" value={facility.acceptsWithCriminalHistory} icon="📋" />
      </Section>

      {/* Funding / financial */}
      <Section title="Payment & Funding">
        {facility.monthlyRate && (
          <Row
            label="Monthly rate"
            value={`$${facility.monthlyRate}/month${facility.slidingScale ? " (sliding scale available)" : ""}`}
            icon="💰"
          />
        )}
        <BoolRow label="Medicaid accepted" value={facility.acceptsMedicaid} icon="🏥" />
        <BoolRow label="ODMHSAS voucher accepted" value={facility.acceptsODMHSAS} icon="📄" />
        <BoolRow label="Other vouchers accepted" value={facility.acceptsVouchers} icon="📄" />
        <BoolRow label="Private insurance accepted" value={facility.acceptsPrivateInsurance} icon="🔒" />
        <BoolRow label="Sliding scale fees" value={facility.slidingScale} icon="📊" />
      </Section>

      {/* What's included */}
      <Section title="What's Included">
        <BoolRow label="Meals provided" value={facility.mealsProvided} icon="🍽️" />
        <BoolRow label="Transportation provided" value={facility.transportationProvided} icon="🚗" />
        <BoolRow label="Employment support" value={facility.employmentSupport} icon="💼" />
        <BoolRow label="Peer support program" value={facility.peersupport} icon="🤝" />
        <BoolRow label="On-site counseling" value={facility.onSiteCounseling} icon="🗣️" />
        <BoolRow label="Pets allowed" value={facility.petsAllowed} icon="🐾" />
        <BoolRow label="Smoking allowed" value={facility.smokingAllowed} icon="🚭" />
        {facility.curfew && <Row label="Curfew" value={facility.curfew} icon="🕐" />}
        {facility.maxStayMonths && (
          <Row
            label="Maximum stay"
            value={`${facility.maxStayMonths} months`}
            icon="📆"
          />
        )}
      </Section>

      {/* House rules */}
      {facility.houseRules && (
        <Section title="House Rules">
          <Text style={[s.rulesText, { color: colors.text }]}>{facility.houseRules}</Text>
        </Section>
      )}

      {/* Certifications */}
      <Section title="Certifications & Affiliations">
        <BoolRow label="OKARR Certified" value={facility.okarrCertified} icon="🏅" />
        <BoolRow label="Oxford House Affiliated" value={facility.oxfordHouseAffiliated} icon="🏠" />
        <BoolRow label="ODMHSAS Licensed" value={facility.odmhsasLicensed} icon="📜" />
        {facility.operatorName && <Row label="Operated by" value={facility.operatorName} icon="👤" />}
      </Section>

      {/* Crisis resources */}
      <View style={[s.crisisBox, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
        <Text style={s.crisisTitle}>🆘 Need immediate help?</Text>
        <TouchableOpacity onPress={() => Linking.openURL("tel:18007994889")}>
          <Text style={s.crisisLink}>SAMHSA Helpline: 1-800-799-4889</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL("tel:988")}>
          <Text style={s.crisisLink}>988 Suicide & Crisis Lifeline: Call or text 988</Text>
        </TouchableOpacity>
        <Text style={[s.crisisSub, { color: "#991B1B" }]}>Free · Confidential · 24/7</Text>
      </View>

      <View style={{ height: 40 }} />

      {/* ── Intake Request Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showIntake}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetIntakeForm}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View style={[s.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={resetIntakeForm} style={s.modalClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.text }]}>Request Admission</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {intakeSubmitted ? (
              /* ── Success state ── */
              <View style={s.successBox}>
                {/* Checkmark circle */}
                <View style={s.successIconCircle}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>

                <Text style={[s.successTitle, { color: colors.text }]}>
                  Request submitted!
                </Text>
                <Text style={[s.successSub, { color: colors.subtext }]}>
                  Your admission request has been sent to{" "}
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {facility.facilityName}
                  </Text>
                  . A staff member will call you back at the number you provided.
                </Text>

                {/* What happens next */}
                <View style={[s.successSteps, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.successStepsTitle, { color: colors.subtext }]}>WHAT HAPPENS NEXT</Text>
                  {[
                    { icon: "time-outline",        text: "Facility reviews your request (usually within 24 hrs)" },
                    { icon: "call-outline",         text: "A staff member calls you to discuss fit & availability" },
                    { icon: "home-outline",         text: "If it's a match, they schedule your move-in visit" },
                  ].map((step, i) => (
                    <View key={i} style={s.successStepRow}>
                      <View style={s.successStepDot}>
                        <Ionicons name={step.icon as any} size={14} color="#00838F" />
                      </View>
                      <Text style={[s.successStepText, { color: colors.text }]}>{step.text}</Text>
                    </View>
                  ))}
                </View>

                {/* Primary CTA — call now */}
                {facility.phone && (
                  <TouchableOpacity
                    style={s.successCallBtn}
                    onPress={() => { resetIntakeForm(); Linking.openURL(`tel:${facility.phone}`); }}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={s.successCallText}>Call now — don't wait</Text>
                  </TouchableOpacity>
                )}

                {/* Crisis line nudge */}
                <View style={[s.successCrisisRow, { borderColor: "#FCA5A5" }]}>
                  <Ionicons name="heart-outline" size={13} color="#EF4444" />
                  <Text style={s.successCrisisText}>
                    Need immediate help?{" "}
                    <Text
                      style={s.successCrisisLink}
                      onPress={() => Linking.openURL("tel:18007994889")}
                    >
                      SAMHSA Helpline: 1-800-799-4889
                    </Text>
                    {" "}· Free & confidential, 24/7
                  </Text>
                </View>

                <TouchableOpacity onPress={resetIntakeForm} style={s.successDoneBtn}>
                  <Text style={s.successDoneText}>Back to facility</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Form ── */
              <>
                {/* Facility context */}
                <View style={[s.formFacilityBadge, { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD" }]}>
                  <Text style={{ fontSize: 13, color: "#0369A1", fontWeight: "600" }}>
                    📍 {facility.facilityName} · {facility.city}
                  </Text>
                </View>

                <Text style={[s.formNote, { color: colors.subtext }]}>
                  This form goes directly to the facility. No diagnosis or medical info needed —
                  just the basics so they can reach you.
                </Text>

                {/* Name */}
                <View style={s.fieldGroup}>
                  <Text style={[s.fieldLabel, { color: colors.subtext }]}>Your name *</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    placeholder="First name is fine"
                    placeholderTextColor={colors.subtext}
                    value={intakeName}
                    onChangeText={setIntakeName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                {/* Phone */}
                <View style={s.fieldGroup}>
                  <Text style={[s.fieldLabel, { color: colors.subtext }]}>Phone number *</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    placeholder="(405) 555-0100"
                    placeholderTextColor={colors.subtext}
                    value={intakePhone}
                    onChangeText={setIntakePhone}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />
                </View>

                {/* Gender + Sobriety — side by side */}
                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[s.fieldLabel, { color: colors.subtext }]}>Gender (optional)</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. Male"
                      placeholderTextColor={colors.subtext}
                      value={intakeGender}
                      onChangeText={setIntakeGender}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={[s.fieldLabel, { color: colors.subtext }]}>Days sober (optional)</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. 30"
                      placeholderTextColor={colors.subtext}
                      value={intakeSobriety}
                      onChangeText={setIntakeSobriety}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Funding type */}
                <View style={s.fieldGroup}>
                  <Text style={[s.fieldLabel, { color: colors.subtext }]}>How are you planning to pay? (optional)</Text>
                  {[
                    "Self-Pay / Private Pay",
                    "Medicaid / SoonerCare",
                    "ODMHSAS Voucher",
                    "Private Insurance",
                    "Not sure yet",
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setIntakeFunding(intakeFunding === opt ? "" : opt)}
                      style={[
                        s.optionRow,
                        { borderColor: intakeFunding === opt ? "#00838F" : colors.border,
                          backgroundColor: intakeFunding === opt ? "#E0F2F4" : colors.card }
                      ]}
                    >
                      <View style={[s.optionDot, { borderColor: "#00838F", backgroundColor: intakeFunding === opt ? "#00838F" : "transparent" }]} />
                      <Text style={[s.optionText, { color: colors.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* MAT */}
                <View style={s.fieldGroup}>
                  <Text style={[s.fieldLabel, { color: colors.subtext }]}>Are you currently on MAT? (Suboxone / Methadone)</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {([["Yes", true], ["No", false], ["Prefer not to say", null]] as [string, boolean | null][]).map(([label, val]) => (
                      <TouchableOpacity
                        key={label}
                        onPress={() => setIntakeMAT(intakeMAT === val ? null : val)}
                        style={[
                          s.optionRow,
                          { flex: 1, justifyContent: "center",
                            borderColor: intakeMAT === val && val !== null ? "#00838F" : colors.border,
                            backgroundColor: intakeMAT === val && val !== null ? "#E0F2F4" : colors.card }
                        ]}
                      >
                        <Text style={[s.optionText, { color: colors.text, textAlign: "center" }]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Message */}
                <View style={s.fieldGroup}>
                  <Text style={[s.fieldLabel, { color: colors.subtext }]}>Anything else to share? (optional)</Text>
                  <TextInput
                    style={[s.input, s.textarea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    placeholder="Special needs, questions for the facility, best time to call..."
                    placeholderTextColor={colors.subtext}
                    value={intakeMessage}
                    onChangeText={setIntakeMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* PHI notice */}
                <View style={[s.phiNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#00838F" />
                  <Text style={[s.phiText, { color: colors.subtext }]}>
                    Don't include medical diagnoses, medications, or insurance details here.
                    That conversation happens directly with the facility.
                  </Text>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: intakeSubmitting ? "#9CA3AF" : "#00838F" }]}
                  onPress={handleIntakeSubmit}
                  disabled={intakeSubmitting}
                >
                  {intakeSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={18} color="#fff" />
                      <Text style={s.submitBtnText}>Send request to facility</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16 },
  backBar: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 16, fontWeight: "500" },
  photoContainer: { position: "relative" },
  photo: { width: "100%", height: 220 },
  photoDots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  photoPlaceholder: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { fontSize: 48 },
  nameSection: { padding: 20 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  facilityName: { fontSize: 22, fontWeight: "700", flex: 1, marginRight: 8 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cityText: { fontSize: 13, marginBottom: 12 },
  availBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availText: { fontSize: 14, fontWeight: "700" },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
    gap: 10,
  },
  rowIcon: { fontSize: 16, marginTop: 1 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: "500" },
  rulesText: { fontSize: 14, lineHeight: 22 },
  crisisBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
  },
  crisisTitle: { fontSize: 14, fontWeight: "700", color: "#991B1B", marginBottom: 10 },
  crisisLink: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
    textDecorationLine: "underline",
    marginBottom: 6,
  },
  crisisSub: { fontSize: 12, marginTop: 4 },

  // ── Intake modal ────────────────────────────────────────────────────────────
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 16 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalClose: { width: 40, alignItems: "flex-start" },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { padding: 20, paddingBottom: 60 },
  formFacilityBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  formNote: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { height: 100, paddingTop: 12 },
  rowFields: { flexDirection: "row" },
  phiNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  phiText: { fontSize: 12, lineHeight: 18, flex: 1 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
  },
  optionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  optionText: { fontSize: 14, fontWeight: "500" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // ── Success state ───────────────────────────────────────────────────────────
  successBox: { alignItems: "center", paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20 },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#00838F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  successSub: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  successSteps: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  successStepsTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  successStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  successStepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E0F2F4",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  successStepText: { fontSize: 13, lineHeight: 20, flex: 1 },
  successCallBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00838F",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  successCallText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  successCrisisRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#FFF5F5",
  },
  successCrisisText: { fontSize: 11, lineHeight: 17, color: "#991B1B", flex: 1 },
  successCrisisLink: { fontWeight: "700", textDecorationLine: "underline" },
  successDoneBtn: { paddingVertical: 10, paddingHorizontal: 32 },
  successDoneText: { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
});
