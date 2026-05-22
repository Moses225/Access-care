// ================================================================
// RECOVERY BILLING — Three-tier listing page
// provider-dashboard/src/pages/RecoveryBilling.tsx
//
// Free / Standard ($80) / Growth ($159) tiers.
// No auto-charging — upgrades are handled by contacting Morava.
// Upgrade CTA: email with subject pre-filled.
// ================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";

const PLANS = {
  free:     { label: "Free",     price: 0,   per: "forever" },
  standard: { label: "Standard", price: 80,  per: "/ month" },
  growth:   { label: "Growth",   price: 159, per: "/ month" },
} as const;

type Plan = keyof typeof PLANS;

// ── Feature matrix ────────────────────────────────────────────────────────────
// Each row: [label, free, standard, growth]
// true = included, false = not included, "soon" = coming soon
type Cell = boolean | "soon";

const FEATURES: { section: string; rows: [string, Cell, Cell, Cell][] }[] = [
  {
    section: "Listing Visibility",
    rows: [
      ["Listed in Morava patient search",            true,   true,  true ],
      ["Name, city, phone displayed",                true,   true,  true ],
      ["Availability status (available / full)",     true,   true,  true ],
      ["Full profile — photos, description, certs",  false,  true,  true ],
      ["Real-time exact bed counts",                 false,  true,  true ],
      ["Priority placement in search results",       false,  true,  true ],
      ["Featured placement — top of search",         false,  false, true ],
      ["ODMHSAS / OKARR certification badges",       false,  true,  true ],
    ],
  },
  {
    section: "Patient Contact",
    rows: [
      ["Phone number displayed",                     true,   true,  true ],
      ["Email contact requests from patients",       false,  true,  true ],
      ["Intake inquiry form — patients apply online",false, "soon","soon"],
      ["Waitlist management",                        false,  false, true ],
    ],
  },
  {
    section: "Analytics & Insights",
    rows: [
      ["Listing views (30-day)",                     false, "soon","soon"],
      ["Inquiry & contact request count",            false, "soon","soon"],
      ["Advanced analytics — 90-day trends",         false,  false,"soon"],
      ["Referral source breakdown",                  false,  false,"soon"],
      ["Exportable reports (PDF / CSV)",             false,  false, true ],
    ],
  },
  {
    section: "Case Manager Network",
    rows: [
      ["Case managers see your real-time beds",      false,  true,  true ],
      ["Case manager email alerts when beds open",   false,  false, true ],
    ],
  },
  {
    section: "Account",
    rows: [
      ["Houses per account",                         "1 house" as unknown as Cell, "1 house" as unknown as Cell, "Up to 5" as unknown as Cell],
      ["Priority support (same-day response)",       false,  false, true ],
    ],
  },
];

// ── Cell renderer ─────────────────────────────────────────────────────────────
function Cell({ value, highlight }: { value: Cell | string; highlight: boolean }) {
  if (value === true)
    return <span className={`text-lg ${highlight ? "text-teal-600" : "text-green-500"}`}>✓</span>;
  if (value === false)
    return <span className="text-slate-200 text-lg">–</span>;
  if (value === "soon")
    return (
      <span className="text-xs bg-teal-50 text-teal-500 font-semibold px-2 py-0.5 rounded-full border border-teal-200">
        soon
      </span>
    );
  // string value like "1 house" / "Up to 5"
  return <span className={`text-xs font-semibold ${highlight ? "text-teal-700" : "text-slate-500"}`}>{value as string}</span>;
}

