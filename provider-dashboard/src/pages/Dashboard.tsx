import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import PlanStatusCard from "../components/PlanStatusCard";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import BillingSetup from "./BillingSetup";
import MFASetup from "./MFASetup";

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
  preRescheduleStatus?: string;
  // DPC dual-confirmation enrollment
  providerPracticeType?: string;
  providerMarkedEnrolled?: boolean;
  patientConfirmedEnrolled?: boolean;
  dpcEnrollmentFee?: number;
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

// ── HTML escape — prevents XSS when injecting user-supplied Firestore data ──
// Every field from patient/provider documents must pass through escHtml before
// being interpolated into the HTML template. This blocks stored-XSS attacks
// where a booking with <script>...</script> in any field would otherwise execute
// in the provider's browser when they open the EHR document.
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function generateEHRPDF(
  booking: Booking,
  auditInfo?: { providerId: string; providerName: string; userUid: string },
) {
  const intake = booking.patientIntakeSummary;
  const hasIntake = !!intake;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // fmt: formats + escapes every value before HTML interpolation
  const fmt = (val: string | string[] | undefined | null): string => {
    if (!val) return "Not provided";
    if (Array.isArray(val))
      return val.length > 0 ? val.map(escHtml).join(", ") : "Not provided";
    return escHtml(val) || "Not provided";
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Morava — Patient Summary — ${escHtml(booking.patientName)}</title>
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

  /* ── Session security bar ── */
  #ehr-session-bar { position: sticky; top: 0; z-index: 10000; background: #FEF3C7; border-bottom: 2px solid #F59E0B; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; font-family: Arial, sans-serif; gap: 12px; }
  #ehr-session-bar .bar-left { display: flex; align-items: center; gap: 10px; }
  #ehr-session-bar .bar-title { font-size: 10pt; font-weight: bold; color: #92400E; }
  #ehr-session-bar .bar-meta { font-size: 8.5pt; color: #B45309; margin-top: 2px; }
  #ehr-session-bar .bar-close { background: #F59E0B; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 9.5pt; font-weight: bold; cursor: pointer; white-space: nowrap; }
  #ehr-session-bar .countdown-badge { background: #FDE68A; border: 1px solid #F59E0B; border-radius: 20px; padding: 3px 10px; font-size: 9pt; font-weight: bold; color: #92400E; font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* ── Diagonal CONFIDENTIAL watermark — screen only ── */
  .phi-wm-wrap { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9990; overflow: hidden; }
  .phi-wm-layer { position: absolute; top: -60%; left: -60%; width: 220%; height: 300%; display: flex; flex-direction: column; gap: 90px; transform: rotate(-38deg); transform-origin: center; }
  .phi-wm-row { display: flex; gap: 80px; white-space: nowrap; }
  .phi-wm-text { font-size: 13px; font-weight: bold; color: rgba(0,0,0,0.042); letter-spacing: 4px; text-transform: uppercase; font-family: Arial, sans-serif; user-select: none; }

  @media print {
    #ehr-session-bar { display: none !important; }
    .phi-wm-wrap { display: none !important; }
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ── Diagonal CONFIDENTIAL watermark — hidden on print ── -->
<div class="phi-wm-wrap" aria-hidden="true">
  <div class="phi-wm-layer">
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
    ${"<div class=\"phi-wm-row\">" + Array(5).fill(`<span class="phi-wm-text">CONFIDENTIAL · PHI · ${escHtml(auditInfo?.providerName || "AUTHORIZED USE ONLY")}</span>`).join("") + "</div>"}
  </div>
</div>

<!-- ── PHI session bar — visible on screen, hidden on print ── -->
<div id="ehr-session-bar">
  <div class="bar-left">
    <span style="font-size:20px;">🔒</span>
    <div>
      <div class="bar-title">PHI Document — Authorized Personnel Only</div>
      <div class="bar-meta">Accessed by: ${escHtml(auditInfo?.providerName || "Provider")} &nbsp;·&nbsp; Patient: ${escHtml(booking.patientName)} &nbsp;·&nbsp; Session expires in <span id="ehr-countdown" class="countdown-badge">15:00</span></div>
    </div>
  </div>
  <button class="bar-close" onclick="window.close()">✕ Close</button>
</div>

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
      Booking ID: ${escHtml(booking.id)}
    </div>
  </div>
  <div class="teal-bar"></div>
  <div class="alert-red">⚠ HIPAA NOTICE: This document contains Protected Health Information (PHI). Authorized personnel only. Do not share without patient authorization.</div>
  ${!hasIntake ? `<div class="alert-amber">📋 INTAKE FORM NOT COMPLETED: Patient has not filled out a health profile. Basic booking information shown below. Collect full medical history at time of visit.</div>` : ""}
  <div class="section"><div class="section-title">📅 APPOINTMENT DETAILS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Booking ID</td><td class="field-value">${escHtml(booking.id)}</td></tr>
    <tr><td class="field-label">Requested Date</td><td class="field-value">${escHtml(formatDateLong(booking.date))}</td></tr>
    <tr><td class="field-label">Requested Time</td><td class="field-value">${escHtml(booking.time)}</td></tr>
    <tr><td class="field-label">Visit Type</td><td class="field-value">${escHtml(booking.visitTypeLabel || "Not specified")}</td></tr>
    <tr><td class="field-label">Reason for Visit</td><td class="field-value ${!booking.reasonForVisit ? "missing" : ""}">${escHtml(booking.reasonForVisit || "Not provided")}</td></tr>
    <tr><td class="field-label">Status</td><td class="field-value">${escHtml(booking.status.toUpperCase())}</td></tr>
    <tr><td class="field-label">Provider</td><td class="field-value">${escHtml(booking.providerName)}</td></tr>
  </table>
  <div class="section"><div class="section-title">👤 PATIENT DEMOGRAPHICS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Full Name</td><td class="field-value">${escHtml(booking.patientName)}</td></tr>
    <tr><td class="field-label">Contact Phone</td><td class="field-value ${!booking.patientPhone ? "missing" : ""}">${escHtml(booking.patientPhone || "Not provided")}</td></tr>
    <tr><td class="field-label">Booking For</td><td class="field-value">${booking.bookingFor === "dependent" ? "Dependent / Family Member" : "Account Holder"}</td></tr>
    ${booking.isMinorPatient ? `<tr><td class="field-label">Minor Patient</td><td class="field-value">Yes</td></tr>` : ""}
    ${booking.guardianName ? `<tr><td class="field-label">Guardian</td><td class="field-value">${escHtml(booking.guardianName)} — ${escHtml(booking.guardianPhone || "")}</td></tr>` : ""}
    <tr><td class="field-label">Insurance</td><td class="field-value ${fmt(intake?.insurance) === "Not provided" ? "missing" : ""}">${fmt(intake?.insurance)}</td></tr>
    <tr><td class="field-label">Primary Care Provider</td><td class="field-value ${!intake?.primaryCareProvider ? "missing" : ""}">${escHtml(intake?.primaryCareProvider || "Not provided")}</td></tr>
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
      ? `<div class="tags">${(Array.isArray(intake.conditions) ? intake.conditions : [intake.conditions]).map((c) => `<span class="tag">${escHtml(c)}</span>`).join("")}</div>`
      : `<div class="alert-gray">No conditions reported.</div>`
  }
  ${
    intake?.surgeries && fmt(intake.surgeries) !== "Not provided"
      ? `<div class="tags">${(Array.isArray(intake.surgeries) ? intake.surgeries : [intake.surgeries]).map((s) => `<span class="tag">${escHtml(s)}</span>`).join("")}</div>`
      : ""
  }
  <div class="section"><div class="section-title">📊 VITALS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Blood Type</td><td class="field-value ${!intake?.bloodType ? "missing" : ""}">${escHtml(intake?.bloodType || "Not provided")}</td></tr>
    <tr><td class="field-label">Height</td><td class="field-value ${!intake?.height ? "missing" : ""}">${escHtml(intake?.height || "Not provided")}</td></tr>
    <tr><td class="field-label">Weight</td><td class="field-value ${!intake?.weight ? "missing" : ""}">${escHtml(intake?.weight || "Not provided")}</td></tr>
  </table>
  <div class="section"><div class="section-title">🆘 EMERGENCY CONTACTS</div></div>
  <table class="field-table">
    <tr><td class="field-label">Primary</td><td class="field-value ${!intake?.emergencyContact?.name ? "missing" : ""}">${intake?.emergencyContact ? `${escHtml(intake.emergencyContact.name)} — ${escHtml(intake.emergencyContact.phone)} (${escHtml(intake.emergencyContact.relation)})` : "Not provided"}</td></tr>
    ${intake?.emergencyContact2?.name ? `<tr><td class="field-label">Secondary</td><td class="field-value">${escHtml(intake.emergencyContact2.name)} — ${escHtml(intake.emergencyContact2.phone)} (${escHtml(intake.emergencyContact2.relation)})</td></tr>` : ""}
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
  // ── Auto-close session timer: 15 minutes ──────────────────────────────
  var EHR_SECS = 15 * 60;
  var ehrLeft = EHR_SECS;
  var ehrTimer = setInterval(function() {
    ehrLeft--;
    var m = Math.floor(ehrLeft / 60);
    var s = ehrLeft % 60;
    var el = document.getElementById('ehr-countdown');
    if (el) {
      el.textContent = m + ':' + (s < 10 ? '0' + s : s);
      if (ehrLeft <= 60) { el.style.background = '#FEE2E2'; el.style.borderColor = '#EF4444'; el.style.color = '#991B1B'; }
    }
    if (ehrLeft <= 0) {
      clearInterval(ehrTimer);
      var bar = document.getElementById('ehr-session-bar');
      if (bar) bar.style.background = '#FEE2E2';
      setTimeout(function() { window.close(); }, 2000);
    }
  }, 1000);

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

  // ── Audit log — fire-and-forget, non-blocking ─────────────────────────────
  // HIPAA §164.312(b): audit controls require recording who accessed PHI and when.
  // PHI minimization: we log the booking ID (targetId) and provider UID — NOT
  // the patient name. The patient identity is derivable from the booking ID
  // on demand without embedding it in every audit record.
  if (auditInfo?.userUid) {
    addDoc(collection(db, "auditLog"), {
      action:          "ehr_pdf_opened",
      targetId:        booking.id,          // booking ID only — no patient name
      providerId:      auditInfo.providerId,
      accessedByUid:   auditInfo.userUid,
      accessedAt:      serverTimestamp(),
      visitDate:       booking.date,        // non-identifying scheduling metadata
    }).catch(() => {/* non-blocking — audit failure must not block clinical workflow */});
  }
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
  const { user, providerProfile, profileLoading, logout, isMFAEnrolled, refreshProfile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all" | "past">("upcoming");

  // Decline
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineNote, setDeclineNote] = useState("");

  // Reschedule
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // No-show confirmation modal
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Billing
  const [showBillingBanner, setShowBillingBanner] = useState(true);
  const [showBillingModal, setShowBillingModal] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(true);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaBannerDismissed, setMfaBannerDismissed] = useState(false);

  // ── Provider pre-visit notes (HIPAA-safe subcollection) ───────────────────
  // Notes live in /bookings/{id}/providerNotes/{noteId} — NEVER on the booking
  // doc itself, so patients can never read them regardless of UI.
  // Firestore rules allow only isBookingProvider() + admin on this subcollection.
  interface ProviderNote { id: string; text: string; createdAt: Date | null; }
  const [notesBookingId,  setNotesBookingId]  = useState<string | null>(null);
  const [notesList,       setNotesList]       = useState<ProviderNote[]>([]);
  const [notesLoading,    setNotesLoading]    = useState(false);
  const [newNoteText,     setNewNoteText]     = useState("");
  const [noteSaving,      setNoteSaving]      = useState(false);
  const [noteDeleteId,    setNoteDeleteId]    = useState<string | null>(null);

  const openNotes = async (bookingId: string) => {
    setNotesBookingId(bookingId);
    setNotesList([]);
    setNewNoteText("");
    setNotesLoading(true);
    try {
      // No orderBy — avoids index-not-ready failures on new subcollections.
      // Sort client-side after fetch; note counts per booking are tiny (<50).
      const snap = await getDocs(
        collection(db, "bookings", bookingId, "providerNotes"),
      );
      const notes = snap.docs
        .map(d => ({
          id: d.id,
          text: d.data().text as string,
          createdAt: d.data().createdAt?.toDate?.() ?? null,
        }))
        .sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      setNotesList(notes);
    } catch (err) {
      console.error("openNotes fetch failed:", err);
      showToast("Could not load notes. Please try again.", "error");
    } finally {
      setNotesLoading(false);
    }
  };

  const saveNote = async () => {
    if (!notesBookingId || !newNoteText.trim()) return;
    setNoteSaving(true);
    try {
      const ref = await addDoc(
        collection(db, "bookings", notesBookingId, "providerNotes"),
        {
          text:        newNoteText.trim().slice(0, 2000), // server-side cap
          createdAt:   serverTimestamp(),
          authorUid:   user?.uid,
          providerId:  providerProfile?.providerId,
        }
      );
      setNotesList(prev => [...prev, {
        id: ref.id,
        text: newNoteText.trim(),
        createdAt: new Date(),
      }]);
      setNewNoteText("");
    } catch {
      showToast("Failed to save note. Please try again.", "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!notesBookingId) return;
    setNoteDeleteId(noteId);
    try {
      await deleteDoc(doc(db, "bookings", notesBookingId, "providerNotes", noteId));
      setNotesList(prev => prev.filter(n => n.id !== noteId));
    } catch {
      showToast("Failed to delete note.", "error");
    } finally {
      setNoteDeleteId(null);
    }
  };

  // If profile loaded but providerId is missing the account isn't fully set up yet
  const accountIncomplete = providerProfile !== null && !providerProfile.providerId;

  useEffect(() => {
    // Profile finished loading but no valid provider account — stop spinner now.
    // Without this guard, providerProfile === null causes loading to spin forever
    // because the onSnapshot block is never reached (providerProfile?.providerId is undefined).
    if (!profileLoading && (providerProfile === null || !providerProfile.providerId)) {
      setLoading(false);
      return;
    }
    if (!providerProfile?.providerId) return; // profile still in-flight
    const q = query(
      collection(db, "bookings"),
      where("providerId", "==", providerProfile.providerId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
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
      },
      (err) => {
        // Permission-denied errors here usually mean the auth token doesn't yet
        // contain the provider custom claims (token refresh is async). The page
        // will re-query automatically when providerProfile reloads, but we clear
        // the loading state so the UI doesn't spin forever.
        console.error("Bookings query error:", err.code, err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [providerProfile?.providerId, profileLoading]);

  const today = new Date().toISOString().split("T")[0];
  // stripeCustomerId = Stripe customer record exists, NOT a saved card.
  // Card is confirmed only when the webhook writes stripePaymentMethodId.
  const hasStripe = !!(
    providerProfile?.stripePaymentMethodId ||
    providerProfile?.manualBilling
  );

  // Billing countdown — always show when no payment method is on file.
  // Days 1-7: amber countdown banner (dismissible), so they know exactly how
  // long they have. Day 8+: red urgent banner that cannot be dismissed.
  const billingDaysRemaining = (() => {
    const raw = providerProfile?.createdAt as any;
    if (!raw) return 0; // no timestamp = old account, overdue
    const ms = typeof raw?.toDate === "function"
      ? raw.toDate().getTime()
      : new Date(raw).getTime();
    if (isNaN(ms)) return 0;
    return Math.max(0, 7 - Math.floor((Date.now() - ms) / 86_400_000));
  })();
  // Only show the billing warning when a real provider account is fully loaded.
  // If providerProfile is null (account not in Firestore) or providerId is
  // empty (account incomplete), clicking "Set up now" would silently do nothing
  // because the modal guard requires providerProfile to be truthy.
  const showBillingWarning = !hasStripe && !!providerProfile?.providerId;

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
      showToast(`✅ Confirmed — ${booking.patientName} has been notified`);
    } catch (e) {
      console.error(e);
      showToast("Failed to confirm booking. Please try again.", "error");
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
        declineReason: declineReason === "Other — please call our office" && declineNote.trim()
          ? `Other — please call our office: ${declineNote.trim()}`
          : declineReason,
      });
      setDeclineId(null);
      setDeclineReason("");
      setDeclineNote("");
      showToast("Booking declined — patient has been notified");
    } catch (e) {
      console.error(e);
      showToast("Failed to decline. Please try again.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── No-show ────────────────────────────────────────────────────────────────
  const handleNoShow = async (booking: Booking) => {
    setNoShowBooking(null);
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "no_show",
        noShow: true,
        billable: false,
        noShowAt: serverTimestamp(),
        noShowBy: user?.uid,
      });
      showToast(`${booking.patientName} marked as no-show — not billed`);
    } catch (e) {
      console.error(e);
      showToast("Failed to mark no-show. Please try again.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Mark complete (patient arrived, visit done) ────────────────────────────
  const handleMarkComplete = async (booking: Booking) => {
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "completed",
        completedAt: serverTimestamp(),
        completedBy: user?.uid,
      });
      showToast(`✓ ${booking.patientName}'s visit marked as complete`);
    } catch (e) {
      console.error(e);
      showToast("Failed to mark complete. Please try again.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── DPC: mark patient enrolled as a member ───────────────────────────────────
  // Sets the provider-side flag. The fee is only logged once the patient ALSO
  // confirms in their app (dual confirmation, enforced by the Cloud Function).
  const handleMarkEnrolled = async (booking: Booking) => {
    if (booking.providerId !== providerProfile?.providerId) return;
    setActionLoading(booking.id);
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        providerMarkedEnrolled: true,
        providerEnrolledAt: serverTimestamp(),
      });
      showToast(
        booking.patientConfirmedEnrolled
          ? `✓ ${booking.patientName} enrolled — finder's fee will be billed this month`
          : `✓ Marked enrolled — waiting on ${booking.patientName} to confirm in their app`,
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to update. Please try again.", "error");
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
        // Save current status so patient decline can revert correctly:
        // pending → patient declines → reverts to pending (not confirmed)
        preRescheduleStatus: booking.status,
        proposedDate: rescheduleDate,
        proposedTime: rescheduleTime,
        rescheduledAt: serverTimestamp(),
        rescheduledBy: user?.uid,
      });
      setRescheduleId(null);
      setRescheduleDate("");
      setRescheduleTime("");
      showToast("📅 Reschedule proposed — patient will be notified to accept or decline");
    } catch (e) {
      console.error(e);
      showToast("Failed to propose reschedule. Please try again.", "error");
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const visitsThisMonth = bookings.filter(
    (b) => b.status === "completed" && b.date?.startsWith(currentMonth),
  ).length;

  // ── DPC membership stats (only meaningful for DPC providers) ─────────────
  // In DPC every booking is a membership touchpoint — no per-visit billing.
  // "Active members" = patients with at least one confirmed or completed booking.
  // "New inquiries"  = pending membership consult requests not yet acted on.
  // "Consults held"  = completed membership consult bookings this month.
  const isDPCProvider = providerProfile?.practiceType === "dpc";
  const dpcActiveMembers = isDPCProvider
    ? new Set(
        bookings
          .filter(b => b.status === "confirmed" || b.status === "completed")
          .map(b => b.userId)
      ).size
    : 0;
  const dpcNewInquiries = isDPCProvider
    ? bookings.filter(b => b.status === "pending" && b.date >= today).length
    : 0;
  const dpcConsultsThisMonth = isDPCProvider
    ? bookings.filter(b => b.status === "completed" && b.date?.startsWith(currentMonth)).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
          toast.type === "error"
            ? "bg-red-600 text-white"
            : "bg-slate-900 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── No-show confirmation modal ───────────────────────────────────── */}
      {noShowBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚫</span>
            </div>
            <h3 className="font-display text-lg text-slate-900 text-center mb-2">
              Mark as no-show?
            </h3>
            <p className="text-slate-500 text-sm text-center mb-1">
              <span className="font-semibold text-slate-700">{noShowBooking.patientName}</span> — {noShowBooking.date} at {noShowBooking.time}
            </p>
            <p className="text-slate-400 text-xs text-center mb-6">
              This visit will not be billed. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setNoShowBooking(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleNoShow(noShowBooking)}
                disabled={actionLoading === noShowBooking.id}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {actionLoading === noShowBooking.id ? "Saving…" : "Confirm no-show"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">
                    {providerProfile.specialty}
                  </span>
                  {providerProfile.practiceType === "dpc" && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded">
                      DPC
                    </span>
                  )}
                </div>
              </div>
            )}
            <a
              href="/profile"
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Edit Profile
            </a>
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

      <NavBar />

      {/* ── Prominent pending appointment banner — full-width, above the fold ── */}
      {!loading && pendingCount > 0 && (
        <div className="bg-amber-500 text-white px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 w-8 h-8 bg-white/25 rounded-full flex items-center justify-center font-bold text-sm">
                {pendingCount}
              </span>
              <p className="text-sm font-semibold leading-tight">
                {pendingCount === 1
                  ? "1 new appointment request is waiting for your confirmation"
                  : `${pendingCount} new appointment requests are waiting for your confirmation`}
              </p>
            </div>
            <button
              onClick={() => setFilter("upcoming")}
              className="flex-shrink-0 bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              Review now ↓
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── 2FA setup banner ────────────────────────────────────────────── */}
        {!isMFAEnrolled && !mfaBannerDismissed && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-blue-500 text-xl flex-shrink-0">🔐</span>
            <div className="flex-1">
              <div className="font-semibold text-blue-800 text-sm mb-1">
                Enable two-factor authentication
              </div>
              <div className="text-blue-700 text-xs">
                Protect your account and unlock billing setup. Takes 60 seconds
                — you'll need your phone.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowMFASetup(true)}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Enable now
              </button>
              <button
                onClick={() => setMfaBannerDismissed(true)}
                className="text-blue-400 hover:text-blue-600 text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── Billing setup banner ─────────────────────────────────────────
             Always visible when no payment method on file.
             Days 1–7: amber countdown, dismissible.
             Day 8+:   red urgent, NOT dismissible.
             DPC and regular providers get matching but type-specific copy. */}
        {showBillingWarning && showBillingBanner && (
          <div className={`mb-4 border rounded-xl p-4 flex items-start gap-3 ${
            billingDaysRemaining > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-300"
          }`}>
            <span className={`text-xl flex-shrink-0 ${
              billingDaysRemaining > 0 ? "text-amber-500" : "text-red-500"
            }`}>
              {billingDaysRemaining > 0 ? "⏰" : "🚨"}
            </span>
            <div className="flex-1">
              <div className={`font-semibold text-sm mb-1 ${
                billingDaysRemaining > 0 ? "text-amber-800" : "text-red-800"
              }`}>
                {billingDaysRemaining > 0
                  ? `${billingDaysRemaining} day${billingDaysRemaining !== 1 ? "s" : ""} left — add a payment method`
                  : "Action required — add a payment method to stay active"}
              </div>
              <div className={`text-xs ${
                billingDaysRemaining > 0 ? "text-amber-700" : "text-red-700"
              }`}>
                {isDPCProvider ? (
                  <>
                    Your DPC listing is billed a flat monthly fee based on your
                    tier. Add a card so your listing stays visible to patients
                    searching for direct primary care.
                  </>
                ) : providerProfile?.plan === "founding" ? (
                  <>
                    Your Founding rate is locked at{" "}
                    <strong>$6 per completed visit</strong> for 2 years.
                    Add a card before your first completed visit is billed.
                  </>
                ) : (
                  <>
                    You pay <strong>$10 per completed visit</strong>. Add a card
                    before your first completed visit is billed.
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowBillingModal(true)}
                className={`text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors ${
                  billingDaysRemaining > 0
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                Set up now
              </button>
              {/* Only dismissible during the grace window */}
              {billingDaysRemaining > 0 && (
                <button
                  onClick={() => setShowBillingBanner(false)}
                  className="text-amber-400 hover:text-amber-600 text-lg"
                >
                  ✕
                </button>
              )}
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

        {/* ── Plan status card ────────────────────────────────────────── */}
        <PlanStatusCard visitsThisMonth={visitsThisMonth} />

        {/* ── DPC membership panel (DPC providers only) ───────────────── */}
        {isDPCProvider && (
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🏥</span>
              <h3 className="font-bold text-slate-800 text-sm">Direct Primary Care — Panel Overview</h3>
              <span className="ml-auto text-xs text-slate-400">This month</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-violet-100 text-center">
                <div className="font-display text-3xl text-violet-600 mb-1">{dpcActiveMembers}</div>
                <div className="text-xs text-slate-500 font-medium">Active Members</div>
                <div className="text-xs text-slate-400 mt-0.5">confirmed or seen</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100 text-center">
                <div className="font-display text-3xl text-amber-500 mb-1">{dpcNewInquiries}</div>
                <div className="text-xs text-slate-500 font-medium">New Inquiries</div>
                <div className="text-xs text-slate-400 mt-0.5">awaiting response</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-teal-100 text-center">
                <div className="font-display text-3xl text-teal-600 mb-1">{dpcConsultsThisMonth}</div>
                <div className="text-xs text-slate-500 font-medium">Visits This Month</div>
                <div className="text-xs text-slate-400 mt-0.5">all covered by membership</div>
              </div>
            </div>
            {dpcNewInquiries > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                ⚡ {dpcNewInquiries} membership {dpcNewInquiries === 1 ? "inquiry" : "inquiries"} pending — confirm or decline above to manage your panel.
              </p>
            )}
          </div>
        )}

        {/* ── Filter tabs ─────────────────────────────────────────────── */}
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
        {accountIncomplete ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="font-semibold text-xl text-amber-900 mb-2">Account setup in progress</h3>
            <p className="text-amber-700 text-sm max-w-sm mx-auto">
              Your provider profile hasn't been fully linked yet. Contact{" "}
              <a href="mailto:support@moravacare.com" className="underline font-medium">
                support@moravacare.com
              </a>{" "}
              and we'll complete your setup within one business day.
            </p>
          </div>
        ) : loading ? (
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

                    {/* Reschedule proposal — awaiting patient response */}
                    {booking.status === "reschedule_pending" &&
                      booking.proposedDate && (
                        <div className="mt-2 text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded-lg border border-purple-100">
                          ⟳ Reschedule proposed:{" "}
                          {formatDateLong(booking.proposedDate)} at{" "}
                          {booking.proposedTime}
                          <span className="text-purple-400 ml-1">
                            — awaiting patient response
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
                      <div className="flex gap-2 flex-wrap justify-end">
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
                        <button
                          onClick={() => {
                            setRescheduleId(booking.id);
                            setRescheduleDate("");
                            setRescheduleTime("");
                          }}
                          disabled={actionLoading === booking.id}
                          className="border border-slate-200 hover:border-purple-300 hover:text-purple-600 text-slate-500 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                          title="Propose a different date & time"
                        >
                          ⟳ Reschedule
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
                          <>
                            <button
                              onClick={() => handleMarkComplete(booking)}
                              disabled={actionLoading === booking.id}
                              className="border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 text-slate-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              title="Patient arrived and visit completed"
                            >
                              {actionLoading === booking.id ? "..." : "✓ Complete"}
                            </button>
                            <button
                              onClick={() => setNoShowBooking(booking)}
                              disabled={actionLoading === booking.id}
                              className="border border-slate-200 hover:border-orange-300 hover:text-orange-600 text-slate-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {actionLoading === booking.id ? "..." : "No-show"}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* DPC enrollment — dual confirmation. Shown for DPC inquiries
                        once confirmed/completed and not already fee-logged. */}
                    {booking.providerPracticeType === "dpc" &&
                      (booking.status === "confirmed" || booking.status === "completed") &&
                      !booking.dpcEnrollmentFee && (
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mt-1">
                        {booking.providerMarkedEnrolled ? (
                          <div className="flex items-center gap-2 text-xs text-purple-700">
                            <span className="font-semibold">✓ You marked this patient enrolled.</span>
                            {booking.patientConfirmedEnrolled
                              ? <span>Patient confirmed — finder's fee bills this month.</span>
                              : <span className="text-purple-500">Waiting on patient to confirm in their app.</span>}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-xs text-purple-700">
                              <span className="font-semibold">Did this patient enroll as a member?</span>
                              <div className="text-purple-500 mt-0.5">A one-time finder's fee applies only after you and the patient both confirm.</div>
                            </div>
                            <button
                              onClick={() => handleMarkEnrolled(booking)}
                              disabled={actionLoading === booking.id}
                              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {actionLoading === booking.id ? "..." : "Mark as Enrolled Member"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {booking.providerPracticeType === "dpc" && booking.dpcEnrollmentFee && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-1 text-xs text-green-700">
                        ✓ Enrolled member — ${booking.dpcEnrollmentFee} finder's fee logged for this month's billing.
                      </div>
                    )}

                    {/* EHR Summary button + Provider Notes — always visible */}
                    <div className="flex gap-2 flex-wrap justify-end">
                      {/* Provider-only pre-visit notes — stored in a subcollection
                          that patients can never access (enforced in Firestore rules) */}
                      <button
                        onClick={() => openNotes(booking.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors bg-white hover:bg-indigo-50"
                        title="Private provider notes — never visible to patients"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Notes
                      </button>
                      <button
                        onClick={() => generateEHRPDF(booking, {
                          providerId: providerProfile?.providerId || "",
                          providerName: providerProfile?.name || "",
                          userUid: user?.uid || "",
                        })}
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
            <div className="space-y-2 mb-4">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setDeclineReason(reason);
                    if (reason !== "Other — please call our office") setDeclineNote("");
                  }}
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
            {declineReason === "Other — please call our office" && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Additional details <span className="text-slate-400 font-normal normal-case">(optional — visible to patient)</span>
                </label>
                <textarea
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="e.g. Please call our office at (405) 555-0100 to reschedule..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <div className="text-xs text-slate-400 mt-1 text-right">{declineNote.length}/200</div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeclineId(null);
                  setDeclineReason("");
                  setDeclineNote("");
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
        providerProfile?.providerId ? (
          <BillingSetup
            providerId={providerProfile.providerId}
            providerName={providerProfile.name}
            isFoundingProvider={providerProfile?.plan === "founding"}
            isDPC={isDPCProvider}
            dpcPlan={providerProfile?.plan}
            onClose={() => setShowBillingModal(false)}
            onSuccess={() => {
              setShowBillingModal(false);
              setShowBillingBanner(false);
              refreshProfile();
            }}
          />
        ) : (
          // Fallback: account not fully provisioned
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Account setup incomplete</h3>
              <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Your provider account hasn't been fully linked yet. Billing setup
                will be available once the Morava team activates your account —
                usually within 1 business day.
              </p>
              <p className="text-xs text-slate-400 mb-5">
                Email{" "}
                <a href="mailto:support@moravacare.com" className="text-teal-600 underline">
                  support@moravacare.com
                </a>
                {" "}to complete setup.
              </p>
              <button
                onClick={() => setShowBillingModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )
      )}
      {/* ── 2FA Setup Modal ──────────────────────────────────────────────── */}
      {showMFASetup && (
        <MFASetup
          onClose={() => setShowMFASetup(false)}
          onEnrolled={() => setShowMFASetup(false)}
        />
      )}

      {/* ── Provider Notes Modal ─────────────────────────────────────────────
           HIPAA design: notes are stored in /bookings/{id}/providerNotes subcollection.
           Firestore rules grant read/write ONLY to isBookingProvider() and admin.
           Patients never see these — the subcollection is inaccessible to them
           at both the rules level and the UI level. Notes are never shown in the
           patient app, never included in SMS, and never logged with patient name. */}
      {notesBookingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Pre-visit Notes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">🔒 Provider only · Never visible to patient</p>
                </div>
              </div>
              <button
                onClick={() => setNotesBookingId(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
              {notesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notesList.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">
                  No notes yet. Add a note below to prepare for this visit.
                </p>
              ) : (
                notesList.map(note => (
                  <div key={note.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 group">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {note.createdAt
                          ? note.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Just now"}
                      </span>
                      <button
                        onClick={() => deleteNote(note.id)}
                        disabled={noteDeleteId === note.id}
                        className="text-xs text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete note"
                      >
                        {noteDeleteId === note.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New note input */}
            <div className="px-6 py-4 border-t border-slate-100 space-y-3">
              <textarea
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value.slice(0, 2000))}
                placeholder="Add a private note (e.g. patient may be anxious, review medication list)…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{newNoteText.length}/2000</span>
                <button
                  onClick={saveNote}
                  disabled={noteSaving || !newNoteText.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                >
                  {noteSaving ? "Saving…" : "Add note"}
                </button>
              </div>
            </div>
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
