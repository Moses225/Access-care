// ================================================================
// RECOVERY DASHBOARD — Home screen for recovery housing operators
// provider-dashboard/src/pages/RecoveryDashboard.tsx
//
// Availability editor + facility overview for recovery housing.
// Writes to /recoveryHousing/{facilityId} in Firestore.
// ================================================================

import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

// Locked features shown in the upgrade nudge — mirrors Standard plan benefits
const UPGRADE_HOOKS = [
  { icon: "📋", label: "Patient intake forms",    desc: "Patients apply before calling — qualified leads only" },
  { icon: "✉️", label: "Email contact requests",   desc: "Reach you via email, not just phone" },
  { icon: "📊", label: "Analytics & insights",     desc: "See how many patients are viewing your listing" },
  { icon: "🔼", label: "Priority search placement", desc: "Appear above free listings in patient search" },
];

type AvailabilityStatus = "available" | "limited" | "waitlist" | "full" | "call";

interface FacilityData {
  facilityName: string;
  city: string;
  state?: string;
  genderServed: string;
  totalBeds: number;
  availableBeds: number;
  availabilityStatus: AvailabilityStatus;
  waitlistDays: number;
  lastUpdated?: { toDate?: () => Date } | null;
  phone: string;
  email?: string;
  ownerName?: string;
}

