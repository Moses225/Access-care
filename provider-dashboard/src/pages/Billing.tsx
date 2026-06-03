import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import BillingSetup from "./BillingSetup";
import NavBar from "../components/NavBar";

interface SavedPaymentMethod {
  id: string;
  type: "card" | "us_bank_account";
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
  addedAt?: { toDate?: () => Date } | null;
}

const PLAN_FEATURES = {
  founding: [
    "🏅 Founding Provider rate — $6 per completed visit",
    "🔒 Rate locked for 2 years from your activation date",
    "⚡ Pay only when a patient shows up — no-shows never charged",
    "📋 EHR-ready patient summary with every booking",
    "📧 Instant email alert on every new booking",
  ],
  standard: [
    "💳 $10 per completed visit",
    "⚡ Pay only when a patient shows up — no-shows never charged",
    "📋 EHR-ready patient summary with every booking",
    "📧 Instant email alert on every new booking",
  ],
  // DPC Growth tier (id: "growth" in Firestore)
  growth: [
    "🏥 'Direct Primary Care' badge on listing",
    "🔝 Priority placement in DPC filter results",
    "✓ 'Accepting New Members' badge on listing",
    "📱 Telehealth indicator on your listing",
    "📊 Analytics — views, clicks, membership requests",
    "📧 Instant email on every new membership inquiry",
  ],
  pro: [
    "⭐ Unlimited completed visits — flat $99/month",
    "🔍 Priority placement in patient search results",
    "🏆 Verified Pro badge on your provider profile",
    "📄 Extended profile with telehealth link",
    "🎧 Dedicated support channel",
    "📊 Analytics dashboard — first access when it launches",
  ],
};

// Regular provider tier comparison grid (non-DPC)
const REGULAR_TIERS = [
  {
    id: "founding",
    label: "Founding",
    price: "$6",
    period: "/ completed visit",
    badge: "🏅 Founding rate",
    highlight: true,
    color: "teal",
    features: [
      "Rate locked for 2 years from activation",
      "Only pay for attended appointments",
      "No-shows & cancellations never charged",
      "EHR-ready patient summary per booking",
      "Instant email alert on every new booking",
      "No monthly fees or subscription",
    ],
  },
  {
    id: "standard",
    label: "Standard",
    price: "$10",
    period: "/ completed visit",
    badge: null,
    highlight: false,
    color: "slate",
    features: [
      "Pay only for attended appointments",
      "No-shows & cancellations never charged",
      "EHR-ready patient summary per booking",
      "Instant email alert on every new booking",
      "No monthly fees or subscription",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$99",
    period: "/ month",
    badge: "Coming soon",
    highlight: false,
    color: "purple",
    features: [
      "Unlimited completed visits — flat rate",
      "Priority placement in patient search",
      "Verified Pro badge on your profile",
      "Extended profile with telehealth link",
      "Analytics dashboard — early access",
      "Dedicated support channel",
    ],
  },
];

// DPC enrollment-fee model — free to list, pay only when a member enrolls.
// Fee = one month of the provider's own membership fee, clamped [$50, $150].
const DPC_FEE_FLOOR = 50;
const DPC_FEE_CAP = 150;
const DPC_FEE_DEFAULT = 75; // used when provider hasn't set a membership fee
function dpcEnrollmentFee(monthlyFee?: number | null): number {
  if (!monthlyFee || monthlyFee <= 0) return DPC_FEE_DEFAULT;
  return Math.min(DPC_FEE_CAP, Math.max(DPC_FEE_FLOOR, Math.round(monthlyFee)));
}

// ── Card brand → display label ─────────────────────────────────────────────
const BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", jcb: "JCB", diners: "Diners",
  unionpay: "UnionPay", unknown: "Card",
};
const brandLabel = (b?: string) => BRAND_LABELS[b ?? "unknown"] ?? "Card";