export default function RecoveryBilling() {
  const { providerProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const currentPlan: Plan = (providerProfile?.listingPlan as Plan) || "free";
  const isActive = providerProfile?.listingStatus === "active_paid" || currentPlan !== "free";

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); navigate("/login"); } catch { setLoggingOut(false); }
  };

  const upgradeSubject = (plan: Plan) =>
    `Upgrade to ${PLANS[plan].label} — ${providerProfile?.name || ""}`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <div>
              <span className="text-slate-900 text-lg font-semibold">Morava</span>
              <span className="hidden sm:inline text-slate-400 text-sm ml-2">Recovery Housing Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {providerProfile?.name && (
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-700">{providerProfile.name}</div>
                <div className="text-xs text-teal-600 font-medium">Recovery Housing</div>
              </div>
            )}
            <button
              onClick={handleLogout}
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

      <NavBar />

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Listing & Billing</h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Choose the plan that fits where you are. Upgrade anytime — no contracts, no auto-charges.
            We'll reach out before anything changes.
          </p>
          {currentPlan !== "free" && (
            <div className="inline-flex items-center gap-2 mt-4 bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Current plan: {PLANS[currentPlan].label}
            </div>
          )}
        </div>

        {/* ── Tier cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">

          {/* FREE */}
          <PlanCard
            plan="free"
            current={currentPlan === "free"}
            badge={undefined}
            description="Get listed and found. Perfect for getting started or testing the platform."
            cta={null}
          />

          {/* STANDARD */}
          <PlanCard
            plan="standard"
            current={currentPlan === "standard"}
            badge="Most popular"
            description="Full profile, real-time beds, patient intake, and analytics. Everything to fill beds faster."
            cta={
              currentPlan === "standard" ? null : (
                <a
                  href={`mailto:support@moravacare.com?subject=${encodeURIComponent(upgradeSubject("standard"))}`}
                  className="block w-full text-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  {currentPlan === "free" ? "Upgrade to Standard →" : "Downgrade to Standard"}
                </a>
              )
            }
          />

          {/* GROWTH */}
          <PlanCard
            plan="growth"
            current={currentPlan === "growth"}
            badge="Best for growing operators"
            description="Featured placement, case manager alerts, multiple houses, and advanced analytics."
            cta={
              currentPlan === "growth" ? null : (
                <a
                  href={`mailto:support@moravacare.com?subject=${encodeURIComponent(upgradeSubject("growth"))}`}
                  className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  Upgrade to Growth →
                </a>
              )
            }
          />
        </div>

        {/* ── Feature comparison table ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-base">Full feature comparison</h2>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50">
            <div className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Feature</div>
            {(["free", "standard", "growth"] as Plan[]).map((p) => (
              <div
                key={p}
                className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wide ${
                  p === "standard" ? "text-teal-600 bg-teal-50/60" :
                  p === "growth"   ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                {PLANS[p].label}
                {p === currentPlan && (
                  <span className="block text-xs normal-case font-medium mt-0.5 opacity-70">← current</span>
                )}
              </div>
            ))}
          </div>

          {FEATURES.map((section) => (
            <div key={section.section}>
              {/* Section header */}
              <div className="px-5 py-2.5 bg-slate-50 border-y border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{section.section}</span>
              </div>
              {section.rows.map(([label, free, standard, growth]) => (
                <div
                  key={label}
                  className="grid grid-cols-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="px-5 py-3 text-sm text-slate-600">{label}</div>
                  <div className="px-4 py-3 flex items-center justify-center">
                    <Cell value={free} highlight={false} />
                  </div>
                  <div className="px-4 py-3 flex items-center justify-center bg-teal-50/30">
                    <Cell value={standard} highlight={true} />
                  </div>
                  <div className="px-4 py-3 flex items-center justify-center">
                    <Cell value={growth} highlight={false} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── ROI callout ──────────────────────────────────────────────────── */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <span className="text-2xl flex-shrink-0">💡</span>
            <div>
              <h3 className="font-bold text-teal-800 mb-2">The math is simple</h3>
              <p className="text-sm text-teal-700 leading-relaxed">
                One filled bed from a Morava referral brings in <strong>$450–$750/month</strong>.
                At $80/month for Standard, your listing pays for itself in hours — not weeks.
                Growth at $159/month is covered by a single referral that would otherwise have gone elsewhere.
              </p>
            </div>
          </div>
        </div>

        {/* ── No auto-charge guarantee ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
          <div className="flex items-start gap-4">
            <span className="text-2xl flex-shrink-0">🔒</span>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">No automatic charges — ever</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Morava does not auto-charge your account or save a card on file without your permission.
                Every upgrade and payment is handled directly with our team. You'll always have advance
                notice and a chance to ask questions before any billing begins.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Ready to upgrade?{" "}
                <a
                  href="mailto:support@moravacare.com?subject=Recovery listing upgrade"
                  className="text-teal-600 hover:text-teal-800 font-medium underline"
                >
                  Email support@moravacare.com
                </a>{" "}
                and we'll get you set up same day.
              </p>
            </div>
          </div>
        </div>

        {/* ── What competitors DON'T have callout ─────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-8 text-white">
          <h3 className="font-bold text-white mb-1">Why Morava vs. other directories</h3>
          <p className="text-slate-400 text-xs mb-4">What you get here that you won't get anywhere else in Oklahoma</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: "🔄", label: "Real-time bed availability", desc: "No other Oklahoma directory updates live" },
              { icon: "📋", label: "Patient intake forms", desc: "Qualify inquiries before they call" },
              { icon: "📊", label: "Listing analytics", desc: "See who's finding you and how" },
              { icon: "🔔", label: "Case manager alerts", desc: "Proactively fill beds via referral network" },
              { icon: "🏅", label: "Certification display", desc: "OKARR & ODMHSAS badges visible to patients" },
              { icon: "🏠", label: "Multi-house management", desc: "Manage 5 listings from one login" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Support ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-4">Questions about plans?</div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-teal-500">✉</span>
              <a href="mailto:support@moravacare.com" className="text-teal-600 hover:text-teal-800">
                support@moravacare.com
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-teal-500">📞</span>
              <a href="tel:+18558126996" className="text-teal-600 hover:text-teal-800">
                (855) 812-6996
              </a>
            </div>
            <p className="text-slate-400 text-xs pt-1">Mon–Fri 9am–5pm CT · We'll get back to you same day.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  current,
  badge,
  description,
  cta,
}: {
  plan: Plan;
  current: boolean;
  badge?: string;
  description: string;
  cta: React.ReactNode;
}) {
  const meta = PLANS[plan];
  const isStandard = plan === "standard";
  const isGrowth   = plan === "growth";

  const borderClass = current
    ? isStandard ? "border-teal-400 ring-2 ring-teal-200"
    : isGrowth   ? "border-indigo-400 ring-2 ring-indigo-100"
    : "border-slate-400 ring-2 ring-slate-100"
    : isStandard ? "border-teal-200"
    : isGrowth   ? "border-indigo-200"
    : "border-slate-200";

  return (
    <div className={`relative bg-white rounded-2xl border p-5 flex flex-col gap-4 ${borderClass}`}>
      {/* Badge — hidden when this is already the current plan to avoid overlap */}
      {badge && !current && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
          isStandard ? "bg-teal-500 text-white" : "bg-indigo-500 text-white"
        }`}>
          {badge}
        </div>
      )}
      {/* Current plan pill — centered when there's no badge competing for space */}
      {current && (
        <div className={`absolute -top-3 ${badge ? "left-1/2 -translate-x-1/2" : "right-4"} text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
          isStandard ? "bg-teal-600 text-white"
          : isGrowth  ? "bg-indigo-600 text-white"
          : "bg-slate-700 text-white"
        }`}>
          ✓ Current plan
        </div>
      )}

      {/* Price */}
      <div className="pt-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{meta.label}</div>
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-bold ${isStandard ? "text-teal-600" : isGrowth ? "text-indigo-600" : "text-slate-700"}`}>
            ${meta.price}
          </span>
          <span className="text-slate-400 text-sm">{meta.per}</span>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{description}</p>
      </div>

      {/* Top features */}
      <div className="space-y-2 flex-1">
        {plan === "free" && (
          <>
            <Feature label="Listed in Morava search" />
            <Feature label="Name, city & phone displayed" />
            <Feature label="Availability status visible" />
            <Locked  label="Full profile & photos" />
            <Locked  label="Real-time bed counts" />
            <Locked  label="Patient intake form" />
          </>
        )}
        {plan === "standard" && (
          <>
            <Feature label="Full profile, photos & certifications" />
            <Feature label="Real-time exact bed counts" />
            <Feature label="Email + call from patients" />
            <Feature label="Patient intake inquiry form" soon />
            <Feature label="Analytics — views & inquiries" soon />
            <Locked  label="Featured placement" />
            <Locked  label="Case manager alerts" />
          </>
        )}
        {plan === "growth" && (
          <>
            <Feature label="Everything in Standard" />
            <Feature label="Featured — top of search results" />
            <Feature label="Case manager alert network" />
            <Feature label="Up to 5 houses from one account" />
            <Feature label="Advanced analytics & reports" soon />
            <Feature label="Waitlist management" />
            <Feature label="Priority support" />
          </>
        )}
      </div>

      {/* CTA */}
      {cta ? (
        <div className="mt-2">{cta}</div>
      ) : current ? (
        <div className={`text-center text-sm font-semibold py-3 rounded-xl border ${
          isStandard ? "border-teal-200 text-teal-600 bg-teal-50"
          : isGrowth   ? "border-indigo-200 text-indigo-600 bg-indigo-50"
          : "border-slate-200 text-slate-500 bg-slate-50"
        }`}>
          ✓ Your current plan
        </div>
      ) : null}
    </div>
  );
}

function Feature({ label, soon }: { label: string; soon?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="text-teal-500 flex-shrink-0">✓</span>
      <span>{label}</span>
      {soon && (
        <span className="text-xs bg-teal-50 text-teal-500 font-semibold px-1.5 py-0.5 rounded-full border border-teal-200 ml-auto">
          soon
        </span>
      )}
    </div>
  );
}

function Locked({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <span className="flex-shrink-0 text-xs">🔒</span>
      <span>{label}</span>
    </div>
  );
}
