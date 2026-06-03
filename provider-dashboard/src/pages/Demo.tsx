// ================================================================
// DEMO PAGE — moravacare.com/demo
//
// A fully self-contained, read-only preview of the provider
// dashboard. No Firebase reads or writes. Safe to share with
// prospective providers during rep outreach.
//
// Three profile types:
//   1. Medical  — Dr. Sarah Mitchell, Internal Medicine
//   2. DPC      — Sunrise Direct Primary Care, Dr. James Walker
//   3. Recovery — New Horizons Recovery Housing
//
// The DEMO MODE banner is persistent and cannot be dismissed.
// ================================================================

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ProviderType = "medical" | "dpc" | "recovery";
type DemoTab = "home" | "billing" | "profile" | "analytics";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MEDICAL = {
  name: "Dr. Sarah Mitchell",
  specialty: "Internal Medicine",
  city: "Oklahoma City, OK",
  plan: "Standard",
  acceptingNew: true,
  bio: "Board-certified internist with 14 years of experience. Specializes in preventive care, chronic disease management, and complex diagnoses. Fluent in English and Spanish.",
  services: ["Annual Physicals", "Chronic Disease Management", "Preventive Care", "Lab Work", "Referrals", "Telehealth"],
  phone: "(405) 555-0120",
  email: "smitchell@okcclinic.com",
  monthlyRevenue: "$2,350",
  stats: { total: 47, confirmed: 28, pending: 12, completed: 7 },
  bookings: [
    { patient: "James R.", date: "Today, 9:00 AM",  type: "Annual Physical",       status: "confirmed",  id: "BK-10041" },
    { patient: "Maria L.", date: "Today, 10:30 AM", type: "Follow-up",             status: "confirmed",  id: "BK-10042" },
    { patient: "David K.", date: "Today, 2:00 PM",  type: "New Patient Consult",   status: "pending",    id: "BK-10043" },
    { patient: "Susan T.", date: "Tomorrow, 9:00 AM",type: "Lab Results Review",   status: "confirmed",  id: "BK-10044" },
    { patient: "Carlos M.", date: "Tomorrow, 11:00 AM", type: "Chronic Care Mgmt", status: "pending",    id: "BK-10045" },
  ],
};

const DPC = {
  name: "Dr. James Walker",
  practice: "Sunrise Direct Primary Care",
  city: "Tulsa, OK",
  plan: "Pro",
  memberFee: "$149",
  hsaEligible: true,
  acceptingNew: true,
  bio: "Direct Primary Care physician focused on unhurried, relationship-based medicine. Members get same-day/next-day access, unlimited office visits, and 24/7 text/call access.",
  services: ["Unlimited Visits", "Same-Day Appointments", "24/7 Provider Access", "Annual Labs Included", "Telehealth", "Wholesale Medications"],
  phone: "(918) 555-0188",
  email: "drwalker@sunrisedpc.com",
  members: { active: 42, new: 5, mrr: "$6,258" },
  bookings: [
    { patient: "Angela P.", date: "Today, 8:00 AM",   type: "Acute Visit — Sinus", status: "confirmed", id: "BK-20011" },
    { patient: "Robert F.", date: "Today, 9:30 AM",   type: "Telehealth Check-in", status: "confirmed", id: "BK-20012" },
    { patient: "Lisa N.",   date: "Today, 3:00 PM",   type: "New Member Consult",  status: "pending",   id: "BK-20013" },
    { patient: "Marcus D.", date: "Tomorrow, 10:00 AM",type: "Annual Labs Review",  status: "confirmed", id: "BK-20014" },
  ],
};

