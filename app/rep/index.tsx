import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

type Submission = {
  id: string;
  providerName: string;
  practiceName?: string;
  specialty?: string;
  city?: string;
  status: string;
  createdAt: Date | null;
  repEmail: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_verification: { label: "Pending", color: "#92400E", bg: "#FEF3C7" },
  in_review:           { label: "In Review", color: "#1E40AF", bg: "#DBEAFE" },
  approved:            { label: "Approved",  color: "#065F46", bg: "#D1FAE5" },
  live:                { label: "Live",       color: "#065F46", bg: "#BBFFF0" },
  rejected:            { label: "Rejected",  color: "#991B1B", bg: "#FEE2E2" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function RepDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const repEmail = user?.email ?? "";
  const repName  = repEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

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
        setSubmissions(
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total    = submissions.length;
  const pending  = submissions.filter(s => s.status === "pending_verification" || s.status === "in_review").length;
  const approved = submissions.filter(s => s.status === "approved" || s.status === "live").length;
  const rejected = submissions.filter(s => s.status === "rejected").length;

  const recent   = submissions.slice(0, 5);

  const handleSignOut = async () => {
    await signOut(auth).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14B8A6" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.repName}>{repName}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Stat cards ── */}
        <View style={styles.statsRow}>
          <StatCard label="Total" value={total}    color="#6366F1" />
          <StatCard label="Pending" value={pending}  color="#F59E0B" />
          <StatCard label="Approved" value={approved} color="#10B981" />
          <StatCard label="Rejected" value={rejected} color="#EF4444" />
        </View>

        {/* ── CTA buttons ── */}
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/rep/submit" as any)}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Submit a Provider</Text>
        </TouchableOpacity>

        {/* ── Recent submissions ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Submissions</Text>
            {total > 5 && (
              <TouchableOpacity onPress={() => router.push("/rep/status" as any)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : recent.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No submissions yet</Text>
              <Text style={styles.emptyBody}>
                Tap "Submit a Provider" to start tracking your outreach.
              </Text>
            </View>
          ) : (
            recent.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardName}>{item.providerName}</Text>
                  {item.practiceName ? (
                    <Text style={styles.cardSub}>{item.practiceName}</Text>
                  ) : null}
                  {item.city || item.specialty ? (
                    <Text style={styles.cardMeta}>
                      {[item.specialty, item.city].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge status={item.status} />
              </View>
            ))
          )}
        </View>

        {total > 5 && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/rep/status" as any)}
          >
            <Text style={styles.secondaryBtnText}>View All {total} Submissions</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#14B8A6",
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#14B8A6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 16 : 8,
    paddingBottom: 24,
  },
  greeting: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  repName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  signOutBtn: {
    padding: 8,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: "#14B8A6",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderTopWidth: 3,
    paddingVertical: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0D9488",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  section: {
    backgroundColor: "#F8FAFC",
    marginTop: 8,
    paddingTop: 4,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
  },
  seeAll: {
    fontSize: 14,
    color: "#14B8A6",
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: "#94A3B8",
    padding: 24,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardLeft: {
    flex: 1,
    marginRight: 10,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  cardSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 1,
  },
  cardMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#14B8A6",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: "#14B8A6",
    fontWeight: "700",
    fontSize: 15,
  },
});
