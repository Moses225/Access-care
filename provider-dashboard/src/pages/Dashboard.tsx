import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

interface Booking {
  id: string;
  userId: string;
  patientName: string;
  patientPhone?: string;
  providerName: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  visitTypeLabel?: string;
  serviceCategoryLabel?: string;
  reasonForVisit?: string;
  bookingFor?: string;
  isMinorPatient?: boolean;
  guardianName?: string;
  guardianPhone?: string;
  declineReason?: string;
  providerId?: string;
  notes?: string;
  patientIntakeSummary?: {
    medications?: string | string[];
    allergies?: string | string[];
    conditions?: string | string[];
    surgeries?: string | string[];
    vaccinations?: string | string[];
    bloodType?: string;
    height?: string;
    weight?: string;
    insurance?: string | string[];
    primaryCareProvider?: string;
    lastPhysical?: string;
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    diet?: string | string[];
    familyHistory?: string | string[];
    mentalHealthHistory?: string | string[];
    pregnancyStatus?: string;
    emergencyContact?: { name: string; phone: string; relation: string };
    emergencyContact2?: { name: string; phone: string; relation: string };
  };
}

const DECLINE_REASONS = [
  "No longer accepting this insurance plan",
  "Not accepting new patients at this time",
  "Outside scope of practice",
  "Appointment slot no longer available",
  "Please contact office to reschedule",
  "Other — please call our office",
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-teal-50 text-teal-700 border-teal-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ Pending",
  confirmed: "✓ Confirmed",
  cancelled: "✕ Cancelled",
  completed: "🎉 Completed",
};

