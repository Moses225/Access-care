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
  // (interview modal removed — intake flows through detail screen for Standard+ facilities)

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
            {(facility.listingPlan === "standard" || facility.listingPlan === "growth") && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  // Route to detail screen — intake modal lives there
                  router.push(`/recovery-housing/${facility.id}?intake=1`);
                }}
                style={s.interviewButton}
              >
                <Ionicons name="document-text-outline" size={14} color="#fff" />
                <Text style={[s.callText, { color: "#fff" }]}>Request Admission</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                if (facility.phone) Linking.openURL(`tel:${facility.phone}`);
              }}
              style={[s.callButton, {
                borderColor: (facility.listingPlan === "standard" || facility.listingPlan === "growth")
                  ? colors.border
                  : colors.primary,
              }]}
            >
              <Ionicons
                name="call-outline"
                size={14}
                color={(facility.listingPlan === "standard" || facility.listingPlan === "growth")
                  ? colors.subtext
                  : colors.primary}
              />
              <Text style={[s.callText, {
                color: (facility.listingPlan === "standard" || facility.listingPlan === "growth")
                  ? colors.subtext
                  : colors.primary,
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

  // InterviewModal removed — all intake requests are handled by the detail screen's
  // full intake form (Standard+ facilities only). Tapping "Request Admission" on a
  // list card routes directly to /recovery-housing/[id]?intake=1.

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
  crisisFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  crisisText: { fontSize: 12, color: "#991B1B", textAlign: "center", lineHeight: 18 },
  crisisLink: { fontWeight: "700", textDecorationLine: "underline" },
});
