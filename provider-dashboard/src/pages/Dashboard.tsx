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
  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "no_show"
    | "reschedule_pending";
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
  noShow?: boolean;
  billable?: boolean;
  proposedDate?: string;
  proposedTime?: string;
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
  no_show: "bg-orange-50 text-orange-700 border-orange-200",
  reschedule_pending: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ Pending",
  confirmed: "✓ Confirmed",
  cancelled: "✕ Cancelled",
  completed: "✓ Completed",
  no_show: "✗ No-show",
  reschedule_pending: "⟳ Reschedule sent",
};

// ── EHR PDF — opens in new window and triggers print dialog ─────────────────
// Provider hits Cmd+P or File > Print > Save as PDF — frictionless, professional
function generateEHRPDF(booking: Booking) {
  const intake = booking.patientIntakeSummary;
  const hasIntake = !!intake;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fmt = (val: string | string[] | undefined | null): string => {
    if (!val) return "Not provided";
    if (Array.isArray(val))
      return val.length > 0 ? val.join(", ") : "Not provided";
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
  .header { background: #0A1628; color: white; padding: 14px 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; align-items: center; gap: 10px; }
  .logo-box { background: #0D9488; width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 14px; }
  .header-title { font-size: 15pt; font-weight: bold; }
  .header-sub { font-size: 8pt; color: #94A3B8; }
  .header-right { text-align: right; font-size: 8pt; color: #94A3B8; }
  .teal-bar { background: #0D9488; height: 3px; margin-bottom: 12px; border-radius: 0 0 4px 4px; }
  .alert-red { background: #FEF2F2; border: 1.5px solid #EF4444; border-left: 5px solid #EF4444; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8.5pt; color: #991B1B; font-weight: bold; }
  .alert-amber { background: #FEF3C7; border: 1.5px solid #F59E0B; border-left: 5px solid #F59E0B; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8.5pt; color: #92400E; font-weight: bold; }
  .alert-teal { background: #F0FDFB; border: 1.5px solid #0D9488; border-left: 5px solid #0D9488; padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-size: 8pt; color: #0A1628; }
  .alert-gray { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 8pt; color: #64748B; font-style: italic; }
  .section { margin-top: 14px; margin-bottom: 6px; }
  .section-title { font-size: 9.5pt; font-weight: bold; color: #0A1628; padding-bottom: 4px; border-bottom: 2px solid #0D9488; }
  .field-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .field-table td { padding: 5px 8px; font-size: 9pt; vertical-align: top; border: 0.5px solid #E2E8F0; }
  .field-table tr:nth-child(even) td { background: #F8FAFC; }
  .field-label { color: #64748B; font-weight: bold; font-size: 8pt; width: 36%; }
  .field-value { color: #1E293B; }
  .field-value.missing { color: #94A3B8; font-style: italic; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0; }
  .tag { background: #F0FDFB; border: 0.5px solid #E2E8F0; padding: 3px 8px; border-radius: 4px; font-size: 8pt; color: #1E293B; }
  .tag-red { background: #FEF2F2; border-color: #FECACA; color: #991B1B; }
  .tag-green { background: #F0FDF4; border-color: #BBF7D0; color: #166534; }
  .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 7.5pt; color: #94A3B8; text-align: center; }
  .no-print { display: block; background: #0D9488; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 11pt; font-weight: bold; cursor: pointer; margin: 0 auto 16px; font-family: Arial, sans-serif; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">
  <button class="no-print" onclick="window.print()">⬇ Save as PDF / Print</button>
  <div class="header">
    <div class="header-left">
      <div class="logo-box">M</div>
      <div>
        <div class="header-title">Morava Care</div>
        <div class="header-sub">Patient Summary — EHR Ready</div>
      </div>
    </div>
    <div class="header-right">
      CONFIDENTIAL — PHI DOCUMENT<br/>
      Generated: ${today}<br/>
      Booking ID: ${booking.id}
    </div>
  </div>
  <div class="teal-bar"></div>
  <div class="alert-red">⚠ HIPAA NOTICE: This document contains Protected Health Information (PHI). Authorized personnel only. Do not share without patient authorization.</div>
  ${!hasIntake ? `<div class="alert-amber">📋 INTAKE FORM NOT COMPLETED: Patient has not filled out a health profile. Basic booking information shown below. Collect full medical history at time of visit.</div>` : ""}
  <div class="section"><div class="section-title">📅 APPOINTMENT DETAILS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Booking ID</td><td class="field-value">${booking.id}</td></tr>
    <tr><td class="field-label">Requested Date</td><td class="field-value">${formatDateLong(booking.date)}</td></tr>
    <tr><td class="field-label">Requested Time</td><td class="field-value">${booking.time}</td></tr>
    <tr><td class="field-label">Visit Type</td><td class="field-value">${booking.visitTypeLabel || "Not specified"}</td></tr>
    <tr><td class="field-label">Reason for Visit</td><td class="field-value ${!booking.reasonForVisit ? "missing" : ""}">${booking.reasonForVisit || "Not provided"}</td></tr>
    <tr><td class="field-label">Status</td><td class="field-value">${booking.status.toUpperCase()}</td></tr>
    <tr><td class="field-label">Provider</td><td class="field-value">${booking.providerName}</td></tr>
  </table>
  <div class="section"><div class="section-title">👤 PATIENT DEMOGRAPHICS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Full Name</td><td class="field-value">${booking.patientName}</td></tr>
    <tr><td class="field-label">Contact Phone</td><td class="field-value ${!booking.patientPhone ? "missing" : ""}">${booking.patientPhone || "Not provided"}</td></tr>
    <tr><td class="field-label">Booking For</td><td class="field-value">${booking.bookingFor === "dependent" ? "Dependent / Family Member" : "Account Holder"}</td></tr>
    ${booking.isMinorPatient ? `<tr><td class="field-label">Minor Patient</td><td class="field-value">Yes</td></tr>` : ""}
    ${booking.guardianName ? `<tr><td class="field-label">Guardian</td><td class="field-value">${booking.guardianName} — ${booking.guardianPhone || ""}</td></tr>` : ""}
    <tr><td class="field-label">Insurance</td><td class="field-value ${fmt(intake?.insurance) === "Not provided" ? "missing" : ""}">${fmt(intake?.insurance)}</td></tr>
    <tr><td class="field-label">Primary Care Provider</td><td class="field-value ${!intake?.primaryCareProvider ? "missing" : ""}">${intake?.primaryCareProvider || "Not provided"}</td></tr>
  </table>
  <div class="section"><div class="section-title">⚠ ALLERGIES — REVIEW BEFORE PRESCRIBING</div></div>
  ${
    intake?.allergies && fmt(intake.allergies) !== "Not provided"
      ? `<div class="alert-red">ALLERGIES: ${fmt(intake.allergies)}</div>`
      : `<div class="alert-gray">No allergies reported or intake form not completed. Verify with patient.</div>`
  }
  <div class="section"><div class="section-title">💊 CURRENT MEDICATIONS</div></div>
  ${
    intake?.medications && fmt(intake.medications) !== "Not provided"
      ? `<div class="tags">${(Array.isArray(intake.medications) ? intake.medications : [intake.medications]).map((m) => `<span class="tag">${m}</span>`).join("")}</div>`
      : `<div class="alert-gray">No medications reported or intake form not completed.</div>`
  }
  <div class="section"><div class="section-title">🩺 ACTIVE CONDITIONS & SURGICAL HISTORY</div></div>
  ${
    intake?.conditions && fmt(intake.conditions) !== "Not provided"
      ? `<div class="tags">${(Array.isArray(intake.conditions) ? intake.conditions : [intake.conditions]).map((c) => `<span class="tag">${c}</span>`).join("")}</div>`
      : `<div class="alert-gray">No conditions reported.</div>`
  }
  ${
    intake?.surgeries && fmt(intake.surgeries) !== "Not provided"
      ? `<div class="tags">${(Array.isArray(intake.surgeries) ? intake.surgeries : [intake.surgeries]).map((s) => `<span class="tag">${s}</span>`).join("")}</div>`
      : ""
  }
  <div class="section"><div class="section-title">📊 VITALS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Blood Type</td><td class="field-value ${!intake?.bloodType ? "missing" : ""}">${intake?.bloodType || "Not provided"}</td></tr>
    <tr><td class="field-label">Height</td><td class="field-value ${!intake?.height ? "missing" : ""}">${intake?.height || "Not provided"}</td></tr>
    <tr><td class="field-label">Weight</td><td class="field-value ${!intake?.weight ? "missing" : ""}">${intake?.weight || "Not provided"}</td></tr>
  </table>
  <div class="section"><div class="section-title">🆘 EMERGENCY CONTACTS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Primary</td><td class="field-value ${!intake?.emergencyContact?.name ? "missing" : ""}">${intake?.emergencyContact ? `${intake.emergencyContact.name} — ${intake.emergencyContact.phone} (${intake.emergencyContact.relation})` : "Not provided"}</td></tr>
    ${intake?.emergencyContact2?.name ? `<tr><td class="field-label">Secondary</td><td class="field-value">${intake.emergencyContact2.name} — ${intake.emergencyContact2.phone} (${intake.emergencyContact2.relation})</td></tr>` : ""}
  </table>
  <div class="alert-teal">
    <strong>📁 EHR UPLOAD:</strong> Drag and drop this PDF directly into Epic, Athena, eClinicalWorks, or any EHR document tab.
    Confirm all information with patient at visit. Fields showing "Not provided" should be collected in person.
  </div>
  <div class="footer">
    Generated by Morava Care LLC &nbsp;|&nbsp; dashboard.moravacare.com &nbsp;|&nbsp; support@moravacare.com &nbsp;|&nbsp; (855) 812-6996<br/>
    This document contains Protected Health Information (PHI). Handle in accordance with HIPAA regulations.
  </div>
</div>
<script>
  // Auto-trigger print after a short render delay
  window.onload = function() { setTimeout(function() { window.print(); }, 600); };
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, "_blank", "width=900,height=700");
  if (!win) {
    alert(
      "Please allow popups for dashboard.moravacare.com to open the EHR summary.",
    );
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

// ── Add to Calendar — generates ICS file, works with Google, Apple, Outlook ─
function addToCalendar(booking: Booking) {
  const [y, m, d] = booking.date.split("-").map(Number);
  const timeMatch = booking.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  let hours = timeMatch ? parseInt(timeMatch[1]) : 9;
  const mins = timeMatch ? parseInt(timeMatch[2]) : 0;
  const isPM = timeMatch?.[3]?.toUpperCase() === "PM";
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;

  const start = new Date(y, m - 1, d, hours, mins);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const fmt = (dt: Date) =>
    dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const uid = `${booking.id}-${Date.now()}@moravacare.com`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Morava Care//Provider Dashboard//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `DTSTAMP:${fmt(new Date())}`,
    `SUMMARY:Patient: ${booking.patientName}`,
    `DESCRIPTION:Visit: ${booking.visitTypeLabel || "Appointment"}\\nReason: ${booking.reasonForVisit || "Not specified"}\\nBooking ID: ${booking.id}\\nManage at: dashboard.moravacare.com`,
    "LOCATION:Your Practice",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment_${booking.patientName.replace(/\s+/g, "_")}_${booking.date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateLong(dateStr: string) {
  if (!dateStr?.includes("-")) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, providerProfile, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all" | "past">("upcoming");

  // Decline
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Reschedule
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Billing
  const [showBillingBanner, setShowBillingBanner] = useState(true);
  const [showBillingModal, setShowBillingModal] = useState(false);

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
  const hasStripe = !!(providerProfile as unknown as Record<string, unknown>)
    ?.stripeCustomerId;

  const filtered = bookings.filter((b) => {
    if (filter === "upcoming")
      return (
        (b.status === "pending" ||
          b.status === "confirmed" ||
          b.status === "reschedule_pending") &&
        b.date >= today
      );
    if (filter === "past")
      return (
        b.status === "completed" ||
        b.status === "cancelled" ||
        b.status === "no_show" ||
        b.date < today
      );
    return true;
  });

  // ── Confirm ──────────────────────────────────────────────────────────────
  const handleConfirm = async (booking: Booking) => {
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "confirmed",
        confirmedAt: serverTimestamp(),
        confirmedBy: user?.uid,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Decline ───────────────────────────────────────────────────────────────
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

  // ── No-show ────────────────────────────────────────────────────────────────
  const handleNoShow = async (booking: Booking) => {
    if (
      !window.confirm(
        `Mark ${booking.patientName} as a no-show? This appointment will not be billed.`,
      )
    )
      return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "no_show",
        noShow: true,
        billable: false,
        noShowAt: serverTimestamp(),
        noShowBy: user?.uid,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reschedule ─────────────────────────────────────────────────────────────
  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    const booking = bookings.find((b) => b.id === rescheduleId);
    if (booking?.providerId !== providerProfile?.providerId) return;
    setActionLoading(rescheduleId);
    try {
      await updateDoc(doc(db, "bookings", rescheduleId), {
        status: "reschedule_pending",
        proposedDate: rescheduleDate,
        proposedTime: rescheduleTime,
        rescheduledAt: serverTimestamp(),
        rescheduledBy: user?.uid,
      });
      setRescheduleId(null);
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const pendingCount = bookings.filter(
    (b) => b.status === "pending" && b.date >= today,
  ).length;
  const confirmedCount = bookings.filter(
    (b) => b.status === "confirmed" && b.date >= today,
  ).length;
  const completedCount = bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const cancelledCount = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "no_show",
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
              <span className="font-display text-slate-900 text-lg">
                Morava
              </span>
              <span className="text-slate-400 text-sm ml-2">
                Provider Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {providerProfile && (
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-700">
                  {providerProfile.name}
                </div>
                <div className="text-xs text-slate-400">
                  {providerProfile.specialty}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Billing setup banner ────────────────────────────────────────── */}
        {!hasStripe && showBillingBanner && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-xl flex-shrink-0">💳</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-800 text-sm mb-1">
                Set up billing to stay active on Morava
              </div>
              <div className="text-amber-700 text-xs">
                Morava charges $6 per completed visit — only when a patient
                shows up. Add a card on file to keep your listing active when
                billing begins.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowBillingModal(true)}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Set up now
              </button>
              <button
                onClick={() => setShowBillingBanner(false)}
                className="text-amber-400 hover:text-amber-600 text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── Email notification banner ────────────────────────────────────── */}
        {showNotifBanner && (
          <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-teal-500 text-xl flex-shrink-0">📧</span>
            <div className="flex-1">
              <div className="font-semibold text-teal-800 text-sm mb-1">
                Booking alerts sent to your email
              </div>
              <div className="text-teal-700 text-xs">
                When a patient books, you'll receive an email at{" "}
                <strong>{user?.email}</strong> with a link to confirm.
              </div>
            </div>
            <button
              onClick={() => setShowNotifBanner(false)}
              className="text-teal-400 hover:text-teal-600 text-lg flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-slate-900 mb-1">
            Good {getTimeOfDay()},{" "}
            {providerProfile?.name?.split(" ")[0] || "Doctor"} 👋
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
            {
              label: "Pending",
              value: pendingCount,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Confirmed",
              value: confirmedCount,
              color: "text-teal-600",
              bg: "bg-teal-50",
            },
            {
              label: "Completed",
              value: completedCount,
              color: "text-slate-700",
              bg: "bg-slate-100",
            },
            {
              label: "Cancelled",
              value: cancelledCount,
              color: "text-red-600",
              bg: "bg-red-50",
            },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4`}>
              <div className={`font-display text-3xl ${color} mb-1`}>
                {value}
              </div>
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
            <h3 className="font-display text-xl text-slate-700 mb-2">
              No appointments found
            </h3>
            <p className="text-slate-400 text-sm">
              {filter === "upcoming"
                ? "New appointment requests will appear here."
                : "Try switching to a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => {
              const isPast = booking.date < today;
              const isToday = booking.date === today;
              const canNoShow =
                booking.status === "confirmed" && (isPast || isToday);
              const canCalendar =
                booking.status === "confirmed" ||
                booking.status === "reschedule_pending";

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-start gap-4"
                >
                  {/* Date block */}
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-xs text-slate-400 font-bold uppercase">
                      {formatWeekday(booking.date)}
                    </div>
                    <div className="font-display text-xl text-slate-900">
                      {formatMonthDay(booking.date)}
                    </div>
                    <div className="text-sm font-semibold text-teal-600">
                      {booking.time}
                    </div>
                  </div>
                  <div className="w-px h-12 bg-slate-100 hidden sm:block" />

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        {booking.patientName}
                      </span>
                      {booking.patientPhone && (
                        <a
                          href={`tel:${booking.patientPhone}`}
                          className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-medium hover:bg-teal-50 hover:text-teal-600 transition-colors"
                        >
                          📞 {booking.patientPhone}
                        </a>
                      )}
                      {booking.bookingFor === "dependent" &&
                        booking.isMinorPatient && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                            Minor
                          </span>
                        )}
                      {!booking.patientIntakeSummary && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                          ⚠ No intake form
                        </span>
                      )}
                    </div>
                    {booking.visitTypeLabel && (
                      <div className="text-sm text-slate-500">
                        🩺 {booking.visitTypeLabel}
                      </div>
                    )}
                    {booking.serviceCategoryLabel && (
                      <div className="text-sm text-teal-600">
                        › {booking.serviceCategoryLabel}
                      </div>
                    )}
                    {booking.reasonForVisit && (
                      <div className="text-xs text-slate-400 italic mt-1">
                        {booking.reasonForVisit}
                      </div>
                    )}

                    {/* Reschedule proposal */}
                    {booking.status === "reschedule_pending" &&
                      booking.proposedDate && (
                        <div className="mt-2 text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded-lg border border-purple-100">
                          ⟳ Reschedule proposed:{" "}
                          {formatDateLong(booking.proposedDate)} at{" "}
                          {booking.proposedTime}
                          <span className="text-purple-400 ml-1">
                            — awaiting patient approval
                          </span>
                        </div>
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
                              <span className="font-semibold text-slate-600">
                                Blood Type:
                              </span>{" "}
                              <span className="text-slate-800">
                                {booking.patientIntakeSummary.bloodType}
                              </span>
                            </div>
                          )}
                          {(() => {
                            const a = booking.patientIntakeSummary?.allergies;
                            const d = Array.isArray(a) ? a.join(", ") : a;
                            return d && d !== "None" ? (
                              <div className="text-xs">
                                <span className="font-semibold text-red-600">
                                  ⚠️ Allergies:
                                </span>{" "}
                                <span className="text-slate-800">{d}</span>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const m = booking.patientIntakeSummary?.medications;
                            const d = Array.isArray(m) ? m.join(", ") : m;
                            return d && d !== "None" ? (
                              <div className="text-xs">
                                <span className="font-semibold text-slate-600">
                                  💊 Medications:
                                </span>{" "}
                                <span className="text-slate-800">{d}</span>
                              </div>
                            ) : null;
                          })()}
                          {booking.patientIntakeSummary.emergencyContact
                            ?.name && (
                            <div className="text-xs">
                              <span className="font-semibold text-slate-600">
                                🆘 Emergency:
                              </span>{" "}
                              <span className="text-slate-800">
                                {
                                  booking.patientIntakeSummary.emergencyContact
                                    .name
                                }{" "}
                                —{" "}
                                {
                                  booking.patientIntakeSummary.emergencyContact
                                    .phone
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        📋 Patient has not completed intake form. Collect
                        medical history at visit.
                      </div>
                    )}

                    {booking.status === "cancelled" &&
                      booking.declineReason && (
                        <div className="text-xs text-red-400 mt-1">
                          Reason: {booking.declineReason}
                        </div>
                      )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLES[booking.status] || STATUS_STYLES.cancelled}`}
                    >
                      {STATUS_LABELS[booking.status] || booking.status}
                    </span>

                    {/* Pending actions */}
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
                          onClick={() => {
                            setDeclineId(booking.id);
                            setDeclineReason("");
                          }}
                          disabled={actionLoading === booking.id}
                          className="border border-slate-200 hover:border-red-200 hover:text-red-600 text-slate-500 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Confirmed actions */}
                    {(booking.status === "confirmed" ||
                      booking.status === "reschedule_pending") && (
                      <div className="flex gap-2 flex-wrap justify-end">
                        {booking.status === "confirmed" && !isPast && (
                          <button
                            onClick={() => {
                              setRescheduleId(booking.id);
                              setRescheduleDate("");
                              setRescheduleTime("");
                            }}
                            className="border border-slate-200 hover:border-purple-300 hover:text-purple-600 text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ⟳ Reschedule
                          </button>
                        )}
                        {canNoShow && (
                          <button
                            onClick={() => handleNoShow(booking)}
                            disabled={actionLoading === booking.id}
                            className="border border-slate-200 hover:border-orange-300 hover:text-orange-600 text-slate-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {actionLoading === booking.id ? "..." : "No-show"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* EHR Summary button — always visible */}
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => generateEHRPDF(booking)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-300 px-3 py-1.5 rounded-lg transition-colors bg-white hover:bg-teal-50"
                        title="Open and print patient summary PDF"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7,10 12,15 17,10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        EHR Summary
                      </button>

                      {canCalendar && (
                        <button
                          onClick={() => addToCalendar(booking)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors bg-white hover:bg-blue-50"
                          title="Add to Google Calendar, Apple Calendar, or Outlook"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          Add to calendar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Decline modal ──────────────────────────────────────────────────── */}
      {declineId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl text-slate-900 mb-2">
              Decline appointment
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Select a reason. The patient will be notified immediately.
            </p>
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
                  {declineReason === reason ? "● " : "○ "}
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeclineId(null);
                  setDeclineReason("");
                }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason || actionLoading === declineId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {actionLoading === declineId
                  ? "Declining..."
                  : "Decline appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule modal ────────────────────────────────────────────────── */}
      {rescheduleId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl text-slate-900 mb-2">
              Propose new date & time
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              The patient will receive a notification with your proposed time
              and can accept or decline.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={today}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  New Time
                </label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none"
                >
                  <option value="">Select a time...</option>
                  {generateTimeSlots().map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRescheduleId(null);
                  setRescheduleDate("");
                  setRescheduleTime("");
                }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={
                  !rescheduleDate ||
                  !rescheduleTime ||
                  actionLoading === rescheduleId
                }
                className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {actionLoading === rescheduleId
                  ? "Sending..."
                  : "Send to patient"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Billing setup modal ────────────────────────────────────────────── */}
      {showBillingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl text-slate-900 mb-2">
              Set up billing
            </h3>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
              Morava charges <strong>$6 per completed visit</strong> — billed
              automatically on the 1st of each month. You only pay when a
              patient shows up. No monthly fees.
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
              <div className="text-sm font-semibold text-teal-800 mb-1">
                How billing works
              </div>
              <ul className="text-xs text-teal-700 space-y-1">
                <li>→ Patient books and attends their appointment</li>
                <li>→ Morava logs the completed visit</li>
                <li>
                  → On the 1st of each month, your card is charged for all
                  completed visits
                </li>
                <li>→ No-shows and cancellations are never charged</li>
              </ul>
            </div>
            <p className="text-slate-500 text-sm mb-6">
              To add your card on file, email{" "}
              <a
                href="mailto:support@moravacare.com"
                className="text-teal-600 font-medium"
              >
                support@moravacare.com
              </a>{" "}
              and we'll set up your billing account within 24 hours.
            </p>
            <button
              onClick={() => setShowBillingModal(false)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
function formatWeekday(dateStr: string) {
  if (!dateStr?.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
  });
}
function formatMonthDay(dateStr: string) {
  if (!dateStr?.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h < 19; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const period = h < 12 ? "AM" : "PM";
      const min = m === 0 ? "00" : m.toString();
      slots.push(`${hour}:${min} ${period}`);
    }
  }
  return slots;
}
