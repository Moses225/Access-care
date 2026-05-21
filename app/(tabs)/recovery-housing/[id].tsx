// ================================================================
// RECOVERY HOUSING FACILITY DETAIL SCREEN
// app/recovery-housing/[id].tsx
//
// Shows full facility profile including photos, house rules,
// certifications, availability, funding, and contact info.
// ================================================================

import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [facility, setFacility] = useState<RecoveryHousingFacility | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "recoveryHousing", id));
        if (snap.exists()) {
          setFacility(mapFirestoreToFacility(snap.id, snap.data()));
        }
      } catch (err) {
        console.error("❌ Error loading facility:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
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
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: "#00838F" }]}
          onPress={() => facility.phone && Linking.openURL(`tel:${facility.phone}`)}
        >
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={s.actionBtnText}>Call</Text>
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
        {facility.website && (
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
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
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
});