// ── EHR PDF Generator ─────────────────────────────────────────────────────
function generateEHRPDF(booking: Booking) {
  const intake = booking.patientIntakeSummary;
  const hasIntake = !!intake;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const fmt = (val: string | string[] | undefined | null): string => {
    if (!val) return "Not provided";
    if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "Not provided";
    return val || "Not provided";
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Morava — Patient Summary — ${booking.patientName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1E293B; background: #fff; }
  .page { padding: 20px 28px; max-width: 800px; margin: 0 auto; }
  
  /* Header */
  .header { background: #0A1628; color: white; padding: 14px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; align-items: center; gap: 10px; }
  .logo-box { background: #00BCD4; width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 14px; }
  .header-title { font-size: 15pt; font-weight: bold; }
  .header-sub { font-size: 8pt; color: #94A3B8; }
  .header-right { text-align: right; font-size: 8pt; color: #94A3B8; }
  .teal-bar { background: #00BCD4; height: 3px; margin-bottom: 12px; border-radius: 0 0 4px 4px; }
  
  /* Alert boxes */
  .alert-red { background: #FEF2F2; border: 1.5px solid #EF4444; border-left: 5px solid #EF4444; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8.5pt; color: #991B1B; font-weight: bold; }
  .alert-amber { background: #FEF3C7; border: 1.5px solid #F59E0B; border-left: 5px solid #F59E0B; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8.5pt; color: #92400E; font-weight: bold; }
  .alert-teal { background: #F0FAFB; border: 1.5px solid #00BCD4; border-left: 5px solid #00BCD4; padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-size: 8pt; color: #0A1628; }
  .alert-gray { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8pt; color: #64748B; font-style: italic; }
  
  /* Section headers */
  .section { margin-top: 14px; margin-bottom: 6px; }
  .section-title { font-size: 9.5pt; font-weight: bold; color: #0A1628; padding-bottom: 4px; border-bottom: 2px solid #00BCD4; display: flex; align-items: center; gap: 6px; }
  
  /* Field tables */
  .field-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .field-table td { padding: 5px 8px; font-size: 9pt; vertical-align: top; border: 0.5px solid #E2E8F0; }
  .field-table tr:nth-child(even) td { background: #F8FAFC; }
  .field-label { color: #64748B; font-weight: bold; font-size: 8pt; width: 36%; }
  .field-value { color: #1E293B; }
  .field-value.missing { color: #94A3B8; font-style: italic; }
  
  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0; }
  .tag { background: #F0FAFB; border: 0.5px solid #E2E8F0; padding: 3px 8px; border-radius: 4px; font-size: 8pt; color: #1E293B; }
  .tag-red { background: #FEF2F2; border-color: #FECACA; color: #991B1B; }
  .tag-green { background: #F0FDF4; border-color: #BBF7D0; color: #166534; }
  
  /* Footer */
  .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 7.5pt; color: #94A3B8; text-align: center; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="logo-box">M</div>
      <div>
        <div class="header-title">Morava Care</div>
        <div class="header-sub">Patient Summary — EHR Ready Document</div>
      </div>
    </div>
    <div class="header-right">
      CONFIDENTIAL — PHI DOCUMENT<br/>
      Generated: ${today}<br/>
      Booking ID: ${booking.id}
    </div>
  </div>
  <div class="teal-bar"></div>

  <!-- HIPAA Alert -->
  <div class="alert-red">⚠ HIPAA NOTICE: This document contains Protected Health Information (PHI). Authorized personnel only. Do not share without patient authorization.</div>

  ${!hasIntake ? `<div class="alert-amber">📋 INTAKE FORM NOT COMPLETED: Patient has not filled out a health profile. Basic booking information shown below. Collect full medical history at time of visit.</div>` : ""}

  <!-- Appointment Details -->
  <div class="section">
    <div class="section-title">📅 APPOINTMENT REQUEST DETAILS</div>
  </div>
  <table class="field-table">
    <tr><td class="field-label">Booking ID</td><td class="field-value">${booking.id}</td></tr>
    <tr><td class="field-label">Requested Date</td><td class="field-value">${formatDateLong(booking.date)}</td></tr>
    <tr><td class="field-label">Requested Time</td><td class="field-value">${booking.time}</td></tr>
    <tr><td class="field-label">Visit Type</td><td class="field-value">${booking.visitTypeLabel || "Not specified"}</td></tr>
    ${booking.serviceCategoryLabel ? `<tr><td class="field-label">Service Category</td><td class="field-value">${booking.serviceCategoryLabel}</td></tr>` : ""}
    <tr><td class="field-label">Reason for Visit</td><td class="field-value ${!booking.reasonForVisit ? 'missing' : ''}">${booking.reasonForVisit || "Not provided"}</td></tr>
    ${booking.notes ? `<tr><td class="field-label">Patient Notes</td><td class="field-value">${booking.notes}</td></tr>` : ""}
    <tr><td class="field-label">Status</td><td class="field-value">${booking.status.toUpperCase()}</td></tr>
    <tr><td class="field-label">Assigned Provider</td><td class="field-value">${booking.providerName}</td></tr>
  </table>

  <!-- Patient Demographics -->
  <div class="section">
    <div class="section-title">👤 PATIENT DEMOGRAPHICS</div>
  </div>
  <table class="field-table">
    <tr><td class="field-label">Full Name</td><td class="field-value">${booking.patientName}</td></tr>
    <tr><td class="field-label">Contact Phone</td><td class="field-value ${!booking.patientPhone ? 'missing' : ''}">${booking.patientPhone || "Not provided"}</td></tr>
    <tr><td class="field-label">Booking For</td><td class="field-value">${booking.bookingFor === "dependent" ? "Dependent / Family Member" : "Account Holder"}</td></tr>
    ${booking.isMinorPatient ? `<tr><td class="field-label">Minor Patient</td><td class="field-value">Yes</td></tr>` : ""}
    ${booking.guardianName ? `<tr><td class="field-label">Guardian Name</td><td class="field-value">${booking.guardianName}</td></tr>` : ""}
    ${booking.guardianPhone ? `<tr><td class="field-label">Guardian Phone</td><td class="field-value">${booking.guardianPhone}</td></tr>` : ""}
    <tr><td class="field-label">Insurance / Coverage</td><td class="field-value ${!fmt(intake?.insurance) || fmt(intake?.insurance) === 'Not provided' ? 'missing' : ''}">${fmt(intake?.insurance)}</td></tr>
    <tr><td class="field-label">Primary Care Provider</td><td class="field-value ${!intake?.primaryCareProvider ? 'missing' : ''}">${intake?.primaryCareProvider || "Not provided"}</td></tr>
  </table>

  <!-- Vitals -->
  <div class="section">
    <div class="section-title">📊 VITALS & HEALTH OVERVIEW</div>
  </div>
  <table class="field-table">
    <tr><td class="field-label">Blood Type</td><td class="field-value ${!intake?.bloodType ? 'missing' : ''}">${intake?.bloodType || "Not provided"}</td></tr>
    <tr><td class="field-label">Height</td><td class="field-value ${!intake?.height ? 'missing' : ''}">${intake?.height || "Not provided"}</td></tr>
    <tr><td class="field-label">Weight</td><td class="field-value ${!intake?.weight ? 'missing' : ''}">${intake?.weight || "Not provided"}</td></tr>
    <tr><td class="field-label">Last Physical Exam</td><td class="field-value ${!intake?.lastPhysical ? 'missing' : ''}">${intake?.lastPhysical || "Not provided"}</td></tr>
  </table>

  <!-- ALLERGIES — Critical -->
  <div class="section">
    <div class="section-title">⚠ ALLERGIES — REVIEW BEFORE PRESCRIBING</div>
  </div>
  ${intake?.allergies && fmt(intake.allergies) !== "Not provided"
    ? `<div class="alert-red">ALLERGIES: ${fmt(intake.allergies)}</div>`
    : `<div class="alert-gray">No allergies reported or intake form not completed. Verify with patient.</div>`}

  <!-- Medications -->
  <div class="section">
    <div class="section-title">💊 CURRENT MEDICATIONS</div>
  </div>
  ${intake?.medications && fmt(intake.medications) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.medications) ? intake.medications : [intake.medications]).map(m => `<span class="tag">${m}</span>`).join("")}</div>`
    : `<div class="alert-gray">No medications reported or intake form not completed.</div>`}

  <!-- Conditions -->
  <div class="section">
    <div class="section-title">🩺 ACTIVE MEDICAL CONDITIONS</div>
  </div>
  ${intake?.conditions && fmt(intake.conditions) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.conditions) ? intake.conditions : [intake.conditions]).map(c => `<span class="tag">${c}</span>`).join("")}</div>`
    : `<div class="alert-gray">No conditions reported or intake form not completed.</div>`}

  <!-- Surgeries -->
  <div class="section">
    <div class="section-title">🏥 SURGICAL HISTORY</div>
  </div>
  ${intake?.surgeries && fmt(intake.surgeries) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.surgeries) ? intake.surgeries : [intake.surgeries]).map(s => `<span class="tag">${s}</span>`).join("")}</div>`
    : `<div class="alert-gray">No surgical history reported or intake form not completed.</div>`}

  <!-- Vaccinations -->
  <div class="section">
    <div class="section-title">💉 VACCINATION HISTORY</div>
  </div>
  ${intake?.vaccinations && fmt(intake.vaccinations) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.vaccinations) ? intake.vaccinations : [intake.vaccinations]).map(v => `<span class="tag tag-green">${v}</span>`).join("")}</div>`
    : `<div class="alert-gray">No vaccination history reported or intake form not completed.</div>`}

  <!-- Lifestyle -->
  <div class="section">
    <div class="section-title">🌿 LIFESTYLE FACTORS</div>
  </div>
  <table class="field-table">
    <tr><td class="field-label">Smoking</td><td class="field-value ${!intake?.smoking ? 'missing' : ''}">${intake?.smoking || "Not provided"}</td></tr>
    <tr><td class="field-label">Alcohol Use</td><td class="field-value ${!intake?.alcohol ? 'missing' : ''}">${intake?.alcohol || "Not provided"}</td></tr>
    <tr><td class="field-label">Exercise</td><td class="field-value ${!intake?.exercise ? 'missing' : ''}">${intake?.exercise || "Not provided"}</td></tr>
    <tr><td class="field-label">Diet</td><td class="field-value ${!intake?.diet ? 'missing' : ''}">${fmt(intake?.diet)}</td></tr>
    <tr><td class="field-label">Pregnancy Status</td><td class="field-value ${!intake?.pregnancyStatus ? 'missing' : ''}">${intake?.pregnancyStatus || "Not provided"}</td></tr>
  </table>

  <!-- Family History -->
  <div class="section">
    <div class="section-title">👨‍👩‍👧 FAMILY MEDICAL HISTORY</div>
  </div>
  ${intake?.familyHistory && fmt(intake.familyHistory) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.familyHistory) ? intake.familyHistory : [intake.familyHistory]).map(f => `<span class="tag">${f}</span>`).join("")}</div>`
    : `<div class="alert-gray">No family history reported or intake form not completed.</div>`}

  <!-- Mental Health -->
  <div class="section">
    <div class="section-title">🧠 MENTAL HEALTH HISTORY</div>
  </div>
  ${intake?.mentalHealthHistory && fmt(intake.mentalHealthHistory) !== "Not provided"
    ? `<div class="tags">${(Array.isArray(intake.mentalHealthHistory) ? intake.mentalHealthHistory : [intake.mentalHealthHistory]).map(m => `<span class="tag">${m}</span>`).join("")}</div>`
    : `<div class="alert-gray">No mental health history reported or intake form not completed.</div>`}

  <!-- Emergency Contacts -->
  <div class="section">
    <div class="section-title">🆘 EMERGENCY CONTACTS</div>
  </div>
  <table class="field-table">
    <tr><td class="field-label">Primary Contact</td><td class="field-value ${!intake?.emergencyContact?.name ? 'missing' : ''}">${intake?.emergencyContact?.name || "Not provided"}</td></tr>
    <tr><td class="field-label">Primary Phone</td><td class="field-value ${!intake?.emergencyContact?.phone ? 'missing' : ''}">${intake?.emergencyContact?.phone || "Not provided"}</td></tr>
    <tr><td class="field-label">Relationship</td><td class="field-value ${!intake?.emergencyContact?.relation ? 'missing' : ''}">${intake?.emergencyContact?.relation || "Not provided"}</td></tr>
    ${intake?.emergencyContact2?.name ? `
    <tr><td class="field-label">Secondary Contact</td><td class="field-value">${intake.emergencyContact2.name}</td></tr>
    <tr><td class="field-label">Secondary Phone</td><td class="field-value">${intake.emergencyContact2.phone}</td></tr>
    <tr><td class="field-label">Relationship</td><td class="field-value">${intake.emergencyContact2.relation}</td></tr>
    ` : ""}
  </table>

  <!-- EHR Instructions -->
  <div class="alert-teal">
    <strong>📁 EHR UPLOAD INSTRUCTIONS:</strong> Download this PDF from your Morava provider dashboard.
    Drag and drop directly into Epic, Athena, eClinicalWorks, or any EHR document tab.
    Confirm all information with patient at time of visit. Fields showing "Not provided" should be collected in person.
  </div>

  <div class="footer">
    Generated by Morava Care LLC &nbsp;|&nbsp; dashboard.moravacare.com &nbsp;|&nbsp; support@moravacare.com &nbsp;|&nbsp; (855) 812-6996<br/>
    This document contains Protected Health Information (PHI). Handle in accordance with HIPAA regulations.
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Morava_Patient_Summary_${booking.patientName.replace(/\s+/g, "_")}_${booking.date}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateLong(dateStr: string) {
  if (!dateStr?.includes("-")) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, providerProfile, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all" | "past">("upcoming");
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(true);

  useEffect(() => {
    if (!providerProfile?.providerId) return;
    const q = query(
      collection(db, "bookings"),
      where("providerId", "==", providerProfile.providerId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Booking[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Booking, "id">),
      }));
      list.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return (a.date + a.time).localeCompare(b.date + b.time);
      });
      setBookings(list);
      setLoading(false);
    });
    return unsub;
  }, [providerProfile?.providerId]);

  const today = new Date().toISOString().split("T")[0];
  const filtered = bookings.filter((b) => {
    if (filter === "upcoming")
      return (
        (b.status === "pending" || b.status === "confirmed") && b.date >= today
      );
    if (filter === "past")
      return (
        b.status === "completed" || b.status === "cancelled" || b.date < today
      );
    return true;
  });

  const handleConfirm = async (booking: Booking) => {
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "confirmed",
        confirmedAt: serverTimestamp(),
        confirmedBy: user?.uid,
      });
      if (
        booking.visitTypeLabel?.toLowerCase().includes("meet") &&
        booking.patientIntakeSummary &&
        booking.userId
      ) {
        try {
          await updateDoc(doc(db, "users", booking.userId), {
            voucherUsed: true,
          });
        } catch {
          // Non-critical
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!declineId || !declineReason) return;
    const booking = bookings.find((b) => b.id === declineId);
    if (booking?.providerId !== providerProfile?.providerId) return;
    setActionLoading(declineId);
    try {
      await updateDoc(doc(db, "bookings", declineId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: user?.uid,
        declineReason,
      });
      setDeclineId(null);
      setDeclineReason("");
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = bookings.filter(
    (b) => b.status === "pending" && b.date >= today,
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <div>
              <span className="font-display text-slate-900 text-lg">Morava</span>
              <span className="text-slate-400 text-sm ml-2">Provider Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {providerProfile && (
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-700">{providerProfile.name}</div>
                <div className="text-xs text-slate-400">{providerProfile.specialty}</div>
              </div>
            )}
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Email notification banner ──────────────────────────────────── */}
        {showNotifBanner && (
          <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-teal-500 text-xl flex-shrink-0">📧</span>
            <div className="flex-1">
              <div className="font-semibold text-teal-800 text-sm mb-1">
                Booking alerts are sent to your registered email
              </div>
              <div className="text-teal-700 text-xs">
                When a patient books with you, you'll receive an email notification at{" "}
                <strong>{user?.email}</strong> with a link to log in and confirm.
                Make sure this is your front desk or scheduling email for fastest response.
              </div>
            </div>
            <button
              onClick={() => setShowNotifBanner(false)}
              className="text-teal-400 hover:text-teal-600 text-lg flex-shrink-0"
            >✕</button>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-slate-900 mb-1">
            Good {getTimeOfDay()}, {providerProfile?.name?.split(" ")[0] || "Doctor"} 👋
          </h1>
          <p className="text-slate-500">
            {pendingCount > 0
              ? `You have ${pendingCount} pending appointment${pendingCount !== 1 ? "s" : ""} awaiting confirmation.`
              : "No pending appointments — you're all caught up."}
          </p>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Pending", value: bookings.filter((b) => b.status === "pending" && b.date >= today).length, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Confirmed", value: bookings.filter((b) => b.status === "confirmed" && b.date >= today).length, color: "text-teal-600", bg: "bg-teal-50" },
            { label: "Total", value: bookings.length, color: "text-slate-700", bg: "bg-slate-100" },
            { label: "Cancelled", value: bookings.filter((b) => b.status === "cancelled").length, color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4`}>
              <div className={`font-display text-3xl ${color} mb-1`}>{value}</div>
              <div className="text-xs text-slate-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          {(["upcoming", "all", "past"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === tab
                  ? "bg-teal-500 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Bookings list ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="font-display text-xl text-slate-700 mb-2">No appointments found</h3>
            <p className="text-slate-400 text-sm">
              {filter === "upcoming" ? "New appointment requests will appear here." : "Try switching to a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-start gap-4"
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs text-slate-400 font-bold uppercase">{formatWeekday(booking.date)}</div>
                  <div className="font-display text-xl text-slate-900">{formatMonthDay(booking.date)}</div>
                  <div className="text-sm font-semibold text-teal-600">{booking.time}</div>
                </div>
                <div className="w-px h-12 bg-slate-100 hidden sm:block" />

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-900">{booking.patientName}</span>
                    {booking.bookingFor === "dependent" && booking.isMinorPatient && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Minor</span>
                    )}
                    {!booking.patientIntakeSummary && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">⚠ No intake form</span>
                    )}
                  </div>
                  {booking.visitTypeLabel && (
                    <div className="text-sm text-slate-500">🩺 {booking.visitTypeLabel}</div>
                  )}
                  {booking.serviceCategoryLabel && (
                    <div className="text-sm text-teal-600">› {booking.serviceCategoryLabel}</div>
                  )}
                  {booking.reasonForVisit && (
                    <div className="text-xs text-slate-400 italic mt-1">{booking.reasonForVisit}</div>
                  )}

                  {/* Patient health summary */}
                  {booking.patientIntakeSummary ? (
                    <details className="mt-2">
                      <summary className="text-xs font-semibold text-teal-600 cursor-pointer hover:text-teal-800">
                        🏥 Patient Health Summary
                      </summary>
                      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                        {booking.patientIntakeSummary.bloodType && (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-600">Blood Type:</span>{" "}
                            <span className="text-slate-800">{booking.patientIntakeSummary.bloodType}</span>
                          </div>
                        )}
                        {(() => {
                          const allergies = booking.patientIntakeSummary?.allergies;
                          const display = Array.isArray(allergies) ? allergies.join(", ") : allergies;
                          return display && display !== "None" && display !== "" ? (
                            <div className="text-xs">
                              <span className="font-semibold text-red-600">⚠️ Allergies:</span>{" "}
                              <span className="text-slate-800">{display}</span>
                            </div>
                          ) : null;
                        })()}
                        {(() => {
                          const meds = booking.patientIntakeSummary?.medications;
                          const display = Array.isArray(meds) ? meds.join(", ") : meds;
                          return display && display !== "None" && display !== "" ? (
                            <div className="text-xs">
                              <span className="font-semibold text-slate-600">💊 Medications:</span>{" "}
                              <span className="text-slate-800">{display}</span>
                            </div>
                          ) : null;
                        })()}
                        {(() => {
                          const conds = booking.patientIntakeSummary?.conditions;
                          const display = Array.isArray(conds) ? conds.join(", ") : conds;
                          return display && display !== "None" && display !== "" ? (
                            <div className="text-xs">
                              <span className="font-semibold text-slate-600">🩺 Conditions:</span>{" "}
                              <span className="text-slate-800">{display}</span>
                            </div>
                          ) : null;
                        })()}
                        {booking.patientIntakeSummary.emergencyContact?.name && (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-600">🆘 Emergency:</span>{" "}
                            <span className="text-slate-800">
                              {booking.patientIntakeSummary.emergencyContact.name} —{" "}
                              {booking.patientIntakeSummary.emergencyContact.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </details>
                  ) : (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                      📋 Patient has not completed intake form. Collect medical history at visit.
                    </div>
                  )}

                  {booking.status === "cancelled" && booking.declineReason && (
                    <div className="text-xs text-red-400 mt-1">Reason: {booking.declineReason}</div>
                  )}
                </div>

                {/* Status + actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLES[booking.status]}`}>
                    {STATUS_LABELS[booking.status]}
                  </span>

                  {/* Action buttons */}
                  {booking.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(booking)}
                        disabled={actionLoading === booking.id}
                        className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        {actionLoading === booking.id ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => { setDeclineId(booking.id); setDeclineReason(""); }}
                        disabled={actionLoading === booking.id}
                        className="border border-slate-200 hover:border-red-200 hover:text-red-600 text-slate-500 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {/* ── Download EHR Summary button ── */}
                  <button
                    onClick={() => generateEHRPDF(booking)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-300 px-3 py-1.5 rounded-lg transition-colors bg-white hover:bg-teal-50"
                    title="Download patient summary for EHR upload"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    EHR Summary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Decline modal ──────────────────────────────────────────────────── */}
      {declineId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl text-slate-900 mb-2">Decline appointment</h3>
            <p className="text-slate-500 text-sm mb-6">Select a reason. The patient will be notified immediately.</p>
            <div className="space-y-2 mb-6">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setDeclineReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                    declineReason === reason
                      ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {declineReason === reason ? "● " : "○ "}{reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeclineId(null); setDeclineReason(""); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason || actionLoading === declineId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {actionLoading === declineId ? "Declining..." : "Decline appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatWeekday(dateStr: string) {
  if (!dateStr?.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(dateStr: string) {
  if (!dateStr?.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