const RECOVERY = {
  name: "Destiny Recovery Center",
  city: "Ardmore, OK",
  plan: "Growth",
  planPrice: "$49/month",
  gender: "Women",
  totalBeds: 12,
  availableBeds: 4,
  status: "limited",
  phone: "(580) 798-4421",
  email: "destinyrecoverycenterardmore@gmail.com",
  ownerName: "Lauren Vickers",
  description: "A 12-bed women's sober living facility in Ardmore, Oklahoma. Safe, structured environment for adult women committed to recovery. Peer support, accountability, and a community-centered approach to long-term sobriety.",
  amenities: ["Women-Only Facility", "Peer Support", "Structured Schedule", "Accountability Program", "Self-Pay & Sliding Scale", "Community-Centered Recovery"],
  inquiries: [
    { name: "Ashley M.",   date: "Today, 9:12 AM",   status: "new",       funding: "Self-Pay",            mat: false  },
    { name: "Brianna T.",  date: "Today, 7:30 AM",   status: "contacted", funding: "ODMHSAS Voucher",     mat: false  },
    { name: "Carla R.",    date: "Yesterday, 4:15 PM",status: "contacted", funding: "Medicaid/SoonerCare", mat: true   },
    { name: "Destiny W.",  date: "May 30",            status: "placed",    funding: "Self-Pay",            mat: false  },
    { name: "Erica N.",    date: "May 28",            status: "placed",    funding: "Private Insurance",   mat: false  },
  ],
};

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  confirmed:  "bg-teal-50 text-teal-700 border border-teal-200",
  pending:    "bg-amber-50 text-amber-700 border border-amber-200",
  completed:  "bg-slate-100 text-slate-600 border border-slate-200",
  new:        "bg-blue-50 text-blue-700 border border-blue-200",
  contacted:  "bg-amber-50 text-amber-700 border border-amber-200",
  placed:     "bg-green-50 text-green-700 border border-green-200",
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: "✓ Confirmed", pending: "⏳ Pending", completed: "✓ Completed",
  new: "New", contacted: "Contacted", placed: "Placed",
};

// ── Reusable UI ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "teal" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    teal:   "border-t-teal-500",
    amber:  "border-t-amber-400",
    slate:  "border-t-slate-400",
    green:  "border-t-green-500",
    blue:   "border-t-blue-500",
    purple: "border-t-purple-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-t-4 ${colors[color]} p-5`}>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="text-xs bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full font-medium ml-2">
      Demo — read only
    </span>
  );
}

