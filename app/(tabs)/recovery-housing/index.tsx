// ================================================================
// RECOVERY HOUSING SEARCH SCREEN
// app/recovery-housing/index.tsx
//
// Lists sober living and transitional housing facilities in Oklahoma.
// Separate from the provider search — dedicated discovery experience
// for patients in recovery seeking housing.
//
// Data source: Firestore /recoveryHousing collection
// ================================================================

import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type GenderFilter = "all" | "men" | "women" | "co-ed" | "lgbtq_affirming";
type FundingFilter = "all" | "medicaid" | "voucher" | "sliding_scale" | "private";

export default function RecoveryHousingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [facilities, setFacilities] = useState<RecoveryHousingFacility[]>([]);
  const [filtered, setFiltered] = useState<RecoveryHousingFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [matFilter, setMatFilter] = useState(false); // MAT = Medication Assisted Treatment
  const [dhsFilter, setDhsFilter] = useState(false);
  const [childrenFilter, setChildrenFilter] = useState(false);

  // ── Load facilities from Firestore ─────────────────────────────────────────
  const loadFacilities = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(
        query(collection(db, "recoveryHousing"), where("active", "==", true))
      );

      const list: RecoveryHousingFacility[] = [];
      snapshot.forEach((doc) => {
        list.push(mapFirestoreToFacility(doc.id, doc.data()));
      });

      // Sort by available beds (most available first), then alphabetically
      list.sort((a, b) => {
        if (a.availableBeds > 0 && b.availableBeds <= 0) return -1;
        if (b.availableBeds > 0 && a.availableBeds <= 0) return 1;
        return a.facilityName.localeCompare(b.facilityName);
      });

      setFacilities(list);
      setFiltered(list);
    } catch (err) {
      console.error("❌ Error loading recovery housing:", err);
      Alert.alert("Error", "Could not load facilities. Please try again.", [
        { text: "Retry", onPress: loadFacilities },
        { text: "Cancel", style: "cancel" },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // ── Client-side filtering ────────────────────────────────────────────────
  useEffect(() => {
    let result = [...facilities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.facilityName.toLowerCase().includes(q) ||
          f.city?.toLowerCase().includes(q) ||
          f.zip?.includes(q)
      );
    }

    if (genderFilter !== "all") {
      result = result.filter((f) => f.genderServed === genderFilter);
    }

    if (fundingFilter === "medicaid") {
      result = result.filter((f) => f.acceptsMedicaid);
    } else if (fundingFilter === "voucher") {
      result = result.filter((f) => f.acceptsVouchers || f.acceptsODMHSAS);
    } else if (fundingFilter === "sliding_scale") {
      result = result.filter((f) => f.slidingScale);
    } else if (fundingFilter === "private") {
      result = result.filter((f) => f.acceptsPrivateInsurance);
    }

    if (availableOnly) {
      result = result.filter((f) => f.availableBeds > 0);
    }

    if (matFilter) {
      result = result.filter((f) => f.medicationAssistedTreatment === true);
    }

    if (dhsFilter) {
      result = result.filter((f) => f.acceptsDHS === true);
    }

    if (childrenFilter) {
      result = result.filter((f) => f.childrenAllowed === true);
    }

    setFiltered(result);
  }, [facilities, searchQuery, genderFilter, fundingFilter, availableOnly, matFilter, dhsFilter, childrenFilter]);

  // ── Filter chip component ─────────────────────────────────────────────────
  function Chip({
    label,
    active,
    onPress,
    color = "#00838F",
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    color?: string;
  }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          s.chip,
          {
            backgroundColor: active ? color : colors.card,
            borderColor: active ? color : colors.border,
          },
        ]}
      >
        <Text style={[s.chipText, { color: active ? "#fff" : colors.text }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── Facility card ─────────────────────────────────────────────────────────
  function FacilityCard({ facility }: { facility: RecoveryHousingFacility }) {
    const availColor = getAvailabilityColor(facility);
    const availLabel = getAvailabilityLabel(facility);
    const fundingLabels = getFundingLabel(facility);

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/recovery-housing/${facility.id}`)}
        activeOpacity={0.85}
      >
        {/* Header row */}
        <View style={s.cardHeader}>
          <Text style={[s.facilityName, { color: colors.text }]} numberOfLines={2}>
            {facility.facilityName}
          </Text>
          {facility.okarrCertified && (
            <View style={s.certBadge}>
              <Text style={s.certText}>OKARR</Text>
            </View>
          )}
        </View>

        {/* City + gender */}
        <Text style={[s.cityText, { color: colors.subtext }]}>
          {facility.city}, OK · {getGenderLabel(facility.genderServed)}
        </Text>

        {/* Availability indicator */}
        <View style={[s.availRow, { borderColor: availColor + "40", backgroundColor: availColor + "12" }]}>
          <View style={[s.availDot, { backgroundColor: availColor }]} />
          <Text style={[s.availText, { color: availColor }]}>{availLabel}</Text>
          {facility.totalBeds > 0 && (
            <Text style={[s.totalBeds, { color: colors.subtext }]}>
              {facility.totalBeds} total beds
            </Text>
          )}
        </View>

        {/* Funding tags */}
        {fundingLabels.length > 0 && (
          <View style={s.tagsRow}>
            {fundingLabels.slice(0, 3).map((label: string, i: number) => (
              <View key={i} style={[s.tag, { backgroundColor: "#059669" + "20" }]}>
                <Text style={[s.tagText, { color: "#059669" }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* MAT badge */}
        {facility.medicationAssistedTreatment && (
          <View style={[s.tag, { backgroundColor: "#7C3AED" + "20", alignSelf: "flex-start", marginTop: 6 }]}>
            <Text style={[s.tagText, { color: "#7C3AED" }]}>MAT Friendly</Text>
          </View>
        )}

        {/* Monthly rate if set */}
        {facility.monthlyRate && (
          <Text style={[s.rateText, { color: colors.subtext }]}>
            ${facility.monthlyRate}/month{facility.slidingScale ? " · sliding scale available" : ""}
          </Text>
        )}

        {/* Children welcome badge */}
        {facility.childrenAllowed && (
          <View style={[s.tag, { backgroundColor: "#DB277720", alignSelf: "flex-start", marginTop: 6 }]}>
            <Text style={[s.tagText, { color: "#DB2777" }]}>Children Welcome</Text>
          </View>
        )}

        {/* Intake interview notice */}
        {facility.requiresInterview && (
          <View style={[s.interviewNotice, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED40" }]}>
            <Ionicons name="information-circle-outline" size={14} color="#7C3AED" />
            <Text style={[s.interviewNoticeText, { color: "#7C3AED" }]}>
              Intake interview required
            </Text>
          </View>
        )}

        <View style={s.cardFooter}>
          <Text style={[s.viewDetails, { color: colors.primary }]}>
            View details →
          </Text>
          <View style={s.footerActions}>
            {facility.requiresInterview && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push(`/recovery-housing/${facility.id}?action=interview` as never);
                }}
                style={s.interviewButton}
              >
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={[s.callText, { color: "#fff" }]}>Request Interview</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                if (facility.phone) Linking.openURL(`tel:${facility.phone}`);
              }}
              style={[s.callButton, { borderColor: facility.requiresInterview ? colors.border : colors.primary }]}
            >
              <Ionicons
                name="call-outline"
                size={14}
                color={facility.requiresInterview ? colors.subtext : colors.primary}
              />
              <Text style={[s.callText, {
                color: facility.requiresInterview ? colors.subtext : colors.primary
              }]}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  function EmptyState() {
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyIcon}>🌱</Text>
        <Text style={[s.emptyTitle, { color: colors.text }]}>
          {facilities.length === 0
            ? "Recovery housing coming soon"
            : "No facilities match your filters"}
        </Text>
        <Text style={[s.emptyBody, { color: colors.subtext }]}>
          {facilities.length === 0
            ? "We are actively partnering with Oklahoma sober living facilities. Check back soon or contact us at support@moravacare.com."
            : "Try adjusting your filters or search terms."}
        </Text>
        {facilities.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setGenderFilter("all");
              setFundingFilter("all");
              setAvailableOnly(false);
              setMatFilter(false);
              setDhsFilter(false);
              setChildrenFilter(false);
              setSearchQuery("");
            }}
            style={[s.clearButton, { borderColor: colors.primary }]}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
              Clear all filters
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Interview Request Modal ───────────────────────────────────────────────────
  function InterviewModal() {
    if (!interviewFacility) return null;
    return (
      <Modal
        visible={true}
        transparent
        animationType="slide"
        onRequestClose={() => setInterviewFacility(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setInterviewFacility(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[s.modalCard, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={s.modalHeader}>
              <View style={[s.modalIconBadge, { backgroundColor: "#7C3AED20" }]}>
                <Ionicons name="calendar-outline" size={22} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  Request Intake Interview
                </Text>
                <Text style={[s.modalFacilityName, { color: colors.subtext }]}>
                  {interviewFacility.facilityName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInterviewFacility(null)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <View style={[s.modalNotice, { backgroundColor: "#7C3AED10", borderColor: "#7C3AED30" }]}>
              <Ionicons name="information-circle-outline" size={16} color="#7C3AED" />
              <Text style={[s.modalNoticeText, { color: colors.text }]}>
                {interviewFacility.intakeNotes ||
                  `${interviewFacility.facilityName} conducts intake interviews to ensure program fit before accepting residents.`}
              </Text>
            </View>

            <Text style={[s.modalSectionLabel, { color: colors.subtext }]}>WHAT TO EXPECT</Text>
            {[
              "A brief phone or in-person conversation",
              "Questions about your recovery goals",
              "Review of house rules and expectations",
              "Decision typically within 24–48 hours",
            ].map((item, i) => (
              <View key={i} style={s.modalBulletRow}>
                <View style={[s.modalBulletDot, { backgroundColor: "#7C3AED" }]} />
                <Text style={[s.modalBulletText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCallBtn}
                onPress={() => {
                  setInterviewFacility(null);
                  if (interviewFacility.phone) Linking.openURL(`tel:${interviewFacility.phone}`);
                }}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={s.modalCallBtnText}>
                  Call to Schedule{interviewFacility.ownerName ? ` · ${interviewFacility.ownerName}` : ""}
                </Text>
              </TouchableOpacity>

              {interviewFacility.email && (
                <TouchableOpacity
                  style={[s.modalEmailBtn, { borderColor: "#7C3AED" }]}
                  onPress={() => {
                    setInterviewFacility(null);
                    Linking.openURL(
                      `mailto:${interviewFacility.email}?subject=Intake Interview Request — ${interviewFacility.facilityName}&body=Hi, I am interested in scheduling an intake interview at ${interviewFacility.facilityName}. Please let me know your availability. Thank you.`
                    );
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color="#7C3AED" />
                  <Text style={[s.modalEmailBtnText, { color: "#7C3AED" }]}>Send Email Instead</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[s.modalDisclaimer, { color: colors.subtext }]}>
              Morava connects you with facilities. Admission decisions are made by the facility directly.
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitle}>
          <Text style={[s.headerText, { color: colors.text }]}>Recovery Housing</Text>
          <Text style={[s.headerSub, { color: colors.subtext }]}>
            {filtered.length} {filtered.length === 1 ? "facility" : "facilities"} in Oklahoma
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={[s.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.subtext} style={{ marginRight: 8 }} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Search by name, city, or ZIP..."
          placeholderTextColor={colors.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.filtersScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={s.filtersContent}
      >
        <Chip label="Available Now" active={availableOnly} onPress={() => setAvailableOnly((v) => !v)} color="#22C55E" />
        <Chip label="Men" active={genderFilter === "men"} onPress={() => setGenderFilter(genderFilter === "men" ? "all" : "men")} />
        <Chip label="Women" active={genderFilter === "women"} onPress={() => setGenderFilter(genderFilter === "women" ? "all" : "women")} />
        <Chip label="Co-ed" active={genderFilter === "co-ed"} onPress={() => setGenderFilter(genderFilter === "co-ed" ? "all" : "co-ed")} />
        <Chip label="LGBTQ+ Affirming" active={genderFilter === "lgbtq_affirming"} onPress={() => setGenderFilter(genderFilter === "lgbtq_affirming" ? "all" : "lgbtq_affirming")} color="#7C3AED" />
        <Chip label="Medicaid" active={fundingFilter === "medicaid"} onPress={() => setFundingFilter(fundingFilter === "medicaid" ? "all" : "medicaid")} color="#059669" />
        <Chip label="Voucher" active={fundingFilter === "voucher"} onPress={() => setFundingFilter(fundingFilter === "voucher" ? "all" : "voucher")} color="#059669" />
        <Chip label="Sliding Scale" active={fundingFilter === "sliding_scale"} onPress={() => setFundingFilter(fundingFilter === "sliding_scale" ? "all" : "sliding_scale")} color="#059669" />
        <Chip label="MAT Friendly" active={matFilter} onPress={() => setMatFilter((v) => !v)} color="#7C3AED" />
        <Chip label="DHS Families" active={dhsFilter} onPress={() => setDhsFilter((v) => !v)} color="#1D4ED8" />
        <Chip label="Children Welcome" active={childrenFilter} onPress={() => setChildrenFilter((v) => !v)} color="#DB2777" />
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingText, { color: colors.subtext }]}>
            Loading facilities...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FacilityCard facility={item} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <InterviewModal />

      {/* Crisis resources footer */}
      <View style={[s.crisisFooter, { backgroundColor: "#FEF2F2", borderTopColor: "#FCA5A5" }]}>
        <Text style={s.crisisText}>
          🆘 In crisis?{" "}
          <Text
            style={s.crisisLink}
            onPress={() => Linking.openURL("tel:18007994889")}
          >
            SAMHSA Helpline: 1-800-799-4889
          </Text>
          {" "}· Free, confidential, 24/7
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1 },
  headerText: { fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 13, marginTop: 2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  filtersScroll: { borderBottomWidth: 1, maxHeight: 52 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  facilityName: { fontSize: 16, fontWeight: "700", flex: 1, marginRight: 8 },
  certBadge: { backgroundColor: "#00838F", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  certText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cityText: { fontSize: 13, marginBottom: 10 },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6,
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 13, fontWeight: "600", flex: 1 },
  totalBeds: { fontSize: 12 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "600" },
  rateText: { fontSize: 13, marginTop: 6 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  viewDetails: { fontSize: 14, fontWeight: "600" },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callText: { fontSize: 13, fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  clearButton: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  interviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interviewNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  interviewNoticeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  modalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalFacilityName: { fontSize: 13, marginTop: 2 },
  modalClose: { padding: 4 },
  modalNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  modalNoticeText: { fontSize: 13, lineHeight: 19, flex: 1 },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  modalBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  modalBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  modalBulletText: { fontSize: 13, lineHeight: 20, flex: 1 },
  modalActions: { gap: 10, marginTop: 20, marginBottom: 12 },
  modalCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 14,
  },
  modalCallBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
  },
  modalEmailBtnText: { fontSize: 14, fontWeight: "600" },
  modalDisclaimer: { fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 4 },
  crisisFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  crisisText: { fontSize: 12, color: "#991B1B", textAlign: "center", lineHeight: 18 },
  crisisLink: { fontWeight: "700", textDecorationLine: "underline" },
});