export default function Billing() {
  const navigate = useNavigate();
  const { providerProfile, refreshProfile } = useAuth();
  const [showBillingSetup, setShowBillingSetup] = useState(false);
  const [showProInfo, setShowProInfo] = useState(false);

  // Live payment methods from the private billing subcollection
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);
  const [removingId, setRemovingId]     = useState<string | null>(null);
  const [pmError, setPmError]           = useState("");

  const plan = providerProfile?.plan ?? "founding";
  const isDPC = providerProfile?.practiceType === "dpc";
  const hasPaymentMethod = paymentMethods.length > 0 || !!providerProfile?.manualBilling;

  // Subscribe to the billing subcollection for live payment method state
  useEffect(() => {
    if (!providerProfile?.providerId) {
      setBillingLoading(false);
      return;
    }
    const billingDoc = doc(
      collection(doc(db, "providers", providerProfile.providerId), "billing"),
      "main",
    );
    const unsub = onSnapshot(
      billingDoc,
      (snap) => {
        const data = snap.data();
        const methods = (data?.paymentMethods as SavedPaymentMethod[]) || [];
        setPaymentMethods(methods);
        setBillingLoading(false);
      },
      (err) => {
        console.warn("Billing.tsx: billing snapshot error:", err.code);
        setBillingLoading(false);
      },
    );
    return unsub;
  }, [providerProfile?.providerId]);

  const handleSetDefault = async (pmId: string) => {
    if (!providerProfile?.providerId) return;
    setDefaultingId(pmId);
    setPmError("");
    try {
      const fns = getFunctions();
      const setDefault = httpsCallable<{ providerId: string; paymentMethodId: string }, { ok: boolean }>(
        fns, "setDefaultPaymentMethod",
      );
      await setDefault({ providerId: providerProfile.providerId, paymentMethodId: pmId });
      // Snapshot will update the list automatically
    } catch (err: unknown) {
      setPmError(err instanceof Error ? err.message : "Failed to update default.");
    } finally {
      setDefaultingId(null);
    }
  };

  const handleRemove = async (pmId: string) => {
    if (!providerProfile?.providerId) return;
    setRemovingId(pmId);
    setPmError("");
    try {
      const fns = getFunctions();
      const remove = httpsCallable<{ providerId: string; paymentMethodId: string }, { ok: boolean }>(
        fns, "removePaymentMethod",
      );
      await remove({ providerId: providerProfile.providerId, paymentMethodId: pmId });
      await refreshProfile();
    } catch (err: unknown) {
      setPmError(err instanceof Error ? err.message : "Failed to remove method.");
    } finally {
      setRemovingId(null);
    }
  };

  const DPC_FEATURES = [
    "🏥 'Direct Primary Care' badge on your listing",
    "💵 Your membership fee displayed on your card",
    "🔍 Appears in DPC filter results on the patient app",
    "📋 EHR-ready patient summary with each inquiry",
    "📧 Instant email on every membership inquiry",
    "💰 'HSA Eligible' badge (if you qualify)",
  ];
  const features = isDPC
    ? DPC_FEATURES
    : (PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] ?? PLAN_FEATURES.standard);

  const expiryLabel = (() => {
    if (!providerProfile?.foundingExpiresAt) return null;
    try {
      return new Date(providerProfile.foundingExpiresAt).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" },
      );
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
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
              onClick={() => navigate("/dashboard")}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </nav>

      <NavBar />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            Billing & Plan
          </h1>
          <p className="text-slate-500">
            {isDPC
              ? "Manage your DPC listing tier, payment method, and billing details."
              : "Manage your Morava plan, payment method, and billing details."}
          </p>
        </div>

        {/* ── DPC Enrollment-Fee Model ──────────────────────────────────────── */}
        {isDPC && (() => {
          const myFee = dpcEnrollmentFee(providerProfile?.dpcMonthlyFee);
          const myMonthly = providerProfile?.dpcMonthlyFee;
          return (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🏥</span>
              <h2 className="text-lg font-semibold text-slate-900">Direct Primary Care Listing</h2>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">Free to list</span>
            </div>

            {/* Hero — free to list */}
            <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-6 mb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-teal-700">$0</span>
                <span className="text-slate-500 text-sm">to list · no monthly subscription</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                You only pay Morava when we deliver a paying member. No upfront cost, no monthly fee,
                no charge for months with no new members.
              </p>
              <div className="space-y-1.5">
                {[
                  "🏥 'Direct Primary Care' badge on your listing",
                  "💵 Your membership fee displayed on your card",
                  "🔍 Appears in DPC filter results on the patient app",
                  "📋 EHR-ready patient summary with each membership inquiry",
                  "📧 Instant email on every new membership inquiry",
                  "💰 'HSA Eligible' badge (if you qualify)",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-1.5 text-sm text-slate-700">
                    <span className="flex-shrink-0 mt-0.5 text-teal-500">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Enrollment fee card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="font-bold text-slate-900 text-base">Your per-enrollment fee</span>
                <span className="text-2xl font-extrabold text-purple-700">${myFee}<span className="text-sm font-medium text-slate-400"> / member</span></span>
              </div>
              <p className="text-sm text-slate-600">
                {myMonthly && myMonthly > 0
                  ? <>One month of your ${myMonthly}/mo membership, charged once when a patient enrolls and both you and the patient confirm.</>
                  : <>Set your membership fee in your Profile and this becomes one month of that fee. Until then, the default is ${DPC_FEE_DEFAULT} per enrollment.</>}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Fee is one month of your membership price, capped between ${DPC_FEE_FLOOR} and ${DPC_FEE_CAP}.
                A typical member stays 1–3 years — this is a one-time fee on enrollment only.
              </p>
            </div>

            {/* How it works */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-700 space-y-1.5">
              <p className="font-semibold text-purple-800 mb-1">How DPC billing works</p>
              <p>• <strong>Free to list.</strong> No subscription, no monthly fee.</p>
              <p>• A patient finds you on Morava and submits a membership inquiry.</p>
              <p>• When they enroll, you mark them <strong>"Enrolled as member"</strong> in your dashboard, and the patient confirms enrollment in their app.</p>
              <p>• Once <strong>both confirm</strong>, Morava charges a one-time finder's fee of one month's membership (${myFee} for you).</p>
              <p>• Morava never touches your patients' membership payments — you bill members directly and keep 100% of their ongoing dues.</p>
              <p>• Questions? Email <a href="mailto:support@moravacare.com" className="underline">support@moravacare.com</a>.</p>
            </div>
          </div>
          );
        })()}

        {/* ── Regular provider tier comparison grid (non-DPC only) ──────────── */}
        {!isDPC && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">💳</span>
              <h2 className="text-lg font-semibold text-slate-900">Plan Comparison</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {REGULAR_TIERS.map((tier) => {
                const isActive = tier.id === plan;
                const borderClass = isActive
                  ? tier.color === "teal" ? "border-teal-500 bg-teal-50"
                  : tier.color === "purple" ? "border-purple-500 bg-purple-50"
                  : "border-slate-400 bg-slate-50"
                  : "border-slate-200 bg-white";
                const priceClass = isActive
                  ? tier.color === "teal" ? "text-teal-700"
                  : tier.color === "purple" ? "text-purple-700"
                  : "text-slate-700"
                  : "text-slate-500";
                const isCurrent = isActive;
                const isLocked = tier.id === "founding" && plan === "founding";
                return (
                  <div
                    key={tier.id}
                    className={`rounded-2xl border-2 p-5 transition-all ${borderClass} ${tier.id === "pro" ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-900 text-base">{tier.label}</span>
                      {isCurrent ? (
                        <span className="text-xs bg-white text-slate-700 border border-slate-200 font-semibold px-2 py-0.5 rounded-full">✓ Your plan</span>
                      ) : tier.badge ? (
                        <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">{tier.badge}</span>
                      ) : null}
                    </div>
                    <div className="mb-4">
                      <span className={`text-2xl font-extrabold ${priceClass}`}>{tier.price}</span>
                      <span className="text-slate-400 text-sm ml-1">{tier.period}</span>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {tier.features.map((f) => (
                        <div key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="flex-shrink-0 mt-0.5 text-teal-500">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    {!isCurrent && tier.id !== "pro" && !isLocked && (
                      <button
                        onClick={() => {
                          window.open(
                            `mailto:support@moravacare.com?subject=${encodeURIComponent(`Plan change request — ${tier.label}`)}`,
                            "_blank",
                          );
                        }}
                        className="w-full text-xs font-bold py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                      >
                        Contact us to switch
                      </button>
                    )}
                    {tier.id === "pro" && !isCurrent && (
                      <button
                        onClick={() => {
                          window.open(
                            "mailto:support@moravacare.com?subject=Pro%20upgrade%20request",
                            "_blank",
                          );
                        }}
                        className="w-full text-xs font-bold py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
                      >
                        Request early access
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 text-center">
              To change plans, email{" "}
              <a href="mailto:support@moravacare.com" className="text-teal-600 hover:text-teal-800 underline">
                support@moravacare.com
              </a>
              {" "}— we'll confirm and activate within 1 business day.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Current plan
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900">
                      {isDPC
                        ? "DPC — Free Listing"
                        : plan === "founding"
                          ? "Founding Provider"
                          : plan === "pro"
                            ? "Pro"
                            : plan === "growth"
                              ? "Growth"
                              : "Standard"}
                    </span>
                    {plan === "founding" && (
                      <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        🏅 Locked
                      </span>
                    )}
                    {plan === "pro" && (
                      <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        ⭐ Active
                      </span>
                    )}
                  </div>
                  {plan === "founding" && expiryLabel && (
                    <div className="text-xs text-teal-600 mt-1">
                      🔒 Founding rate expires {expiryLabel}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {isDPC
                      ? `$${dpcEnrollmentFee(providerProfile?.dpcMonthlyFee)}`
                      : plan === "pro" ? "$99" : plan === "founding" ? "$6" : "$10"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isDPC ? "/ enrolled member" : plan === "pro" ? "/ month" : "/ completed visit"}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">
                  What's included
                </div>
                <div className="space-y-2">
                  {features.map((f) => (
                    <div
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span className="flex-shrink-0 mt-0.5">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {plan !== "pro" && !isDPC && (
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="bg-teal-50 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-teal-800 mb-0.5">
                        Upgrade to Pro
                      </div>
                      <div className="text-xs text-teal-600">
                        $99/month · unlimited visits · priority search ·
                        analytics first access
                      </div>
                    </div>
                    <button
                      onClick={() => setShowProInfo((v) => !v)}
                      className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      {showProInfo ? "Close" : "Upgrade to Pro"}
                    </button>
                  </div>
                  {showProInfo && (
                    <div className="mt-3 bg-white border border-teal-200 rounded-xl p-4 text-sm text-slate-700 space-y-2">
                      <p className="font-semibold text-teal-700">Pro is coming soon — here's how to get early access:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 text-xs leading-relaxed">
                        <li>Email <a href="mailto:support@moravacare.com?subject=Pro upgrade request" className="text-teal-600 underline font-medium">support@moravacare.com</a> with subject "Pro upgrade request"</li>
                        <li>We'll confirm your visit history and activate Pro within 1 business day</li>
                        <li>Your flat $99/month billing starts at the next billing cycle</li>
                      </ol>
                      <p className="text-xs text-slate-400 pt-1">No commitment — you can revert to per-visit billing at any time.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide">
                  Payment methods
                </div>
                {hasPaymentMethod && (
                  <button
                    onClick={() => setShowBillingSetup(true)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"
                  >
                    + Add method
                  </button>
                )}
              </div>

              {pmError && (
                <div className="mb-3 bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-lg">
                  {pmError}
                </div>
              )}

              {providerProfile?.manualBilling ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <span className="text-xl">🏦</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-800">Manual billing active</div>
                    <div className="text-xs text-blue-600">Invoiced by check or ACH — Morava team handles billing</div>
                  </div>
                </div>
              ) : billingLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : paymentMethods.length === 0 ? (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
                    <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
                    <div>
                      <div className="text-sm font-semibold text-amber-800 mb-1">
                        No payment method on file
                      </div>
                      <div className="text-xs text-amber-700">
                        Add a card or bank account. You won't be charged
                        until a patient attends an appointment.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBillingSetup(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Add payment method
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((pm) => {
                    const isCard = pm.type === "card";
                    const label  = isCard
                      ? `${brandLabel(pm.brand)} ···· ${pm.last4 ?? "????"}`
                      : `${pm.bankName ?? "Bank"} ···· ${pm.last4 ?? "????"}`;
                    const sub = isCard
                      ? pm.expMonth && pm.expYear
                        ? `Expires ${pm.expMonth}/${String(pm.expYear).slice(-2)}`
                        : "Credit / debit card"
                      : pm.accountType
                        ? `${pm.accountType.charAt(0).toUpperCase() + pm.accountType.slice(1)} account · ACH`
                        : "Bank account · ACH";
                    const isRemoving   = removingId  === pm.id;
                    const isDefaulting = defaultingId === pm.id;

                    return (
                      <div
                        key={pm.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          pm.isDefault
                            ? "border-teal-300 bg-teal-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {/* Icon */}
                        <div className={`w-10 h-7 rounded border flex items-center justify-center text-base flex-shrink-0 ${
                          pm.isDefault ? "border-teal-200 bg-white" : "border-slate-200 bg-slate-50"
                        }`}>
                          {isCard ? "💳" : "🏦"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                          <div className="text-xs text-slate-400">{sub}</div>
                        </div>

                        {/* Default badge / set-default button */}
                        {pm.isDefault ? (
                          <span className="text-xs bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            ✓ Default
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefault(pm.id)}
                            disabled={isDefaulting || !!removingId}
                            className="text-xs text-slate-400 hover:text-teal-600 font-medium transition-colors disabled:opacity-40 flex-shrink-0"
                          >
                            {isDefaulting ? "…" : "Set default"}
                          </button>
                        )}

                        {/* Remove button — only show if >1 method or ask confirmation */}
                        <button
                          onClick={() => handleRemove(pm.id)}
                          disabled={isRemoving || !!defaultingId}
                          className="text-xs text-slate-300 hover:text-red-500 font-medium transition-colors disabled:opacity-40 flex-shrink-0"
                          title="Remove this payment method"
                        >
                          {isRemoving ? "…" : "Remove"}
                        </button>
                      </div>
                    );
                  })}

                  <p className="text-xs text-slate-400 pt-1">
                    The <strong>default</strong> method is charged on the 1st of each month.
                    You can add multiple methods and switch anytime.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-4">
                How billing works
              </div>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex gap-2">
                  <span className="text-teal-500 flex-shrink-0 mt-0.5">✓</span>
                  <span>
                    Only billed when a patient{" "}
                    <strong>attends</strong> their appointment
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-500 flex-shrink-0 mt-0.5">✓</span>
                  <span>No-shows and cancellations are never charged</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-500 flex-shrink-0 mt-0.5">✓</span>
                  <span>
                    Invoiced on the <strong>1st of each month</strong> for prior
                    month's completed visits
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-500 flex-shrink-0 mt-0.5">✓</span>
                  <span>Itemized receipt emailed on each billing date</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-500 flex-shrink-0 mt-0.5">✓</span>
                  <span>
                    Disputes must be raised within 15 days of billing date
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">
                Questions?
              </div>
              <div className="text-xs text-slate-600 space-y-2">
                <div>
                  Email{" "}
                  <a
                    href="mailto:support@moravacare.com"
                    className="text-teal-600 hover:text-teal-800"
                  >
                    support@moravacare.com
                  </a>
                </div>
                <div>
                  Call{" "}
                  <a
                    href="tel:+18558126996"
                    className="text-teal-600 hover:text-teal-800"
                  >
                    (855) 812-6996
                  </a>
                </div>
                <div className="text-slate-400 pt-1">
                  Mon–Fri 9am–5pm CT
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBillingSetup && (
        providerProfile?.providerId ? (
          <BillingSetup
            providerId={providerProfile.providerId}
            providerName={providerProfile.name}
            isFoundingProvider={plan === "founding"}
            isDPC={isDPC}
            dpcPlan={plan}
            onClose={() => setShowBillingSetup(false)}
            onSuccess={() => {
              setShowBillingSetup(false);
              refreshProfile();
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Account setup incomplete</h3>
              <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Your provider account hasn't been fully linked yet. Contact us
                to complete your setup before adding a payment method.
              </p>
              <p className="text-xs text-slate-400 mb-5">
                <a href="mailto:support@moravacare.com" className="text-teal-600 underline">
                  support@moravacare.com
                </a>
                {" "}· (855) 812-6996
              </p>
              <button
                onClick={() => setShowBillingSetup(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