// ── Home tabs ─────────────────────────────────────────────────────────────────
function MedicalHome() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Appointments this month" value={MEDICAL.stats.total}     color="teal"  />
        <StatCard label="Confirmed"               value={MEDICAL.stats.confirmed} color="green" />
        <StatCard label="Pending response"        value={MEDICAL.stats.pending}   color="amber" />
        <StatCard label="Completed"               value={MEDICAL.stats.completed} color="slate" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Upcoming Appointments</h3>
          <span className="text-xs text-slate-400">Next 48 hours</span>
        </div>
        {MEDICAL.bookings.map((b) => (
          <div key={b.id} className="border-b border-slate-50 last:border-0">
            <button
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
              onClick={() => setExpanded(expanded === b.id ? null : b.id)}
            >
              <div>
                <div className="font-medium text-slate-900 text-sm">{b.patient}</div>
                <div className="text-xs text-slate-500 mt-0.5">{b.date} · {b.type}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
                <span className="text-slate-300 text-xs">{expanded === b.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {expanded === b.id && (
              <div className="px-6 pb-4 bg-slate-50">
                <div className="flex flex-wrap gap-2 mt-1">
                  <button className="text-xs bg-white border border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 px-3 py-1.5 rounded-lg font-medium transition-colors" onClick={() => alert("Demo mode — no action taken")}>✓ Confirm</button>
                  <button className="text-xs bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors"  onClick={() => alert("Demo mode — no action taken")}>✕ Decline</button>
                  <button className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium" onClick={() => alert("Demo mode — no action taken")}>📋 View Patient Summary</button>
                  <button className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium" onClick={() => alert("Demo mode — no action taken")}>📝 Add Notes</button>
                  <button className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium" onClick={() => alert("Demo mode — no action taken")}>📅 Add to Calendar</button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Booking ID: {b.id}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-teal-600 text-lg">💰</span>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Revenue this month</div>
          <div className="text-2xl font-bold text-teal-600 mt-0.5">{MEDICAL.monthlyRevenue}</div>
          <div className="text-xs text-slate-500 mt-1">Based on completed appointments · updated daily</div>
        </div>
      </div>
    </div>
  );
}

function DPCHome() {
  // Stats mirror the real DPC dashboard: Morava tracks members/inquiries/consults
  // it facilitates — NOT the practice's revenue (Morava never touches membership dues).
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Members"       value={DPC.members.active} color="purple" sub="via Morava" />
        <StatCard label="Membership Inquiries" value={DPC.members.new}    color="amber"  sub="pending this month" />
        <StatCard label="Consults Held"        value={7}                  color="teal"   sub="this month" />
      </div>

      <div className="bg-teal-600 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-teal-100 font-medium">Your Membership Fee (you set this — you keep 100%)</div>
          <div className="text-4xl font-bold mt-1">{DPC.memberFee}<span className="text-xl text-teal-200 font-normal">/month</span></div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs bg-teal-500 border border-teal-400 text-white px-2.5 py-1 rounded-full font-medium">HSA Eligible ✓</span>
            <span className="text-xs bg-teal-500 border border-teal-400 text-white px-2.5 py-1 rounded-full font-medium">Accepting New Members ✓</span>
            <span className="text-xs bg-white text-teal-700 px-2.5 py-1 rounded-full font-medium">Free to list · pay only on enrollment</span>
          </div>
        </div>
        <button className="text-sm bg-white text-teal-700 font-semibold px-4 py-2 rounded-xl hover:bg-teal-50 transition-colors" onClick={() => alert("Demo mode")}>Edit Settings</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Membership Inquiries</h3>
        </div>
        {DPC.bookings.map((b) => (
          <div key={b.id} className="flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
            <div>
              <div className="font-medium text-slate-900 text-sm">{b.patient}</div>
              <div className="text-xs text-slate-500 mt-0.5">{b.date} · {b.type}</div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[b.status]}`}>
              {STATUS_LABELS[b.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecoveryHome() {
  const [beds, setBeds] = useState(RECOVERY.availableBeds);
  const [status, setStatus] = useState(RECOVERY.status);
  const statusMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
    available: { label: "Available",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-400" },
    limited:   { label: "Limited",    color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-400" },
    waitlist:  { label: "Waitlist",   color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-400" },
    full:      { label: "Full",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-400"   },
  };
  const sm = statusMeta[status];

  return (
    <div>
      {/* Availability panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Live Availability</h3>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${sm.color} ${sm.bg} ${sm.border}`}>
            {sm.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="text-center bg-slate-50 rounded-xl p-4">
            <div className="text-3xl font-bold text-slate-900">{beds}</div>
            <div className="text-xs text-slate-500 mt-1">Beds Available</div>
          </div>
          <div className="text-center bg-slate-50 rounded-xl p-4">
            <div className="text-3xl font-bold text-slate-900">{RECOVERY.totalBeds}</div>
            <div className="text-xs text-slate-500 mt-1">Total Capacity</div>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-sm font-medium text-slate-700 block mb-2">Available beds (demo — drag or edit)</label>
          <input
            type="range" min={0} max={RECOVERY.totalBeds} value={beds}
            onChange={(e) => setBeds(Number(e.target.value))}
            className="w-full accent-teal-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0</span><span>{RECOVERY.totalBeds}</span></div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">Status</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(statusMeta).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`text-sm font-medium py-2 px-3 rounded-xl border transition-all ${
                  status === key ? `${meta.color} ${meta.bg} ${meta.border} border-2` : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <button className="w-full mt-4 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm" onClick={() => alert("Demo mode — in the real dashboard this saves to Firestore instantly")}>
          Save Availability
        </button>
        <p className="text-xs text-center text-slate-400 mt-2">Changes appear live to patients within seconds</p>
      </div>

      {/* Inquiries */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Inquiry Inbox</h3>
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-semibold">
            {RECOVERY.inquiries.filter(i => i.status === "new").length} new
          </span>
        </div>
        {RECOVERY.inquiries.map((inq, i) => (
          <div key={i} className="px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-medium text-slate-900 text-sm">{inq.name}</div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[inq.status]}`}>
                {STATUS_LABELS[inq.status]}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-400">{inq.date}</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">💳 {inq.funding}</span>
              {inq.mat && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">💊 On MAT</span>}
              {!inq.mat && inq.status === "new" && <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">✓ No MAT</span>}
            </div>
            {inq.status === "new" && (
              <div className="flex gap-2 mt-2.5">
                <button className="text-xs bg-teal-500 hover:bg-teal-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors" onClick={() => alert("Demo mode — in your real dashboard this marks the inquiry as Contacted and logs the timestamp")}>
                  ✓ Mark Contacted
                </button>
                <button className="text-xs border border-slate-200 text-slate-500 hover:border-slate-300 font-medium px-3 py-1.5 rounded-lg" onClick={() => alert("Demo mode")}>
                  ✕ Not a fit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Billing tab ───────────────────────────────────────────────────────────────
function BillingTab({ type }: { type: ProviderType }) {
  if (type === "medical") {
    return (
      <div>
        <SectionTitle title="Billing & Plan" subtitle="Your current plan and payment history." />
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Current Plan</div>
              <div className="text-2xl font-bold text-slate-900">Standard</div>
              <div className="text-sm text-slate-500 mt-1">$49 / month · renews June 25, 2026</div>
            </div>
            <span className="bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold px-3 py-1 rounded-full">Active</span>
          </div>
          <hr className="my-5 border-slate-100" />
          <div className="grid sm:grid-cols-2 gap-4">
            {["Morava listing & patient bookings", "Appointment notifications (email + SMS)", "Patient intake forms", "Provider notes per visit", "Calendar export (.ics)", "Priority support"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-teal-500 shrink-0">✓</span> {f}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2 flex-wrap">
            <button className="text-sm bg-teal-500 hover:bg-teal-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors" onClick={() => alert("Demo mode")}>Upgrade to Pro</button>
            <button className="text-sm border border-slate-200 text-slate-600 hover:border-slate-300 font-medium px-4 py-2 rounded-xl" onClick={() => alert("Demo mode")}>Manage Payment Method</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-900">Invoice History</div>
          {[
            { date: "May 1, 2026",   amount: "$49.00", status: "Paid" },
            { date: "Apr 1, 2026",   amount: "$49.00", status: "Paid" },
            { date: "Mar 1, 2026",   amount: "$49.00", status: "Paid" },
          ].map((inv, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <div className="text-sm text-slate-700">{inv.date}</div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-900">{inv.amount}</span>
                <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{inv.status}</span>
                <button className="text-xs text-teal-600 hover:text-teal-700 font-medium" onClick={() => alert("Demo mode")}>Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "dpc") {
    return (
      <div>
        <SectionTitle title="Listing & Billing" subtitle="Free to list — you only pay when a patient enrolls." />
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Members"        value={42}       color="teal"   />
          <StatCard label="Enrolled via Morava"   value={3}        color="purple" sub="this month" />
          <StatCard label="Your Membership Fee"   value="$149"     color="green"  sub="you keep 100% ongoing" />
        </div>

        {/* Free listing hero */}
        <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-6 mb-6">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-extrabold text-teal-700">$0</span>
            <span className="text-slate-500 text-sm">to list · no monthly subscription</span>
          </div>
          <p className="text-sm text-slate-600">
            You only pay Morava a one-time finder's fee when a patient enrolls as a member —
            and only after both you and the patient confirm. No patients enrolled = no charge.
          </p>
        </div>

        {/* Enrollment fee + how it works */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <span className="text-sm font-bold text-slate-700">Your per-enrollment fee</span>
            <span className="text-2xl font-extrabold text-purple-700">$149<span className="text-sm font-medium text-slate-400"> / member</span></span>
          </div>
          <p className="text-xs text-slate-500 mb-4">One month of your $149 membership, capped at $150. Charged once when a member enrolls.</p>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-700 space-y-1.5">
            <p className="font-semibold text-purple-800 mb-1">How it works</p>
            <p>1. A patient finds you on Morava and submits a membership inquiry.</p>
            <p>2. When they enroll, you mark them "Enrolled as member" and they confirm in their app.</p>
            <p>3. Once both confirm, Morava bills the one-time $149 finder's fee — that's it.</p>
            <p>4. You keep 100% of every member's ongoing monthly dues. Morava never touches them.</p>
          </div>
        </div>

        {/* Recent enrollments */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-900">Enrollments This Month</div>
          {[
            { name: "Patricia G.", date: "Jun 1, 2026", status: "Billed $149", color: "green" },
            { name: "Marcus D.",   date: "May 28, 2026", status: "Billed $149", color: "green" },
            { name: "Tony R.",     date: "Today",         status: "Awaiting patient confirm", color: "amber" },
          ].map((e, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-800">{e.name}</div>
                <div className="text-xs text-slate-400">{e.date}</div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                e.color === "green"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>{e.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Recovery
  return (
    <div>
      <SectionTitle title="Listing & Billing" subtitle="Your current plan and upgrade options." />

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-teal-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Current Plan</div>
            <div className="text-2xl font-bold text-slate-900">Growth</div>
            <div className="text-sm text-slate-500 mt-1">$49 / month · renews July 1, 2026</div>
          </div>
          <span className="bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold px-3 py-1 rounded-full">Active</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {[
            "Priority placement — top of city results",
            "Verified badge on profile",
            "Up to 10 photos",
            "Inquiry inbox — patients apply in-app",
            "Patient status tracking & notifications",
            "Monthly inquiry report",
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-teal-500 shrink-0">✓</span> {f}
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2 flex-wrap">
          <button className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors" onClick={() => alert("Demo mode — contact support@moravacare.com to upgrade")}>
            Upgrade to Partner — $99/mo →
          </button>
          <button className="text-sm border border-slate-200 text-slate-600 hover:border-slate-300 font-medium px-4 py-2 rounded-xl" onClick={() => alert("Demo mode")}>
            Manage Payment
          </button>
        </div>
      </div>

      {/* Partner tier upsell */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-6">
        <div className="font-bold text-indigo-900 text-sm mb-3">Unlock Partner — $99/month</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            "Up to 3 facility locations under one login",
            "Featured placement on Find Care home screen",
            "ODMHSAS/grant documentation reports",
            "Referral source tracking",
            "Direct ODMHSAS voucher integration (coming soon)",
            "Early access to new features",
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-indigo-800">
              <span className="text-indigo-400">🔓</span> {f}
            </div>
          ))}
        </div>
        <button className="mt-4 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors" onClick={() => alert("Demo mode — email support@moravacare.com to upgrade")}>
          Upgrade to Partner →
        </button>
      </div>

      {/* Invoice history */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-900">Invoice History</div>
        {[
          { date: "Jun 1, 2026", amount: "$49.00", status: "Paid" },
          { date: "May 1, 2026", amount: "$49.00", status: "Paid" },
        ].map((inv, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
            <div className="text-sm text-slate-700">{inv.date}</div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-900">{inv.amount}</span>
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{inv.status}</span>
              <button className="text-xs text-teal-600 hover:text-teal-700 font-medium" onClick={() => alert("Demo mode")}>Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ type }: { type: ProviderType }) {
  const data = type === "dpc" ? DPC : type === "recovery" ? RECOVERY : MEDICAL;
  const services = "services" in data ? data.services : type === "recovery" ? RECOVERY.amenities : [];

  return (
    <div>
      <SectionTitle title="Provider Profile" subtitle={<span>How you appear in the Morava app. <ReadOnlyBadge /></span> as any} />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-600">
            {type === "recovery" ? "NH" : type === "dpc" ? "JW" : "SM"}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">
              {"practice" in data ? (data as typeof DPC).practice : data.name}
            </div>
            {"specialty" in data
              ? <div className="text-sm text-slate-500">{(data as typeof MEDICAL).specialty}</div>
              : "memberFee" in data
              ? <div className="text-sm text-teal-600 font-medium">Direct Primary Care · {(data as typeof DPC).memberFee}/mo</div>
              : <div className="text-sm text-slate-500">Recovery Housing · {(data as typeof RECOVERY).gender}</div>
            }
            <div className="text-xs text-slate-400 mt-0.5">📍 {data.city}</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Phone</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">{data.phone}</div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Email</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">{data.email}</div>
          </div>
        </div>

        {"bio" in data && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Bio</label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 leading-relaxed">
              {(data as any).bio ?? (data as any).description}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              {type === "recovery" ? "Amenities" : "Services"}
            </label>
            <div className="flex flex-wrap gap-2">
              {services.map((s: string) => (
                <span key={s} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${"acceptingNew" in data && (data as any).acceptingNew ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-100 text-slate-500"}`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            {"acceptingNew" in data && (data as any).acceptingNew ? "Accepting New Patients" : "Not Accepting"}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="text-sm bg-teal-500 hover:bg-teal-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors" onClick={() => alert("Demo mode — in the real dashboard, changes save instantly")}>Save Changes</button>
        <button className="text-sm border border-slate-200 text-slate-600 px-4 py-2 rounded-xl" onClick={() => alert("Demo mode")}>Preview Listing →</button>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
// Mirrors the REAL dashboard: analytics is "launching soon" for everyone — a
// blurred teaser, not a working chart. Locked plans see an upgrade nudge.
function AnalyticsTab({ type }: { type: ProviderType }) {
  // On the real dashboard, analytics is unlocked (but "soon") for DPC/Pro and
  // recovery Growth+; locked for everyone else.
  const unlocked = type === "dpc" || type === "recovery";

  if (!unlocked) {
    return (
      <div>
        <SectionTitle title="Analytics" />
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="filter blur-sm pointer-events-none select-none mb-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total visits", val: "47" },
                { label: "Avg per month", val: "8.2" },
                { label: "No-show rate", val: "12%" },
                { label: "Top insurance", val: "SoonerCare" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-slate-300 mb-1">{s.val}</div>
                  <div className="text-xs text-slate-200">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analytics on the Pro plan</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
            Upgrade to Pro to unlock booking trends, no-show rates, peak hours, and insurance breakdowns. Launching soon.
          </p>
          <button className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm" onClick={() => alert("Demo mode")}>
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  // Unlocked — but still "launching soon" (matches the real dashboard exactly)
  return (
    <div>
      <SectionTitle title="Analytics" subtitle="Booking trends, patient insights, and practice performance." />
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Analytics launching soon</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
          You'll be among the first to access {type === "dpc" ? "booking trends, membership conversion, and inquiry insights" : "listing views, inquiry trends, and placement rates"}. We'll notify you the moment it goes live.
        </p>
        <div className="max-w-2xl mx-auto">
          <div className="filter blur-sm pointer-events-none select-none bg-slate-50 rounded-xl p-6 border border-slate-200">
            <div className="flex items-end justify-center gap-3 h-24">
              {[4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 14].map((h, i) => (
                <div key={i} className="bg-teal-200 rounded-t" style={{ width: 20, height: `${h * 6}px` }} />
              ))}
            </div>
          </div>
          <div className="text-xs text-teal-600 mt-3 font-medium">
            📬 You'll be notified when analytics launches
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Demo component ───────────────────────────────────────────────────────
export default function Demo() {
  const [providerType, setProviderType] = useState<ProviderType>("medical");
  const [activeTab, setActiveTab] = useState<DemoTab>("home");

  const providerName = providerType === "medical"
    ? MEDICAL.name
    : providerType === "dpc"
    ? DPC.practice
    : RECOVERY.name;

  const providerSub = providerType === "medical"
    ? MEDICAL.specialty
    : providerType === "dpc"
    ? "Direct Primary Care · Tulsa, OK"
    : "Recovery Housing · Oklahoma City, OK";

  const tabs: { id: DemoTab; label: string; locked?: boolean }[] = providerType === "recovery"
    ? [
        { id: "home",      label: "Home"              },
        { id: "billing",   label: "Listing & Billing"  },
        { id: "profile",   label: "Facility Profile"   },
        { id: "analytics", label: "Analytics", locked: true },
      ]
    : [
        { id: "home",      label: "Home"      },
        { id: "billing",   label: "Billing"   },
        { id: "profile",   label: "Profile"   },
        { id: "analytics", label: "Analytics", locked: providerType !== "dpc" },
      ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── DEMO BANNER ── */}
      <div className="bg-amber-400 text-amber-900 text-center py-2.5 px-4 text-sm font-bold sticky top-0 z-50 flex items-center justify-center gap-2 shadow-sm">
        <span>🎭</span>
        <span>DEMO MODE — Read-only preview. No real data. Safe to explore.</span>
        <span>🎭</span>
      </div>

      {/* ── Top nav ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-10 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <div>
              <span className="text-slate-900 text-lg font-semibold">Morava</span>
              <span className="text-slate-400 text-sm ml-2">Provider Portal</span>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-slate-700">{providerName}</div>
            <div className="text-xs text-slate-400">{providerSub}</div>
          </div>
        </div>
      </nav>

      {/* ── Provider type switcher ── */}
      <div className="bg-white border-b border-slate-200 sticky top-26 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-1">Preview as:</span>
          {([
            { id: "medical",  label: "🩺 Medical Provider" },
            { id: "dpc",      label: "🤝 DPC Practice"     },
            { id: "recovery", label: "🏠 Recovery House"   },
          ] as { id: ProviderType; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setProviderType(id); setActiveTab("home"); }}
              className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-all ${
                providerType === id
                  ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub nav ── */}
      <div className="bg-white border-b border-slate-200 sticky top-40 z-20">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              {tab.label}
              {tab.locked && <span className="text-xs text-slate-300 ml-0.5">🔒</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === "home"      ? "Dashboard"
           : activeTab === "billing"   ? (providerType === "recovery" ? "Listing & Billing" : "Billing")
           : activeTab === "profile"   ? (providerType === "recovery" ? "Facility Profile" : "Profile")
           :                             "Analytics"}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {providerName} · {providerSub}
          </p>
        </div>

        {/* Tab content */}
        {activeTab === "home" && (
          providerType === "medical" ? <MedicalHome /> :
          providerType === "dpc"     ? <DPCHome />     :
                                       <RecoveryHome />
        )}
        {activeTab === "billing"   && <BillingTab  type={providerType} />}
        {activeTab === "profile"   && <ProfileTab  type={providerType} />}
        {activeTab === "analytics" && <AnalyticsTab type={providerType} />}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-200 bg-white mt-12 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            This is a <strong>demo environment</strong>. No real provider data is shown. Ready to enroll?
          </div>
          <a
            href="https://moravacare.com/reps"
            className="text-sm bg-teal-500 hover:bg-teal-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Submit a Provider →
          </a>
        </div>
      </div>
    </div>
  );
}