const STATUS_OPTIONS: {
  value: AvailabilityStatus;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}[] = [
  { value: "available", label: "Available",  desc: "Beds open now",             color: "text-green-700",  bg: "bg-green-50",  border: "border-green-400", dot: "bg-green-500"  },
  { value: "limited",   label: "Limited",    desc: "1–2 beds left",              color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-400", dot: "bg-amber-500"  },
  { value: "waitlist",  label: "Waitlist",   desc: "Call for wait time",         color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-400",dot: "bg-orange-500" },
  { value: "full",      label: "Full",       desc: "No beds available",          color: "text-red-700",    bg: "bg-red-50",    border: "border-red-400",   dot: "bg-red-500"    },
  { value: "call",      label: "Call First", desc: "Contact for details",        color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-300", dot: "bg-slate-400"  },
];

function statusMeta(value: AvailabilityStatus) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[4];
}

interface IntakeRequest {
  id: string;
  patientName: string;
  phone?: string;
  sobrietyDays?: number;
  gender?: string;
  message?: string;
  status: "pending" | "contacted" | "admitted" | "declined";
  createdAt?: { toDate?: () => Date } | null;
}

export default function RecoveryDashboard() {
  const { providerProfile, logout } = useAuth();
  const navigate = useNavigate();
  const facilityId  = providerProfile?.facilityId;
  const listingPlan = providerProfile?.listingPlan || "free";
  const isFreePlan  = listingPlan === "free";

  // Billing countdown — only shown when on a paid plan and no card on file.
  // Free-tier facilities: no payment ever required, no banner shown.
  const hasPaymentMethod = !!(
    providerProfile?.stripeCustomerId ||
    providerProfile?.stripePaymentMethodId ||
    providerProfile?.manualBilling
  );
  const recoveryBillingDaysRemaining = (() => {
    if (isFreePlan) return null; // free tier — no payment needed
    const raw = providerProfile?.createdAt as any;
    if (!raw) return 0;
    const ms = typeof raw?.toDate === "function"
      ? raw.toDate().getTime()
      : new Date(raw).getTime();
    if (isNaN(ms)) return 0;
    return Math.max(0, 7 - Math.floor((Date.now() - ms) / 86_400_000));
  })();
  const showRecoveryBillingBanner = !isFreePlan && !hasPaymentMethod;

  const [facility, setFacility]             = useState<FacilityData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [error, setError]                   = useState("");
  const [loggingOut, setLoggingOut]         = useState(false);
  const [intakeRequests, setIntakeRequests] = useState<IntakeRequest[]>([]);

  // Editable fields
  const [availableBeds, setAvailableBeds] = useState(0);
  const [totalBeds, setTotalBeds]         = useState(0);
  const [status, setStatus]               = useState<AvailabilityStatus>("available");
  const [waitlistDays, setWaitlistDays]   = useState(0);

  useEffect(() => {
    if (!facilityId) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "recoveryHousing", facilityId));
        if (snap.exists()) {
          const d = snap.data() as FacilityData;
          setFacility(d);
          setAvailableBeds(d.availableBeds ?? 0);
          setTotalBeds(d.totalBeds ?? 0);
          setStatus(d.availabilityStatus ?? "available");
          setWaitlistDays(d.waitlistDays ?? 0);
        }
        // Real-time intake requests listener (Standard+ only)
        // Unsubscribe is handled in a separate useEffect below
      } catch {
        setError("Could not load facility data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [facilityId]);

  // ── Real-time intake requests listener ───────────────────────────────────────
  useEffect(() => {
    if (!facilityId) return;
    const unsub = onSnapshot(
      query(
        collection(db, "recoveryHousing", facilityId, "intakeRequests"),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        setIntakeRequests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IntakeRequest, "id">) }))
        );
      },
      () => { /* subcollection may not exist yet — silent */ }
    );
    return () => unsub();
  }, [facilityId]);

  // ── Update a single intake request status ────────────────────────────────────
  const updateIntakeStatus = async (
    requestId: string,
    newStatus: IntakeRequest["status"]
  ) => {
    if (!facilityId) return;
    // Optimistic update
    setIntakeRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );
    try {
      await updateDoc(
        doc(db, "recoveryHousing", facilityId, "intakeRequests", requestId),
        { status: newStatus, updatedAt: serverTimestamp() }
      );

      // ── Auto-decrement available beds when a patient is admitted ────────────
      // Ensures the bed count stays accurate without a manual edit.
      // Floors at 0 — can't go negative.
      if (newStatus === "admitted") {
        const current = availableBeds;
        if (current > 0) {
          const next = current - 1;
          setAvailableBeds(next);
          // Derive a sensible status automatically
          const autoStatus: AvailabilityStatus =
            next === 0 ? "full"
            : totalBeds > 0 && next / totalBeds <= 0.25 ? "limited"
            : "available";
          setStatus(autoStatus);
          await updateDoc(doc(db, "recoveryHousing", facilityId), {
            availableBeds: next,
            availabilityStatus: autoStatus,
            lastUpdated: serverTimestamp(),
          });
          setFacility((prev) =>
            prev ? { ...prev, availableBeds: next, availabilityStatus: autoStatus } : prev
          );
        }
      }
    } catch {
      // Snapshot listener will self-correct on failure
    }
  };

  const handleSave = async () => {
    if (!facilityId) return;
    if (availableBeds > totalBeds) { setError("Available beds cannot exceed total beds."); return; }
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateDoc(doc(db, "recoveryHousing", facilityId), {
        availableBeds,
        totalBeds,
        availabilityStatus: status,
        waitlistDays: status === "waitlist" ? waitlistDays : 0,
        lastUpdated: serverTimestamp(),
      });
      setFacility((prev) => prev ? { ...prev, availableBeds, totalBeds, availabilityStatus: status, waitlistDays } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); navigate("/login"); } catch { setLoggingOut(false); }
  };

  const lastUpdatedStr = facility?.lastUpdated?.toDate
    ? facility.lastUpdated.toDate().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Not yet updated";

  const meta = statusMeta(status);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <TopNav onLogout={handleLogout} loggingOut={loggingOut} profile={providerProfile} />
      <NavBar />
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  // ── No facility linked ───────────────────────────────────────────────────────
  if (!facilityId || !facility) return (
    <div className="min-h-screen bg-slate-50">
      <TopNav onLogout={handleLogout} loggingOut={loggingOut} profile={providerProfile} />
      <NavBar />
      <div className="max-w-lg mx-auto mt-24 text-center px-4">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🌱</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No facility linked</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Your account isn't connected to a facility yet.{" "}
          Contact{" "}
          <a href="mailto:support@moravacare.com" className="text-teal-600 hover:text-teal-800 underline">
            support@moravacare.com
          </a>{" "}
          and we'll get you set up.
        </p>
      </div>
    </div>
  );

  const genderLabel =
    facility.genderServed === "women"          ? "Women only" :
    facility.genderServed === "men"            ? "Men only" :
    facility.genderServed === "lgbtq_affirming"? "LGBTQ+ affirming" : "Co-ed";

  const occupancyPct = totalBeds > 0 ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0;

  const pendingCount = intakeRequests.filter((r) => r.status === "pending").length;

  // ── Main dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav onLogout={handleLogout} loggingOut={loggingOut} profile={providerProfile} />
      <NavBar />

      {/* ── Pending intake banner — shown immediately, above the fold ────────── */}
      {pendingCount > 0 && (
        <div className="bg-amber-500 text-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 w-8 h-8 bg-white/25 rounded-full flex items-center justify-center font-bold text-sm">
                {pendingCount}
              </span>
              <p className="text-sm font-semibold leading-tight">
                {pendingCount === 1
                  ? "1 new admission request is waiting for your response"
                  : `${pendingCount} new admission requests are waiting for your response`}
              </p>
            </div>
            <a
              href="#intake-requests"
              className="flex-shrink-0 bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              Review now ↓
            </a>
          </div>
        </div>
      )}

      {/* ── Billing setup banner — paid plans only, no payment method on file ─── */}
      {showRecoveryBillingBanner && (
        <div className={`px-4 py-3 border-b ${
          recoveryBillingDaysRemaining! > 0
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-300"
        }`}>
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl flex-shrink-0">
                {recoveryBillingDaysRemaining! > 0 ? "⏰" : "🚨"}
              </span>
              <div>
                <p className={`text-sm font-semibold ${
                  recoveryBillingDaysRemaining! > 0 ? "text-amber-800" : "text-red-800"
                }`}>
                  {recoveryBillingDaysRemaining! > 0
                    ? `${recoveryBillingDaysRemaining} day${recoveryBillingDaysRemaining !== 1 ? "s" : ""} left — add a payment method`
                    : "Action required — add a payment method to stay active"}
                </p>
                <p className={`text-xs mt-0.5 ${
                  recoveryBillingDaysRemaining! > 0 ? "text-amber-700" : "text-red-700"
                }`}>
                  Your {listingPlan === "partner" ? "Partner" : listingPlan === "growth" || listingPlan === "standard" ? "Growth" : ""} listing
                  is billed monthly. Add a card to keep your facility visible to those in need.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/billing")}
              className={`flex-shrink-0 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                recoveryBillingDaysRemaining! > 0
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Set up now
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Facility header ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 mb-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-teal-200 text-sm font-medium">Recovery Housing</span>
                <span className="text-teal-400">·</span>
                <span className="text-teal-200 text-sm">{facility.city}{facility.state ? `, ${facility.state}` : ""}</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-1 truncate">
                {facility.facilityName}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  {genderLabel}
                </span>
                <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  Free Listing ✓
                </span>
                <span className="text-teal-200 text-xs">
                  Updated {lastUpdatedStr}
                </span>
              </div>
            </div>
            {/* Live status badge */}
            <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border ${meta.bg} ${meta.border}`}>
              <span className={`w-2 h-2 rounded-full ${meta.dot} ${status === "available" ? "animate-pulse" : ""}`} />
              <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
            </div>
          </div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Beds"
            value={String(totalBeds)}
            icon="🛏️"
            sub="capacity"
          />
          <StatCard
            label="Available"
            value={availableBeds < 0 ? "—" : String(availableBeds)}
            icon="✅"
            sub={availableBeds < 0 ? "call to confirm" : availableBeds === 1 ? "bed open" : "beds open"}
            highlight={availableBeds > 0}
          />
          <StatCard
            label="Occupancy"
            value={totalBeds > 0 ? `${occupancyPct}%` : "—"}
            icon="📊"
            sub={totalBeds > 0 ? `${totalBeds - (availableBeds < 0 ? 0 : availableBeds)} of ${totalBeds} filled` : "set beds below"}
          />
        </div>

        {/* ── Upgrade nudge (free plan only) ──────────────────────────────── */}
        {isFreePlan && <UpgradeNudge onUpgrade={() => navigate("/billing")} />}

        {/* ── Availability editor ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-800">Update Availability</h2>
            {saved && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-xs">✓</span>
                Live for patients now
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Changes go live immediately — patients and case managers see your current status in real time.
          </p>

          {/* Status selector */}
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            Availability Status
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  status === opt.value
                    ? `${opt.border} ${opt.bg}`
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="accent-teal-600"
                />
                <div>
                  <span className={`text-sm font-semibold ${status === opt.value ? opt.color : "text-slate-700"}`}>
                    {opt.label}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Waitlist days */}
          {status === "waitlist" && (
            <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">
                Estimated Wait Time
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min={0} max={365}
                  value={waitlistDays}
                  onChange={(e) => setWaitlistDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 border border-orange-300 rounded-lg px-3 py-2 text-sm font-semibold text-orange-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-orange-700 font-medium">days</span>
                <span className="text-xs text-orange-500">· shown as "est. X days" to patients</span>
              </div>
            </div>
          )}

          {/* Bed counts */}
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            Bed Count
          </label>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Available beds</label>
              <input
                type="number" min={0} max={totalBeds || 999}
                value={availableBeds}
                onChange={(e) => setAvailableBeds(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Total beds (capacity)</label>
              <input
                type="number" min={1} max={500}
                value={totalBeds}
                onChange={(e) => setTotalBeds(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-red-700 text-sm">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              "✓ Saved — patients see this now"
            ) : (
              "Update Availability"
            )}
          </button>
        </div>

        {/* ── Contact info ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">Contact Information</h2>
            <button
              onClick={() => navigate("/profile")}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium border border-teal-200 hover:border-teal-400 px-3 py-1 rounded-lg transition-colors"
            >
              Edit in Profile →
            </button>
          </div>
          <div className="space-y-2.5 text-sm">
            <Row label="Phone" value={facility.phone} />
            {facility.email    && <Row label="Email"   value={facility.email}    />}
            {facility.ownerName && <Row label="Contact" value={facility.ownerName} />}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            To update contact details, go to{" "}
            <button onClick={() => navigate("/profile")} className="text-teal-600 hover:text-teal-800 underline">
              Facility Profile
            </button>
          </p>
        </div>

        {/* ── Analytics snapshot ──────────────────────────────────────────── */}
        <AnalyticsCard
          plan={listingPlan as "free" | "standard" | "growth" | "partner"}
          viewCount={(facility as unknown as { viewCount?: number })?.viewCount}
          inquiryCount={intakeRequests.length}
          onUpgrade={() => navigate("/billing")}
        />

        {/* ── Intake requests ──────────────────────────────────────────────── */}
        <div id="intake-requests">
          <IntakeRequestsCard
            plan={listingPlan as "free" | "standard" | "growth" | "partner"}
            requests={intakeRequests}
            onUpgrade={() => navigate("/billing")}
            onStatusChange={updateIntakeStatus}
          />
        </div>

        {/* ── Quick links ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
          <h2 className="text-base font-bold text-slate-800 mb-4">Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "ODMHSAS",            href: "https://odmhsas.ok.gov",                      icon: "🏛️", desc: "Oklahoma Mental Health & Substance Abuse" },
              { label: "OKARR Certification", href: "https://okarr.org",                           icon: "🏅", desc: "Oklahoma Alliance for Recovery Residences" },
              { label: "SAMHSA Helpline",    href: "tel:18006624357",                              icon: "📞", desc: "1-800-662-4357 · Free · 24/7" },
              { label: "Oxford House",       href: "https://www.oxfordhouse.org",                  icon: "🏡", desc: "Self-support recovery housing network" },
            ].map((r) => (
              <a
                key={r.label}
                href={r.href}
                target={r.href.startsWith("tel") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-all group"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{r.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-700 group-hover:text-teal-700">{r.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{r.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── Crisis footer ─────────────────────────────────────────────────── */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-red-700 leading-relaxed">
            <span className="font-bold">🆘 Crisis resources for your residents: </span>
            SAMHSA Helpline{" "}
            <a href="tel:18006624357" className="underline font-bold">1-800-662-4357</a>
            {" "}· 988 Suicide & Crisis Lifeline · Free · Confidential · 24/7
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TopNav({
  onLogout,
  loggingOut,
  profile,
}: {
  onLogout: () => void;
  loggingOut: boolean;
  profile: { name?: string } | null;
}) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: logo + portal label */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <span className="text-slate-900 text-lg font-semibold">Morava</span>
            <span className="hidden sm:inline text-slate-400 text-sm ml-2">Recovery Housing Portal</span>
          </div>
        </div>

        {/* Right: name + logout */}
        <div className="flex items-center gap-4">
          {profile?.name && (
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-slate-700">{profile.name}</div>
              <div className="text-xs text-teal-600 font-medium">Recovery Housing</div>
            </div>
          )}
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loggingOut ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </nav>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 ${highlight ? "border-teal-300 bg-teal-50/40" : "border-slate-200"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className={`text-3xl font-bold mb-0.5 ${highlight ? "text-teal-700" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

// ── Analytics snapshot card ────────────────────────────────────────────────────
function AnalyticsCard({
  plan, viewCount, inquiryCount, onUpgrade,
}: {
  plan: "free" | "standard" | "growth" | "partner";
  viewCount?: number;
  inquiryCount: number;
  onUpgrade: () => void;
}) {
  const isLocked = plan === "free";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">Analytics</h2>
        {isLocked ? (
          <span className="text-xs bg-slate-100 text-slate-400 font-semibold px-2.5 py-1 rounded-full">
            🔒 Growth+
          </span>
        ) : (
          <span className="text-xs text-slate-400">Last 30 days</span>
        )}
      </div>
      {isLocked ? (
        <div className="text-center py-6">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-sm text-slate-500 mb-3">
            See how many patients and case managers are finding your listing,
            and how many inquiries you're getting.
          </p>
          <button
            onClick={onUpgrade}
            className="text-sm text-teal-600 font-semibold hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-4 py-2 rounded-lg transition-colors"
          >
            Upgrade to Growth to unlock →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Listing views",   value: viewCount  != null ? String(viewCount)  : "—", icon: "👁️",  sub: "patients saw your listing" },
            { label: "Inquiries",        value: inquiryCount > 0    ? String(inquiryCount) : "0",  icon: "📋", sub: "intake requests received"  },
            { label: "Contact rate",     value: viewCount  ? `${Math.round((inquiryCount / viewCount) * 100)}%` : "—", icon: "📈", sub: "of views become inquiries" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5 leading-tight">{s.label}</div>
              <div className="text-xs text-slate-300 mt-0.5 hidden sm:block">{s.sub}</div>
            </div>
          ))}
        </div>
      )}
      {!isLocked && viewCount == null && (
        <p className="text-xs text-slate-400 mt-4 text-center">
          View tracking starts once patients open your listing in the Morava app.
        </p>
      )}
    </div>
  );
}

// ── Intake requests card ───────────────────────────────────────────────────────
const REQUEST_STATUS_META = {
  pending:   { label: "New",       dot: "bg-teal-500",   text: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200"  },
  contacted: { label: "Contacted", dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200"  },
  admitted:  { label: "Admitted",  dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  declined:  { label: "Declined",  dot: "bg-slate-400",  text: "text-slate-500",  bg: "bg-slate-100", border: "border-slate-200" },
} as const;

type RequestStatus = IntakeRequest["status"];

function IntakeRequestsCard({
  plan, requests, onUpgrade, onStatusChange,
}: {
  plan: "free" | "standard" | "growth" | "partner";
  requests: IntakeRequest[];
  onUpgrade: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}) {
  const isLocked = plan === "free";
  const pending  = requests.filter((r) => r.status === "pending").length;
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [updating, setUpdating]           = useState<string | null>(null);
  const [confirmAdmit, setConfirmAdmit]   = useState<string | null>(null); // requestId pending admit confirm

  const handleStatus = async (id: string, newStatus: RequestStatus) => {
    // Admitted is irreversible (decrements bed count) — require explicit confirmation
    if (newStatus === "admitted" && confirmAdmit !== id) {
      setConfirmAdmit(id);
      return;
    }
    setConfirmAdmit(null);
    setUpdating(id);
    await onStatusChange(id, newStatus);
    setUpdating(null);
    if (newStatus === "admitted" || newStatus === "declined") {
      setExpandedId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800">Intake Requests</h2>
          {pending > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pending} new
            </span>
          )}
        </div>
        {isLocked && (
          <span className="text-xs bg-slate-100 text-slate-400 font-semibold px-2.5 py-1 rounded-full">
            🔒 Growth+
          </span>
        )}
      </div>

      {isLocked ? (
        <div className="text-center py-6">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm text-slate-500 mb-1">
            Patients fill out a short intake form before reaching out.
            You get their name, contact info, sobriety days, and any special needs — before you ever pick up the phone.
          </p>
          <p className="text-xs text-slate-400 mb-3">No cold calls. Qualified inquiries only.</p>
          <button
            onClick={onUpgrade}
            className="text-sm text-teal-600 font-semibold hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-4 py-2 rounded-lg transition-colors"
          >
            Upgrade to Standard to enable →
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm font-medium text-slate-500">No intake requests yet</p>
          <p className="text-xs mt-1">When patients submit an intake inquiry through Morava, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const meta    = REQUEST_STATUS_META[r.status] ?? REQUEST_STATUS_META.pending;
            const date    = r.createdAt?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const isOpen  = expandedId === r.id;
            const isBusy  = updating === r.id;
            const isPending = r.status === "pending";

            return (
              <div
                key={r.id}
                className={`rounded-xl border transition-all ${
                  isPending
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-slate-100 bg-white hover:border-slate-200"
                }`}
              >
                {/* ── Row header — always visible, click to expand ── */}
                <button
                  className="w-full flex items-center gap-3 p-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                    isPending ? "bg-amber-200 text-amber-800" : "bg-teal-100 text-teal-700"
                  }`}>
                    {r.patientName?.[0]?.toUpperCase() || "?"}
                  </div>

                  {/* Name + meta row */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 truncate">
                        {r.patientName || "Anonymous"}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      {r.sobrietyDays != null && <span>🌱 {r.sobrietyDays}d sober</span>}
                      {r.gender && <span>👤 {r.gender}</span>}
                      {date && <span>{date}</span>}
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <span className={`text-slate-400 text-xs transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>

                {/* ── Expanded detail panel ── */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    {/* Contact info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 mb-3">
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="flex items-center gap-1.5 text-sm text-teal-700 font-semibold hover:text-teal-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📞 {r.phone}
                        </a>
                      )}
                      {r.gender && (
                        <span className="text-sm text-slate-500">👤 {r.gender}</span>
                      )}
                      {r.sobrietyDays != null && (
                        <span className="text-sm text-slate-500">🌱 {r.sobrietyDays} days sober</span>
                      )}
                    </div>

                    {/* Message */}
                    {r.message && (
                      <div className="bg-slate-50 rounded-lg p-3 mb-3 text-sm text-slate-600 leading-relaxed border border-slate-100">
                        "{r.message}"
                      </div>
                    )}

                    {/* ── Admit confirmation inline prompt ── */}
                    {confirmAdmit === r.id && (
                      <div className="mb-3 bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-green-800 mb-0.5">
                          Confirm admission?
                        </p>
                        <p className="text-xs text-green-700 mb-3">
                          This will mark the patient as admitted and automatically decrease your available bed count by 1. This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <button
                            disabled={isBusy}
                            onClick={() => handleStatus(r.id, "admitted")}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {isBusy ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : "✅"} Yes, admit
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => setConfirmAdmit(null)}
                            className="text-xs font-semibold px-3 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Status action buttons ── */}
                    <div className="flex flex-wrap gap-2">
                      {r.status !== "contacted" && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleStatus(r.id, "contacted")}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          📞 Mark Contacted
                        </button>
                      )}
                      {r.status !== "admitted" && confirmAdmit !== r.id && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleStatus(r.id, "admitted")}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          ✅ Mark Admitted
                        </button>
                      )}
                      {r.status !== "declined" && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleStatus(r.id, "declined")}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                        >
                          ✗ Decline
                        </button>
                      )}
                      {isBusy && confirmAdmit !== r.id && (
                        <span className="text-xs text-slate-400 self-center">Saving…</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Upgrade nudge — shown on free plan, links to /billing ─────────────────────
function UpgradeNudge({ onUpgrade }: { onUpgrade: () => void }) {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("upgradeNudgeDismissed") === "1"
  );

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 mb-5 text-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                Free plan
              </span>
              <span className="text-teal-200 text-xs">— upgrade to unlock more</span>
            </div>
            <h3 className="font-bold text-white text-base">
              Fill beds faster with Standard
            </h3>
            <p className="text-teal-100 text-xs mt-0.5">
              $80/month · no contract · no auto-charges
            </p>
          </div>
          <button
            onClick={() => { localStorage.setItem("upgradeNudgeDismissed", "1"); setDismissed(true); }}
            className="text-teal-300 hover:text-white transition-colors flex-shrink-0 mt-1"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Feature hooks */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {UPGRADE_HOOKS.map((h) => (
            <div key={h.label} className="flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
              <span className="text-base flex-shrink-0">{h.icon}</span>
              <div>
                <div className="text-xs font-semibold text-white leading-tight">{h.label}</div>
                <div className="text-xs text-teal-200 mt-0.5 leading-tight">{h.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onUpgrade}
            className="bg-white text-teal-700 hover:bg-teal-50 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            See all plans →
          </button>
          <span className="text-teal-200 text-xs">One referral pays for 6+ months</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-700 font-medium text-sm">{value}</span>
    </div>
  );
}
