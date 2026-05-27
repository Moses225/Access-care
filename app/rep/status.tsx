import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

type Submission = {
  id: string;
  providerName: string;
  practiceName?: string;
  specialty?: string;
  city?: string;
  status: string;
  interestLevel?: string;
  createdAt: Date | null;
  repEmail: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_verification: { label: "Pending",   color: "#92400E", bg: "#FEF3C7" },
  in_review:            { label: "In Review", color: "#1E40AF", bg: "#DBEAFE" },
  approved:             { label: "Approved",  color: "#065F46", bg: "#D1FAE5" },
  live:                 { label: "Live",      color: "#065F46", bg: "#BBFFF0" },
  rejected:             { label: "Rejected",  color: "#991B1B", bg: "#FEE2E2" },
};

const FILTER_TABS = ["All", "Pending", "Approved", "Rejected"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function formatDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SubmissionsStatus() {
  const { user }   = useAuth();
  const [all, setAll]         = useState<Submission[]>([]);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("All");
  const [loading, setLoading] = useState(true);

  const repEmail = user?.email ?? "";

  useEffect(() => {
    if (!repEmail) return;

    const q = query(
      collection(db, "providerSubmissions"),
      where("repEmail", "==", repEmail),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setAll(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Submission, "id">),
            createdAt: d.data().createdAt?.toDate?.() ?? null,
          }))
        );
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsub;
  }, [repEmail]);

  const visible = all.filter((s) => {
    const matchSearch =
      !search ||
      s.providerName.toLowerCase().includes(search.toLowerCase()) ||
      (s.practiceName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (s.city?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchFilter =
      filter === "All" ||
      (filter === "Pending"  && (s.status === "pending_verification" || s.status === "in_review")) ||
      (filter === "Approved" && (s.status === "approved" || s.status === "live")) ||
      (filter === "Rejected" && s.status === "rejected");

    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search providers…"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Filter tabs ── */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Loading…</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="file-tray-outline" size={44} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {search ? "No matches found" : "No submissions yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.providerName}>{item.providerName}</Text>
                  {item.practiceName ? (
                    <Text style={styles.practiceName}>{item.practiceName}</Text>
                  ) : null}
                </View>
                <StatusBadge status={item.status} />
              </View>

              <View style={styles.cardMeta}>
                {item.specialty ? (
                  <MetaChip icon="medkit-outline" text={item.specialty} />
                ) : null}
                {item.city ? (
                  <MetaChip icon="location-outline" text={item.city} />
                ) : null}
                {item.interestLevel ? (
                  <MetaChip icon="star-outline" text={item.interestLevel} />
                ) : null}
              </View>

              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function MetaChip({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={12} color="#64748B" />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    color: "#1E293B",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
  },
  tabActive: {
    backgroundColor: "#14B8A6",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  practiceName: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  date: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: "#94A3B8",
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
    marginTop: 10,
  },
});
