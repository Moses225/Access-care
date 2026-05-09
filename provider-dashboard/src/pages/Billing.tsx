import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BillingSetup from "./BillingSetup";
import NavBar from "../components/NavBar";

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
  pro: [
    "⭐ Unlimited completed visits — flat $99/month",
    "🔍 Priority placement in patient search results",
    "🏆 Verified Pro badge on your provider profile",
    "📄 Extended profile with telehealth link",
    "🎧 Dedicated support channel",
    "📊 Analytics dashboard — first access when it launches",
  ],
};

export default function Billing() {
  const navigate = useNavigate();
  const { providerProfile } = useAuth();
  const [showBillingSetup, setShowBillingSetup] = useState(false);

  const plan = providerProfile?.plan ?? "founding";
  const hasPaymentMethod = !!(
    providerProfile?.stripeCustomerId ||
    providerProfile?.stripePaymentMethodId ||
    providerProfile?.manualBilling
  );

  const features =
    PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] ??
    PLAN_FEATURES.standard;

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
            Manage your Morava plan, payment method, and billing details.
          </p>
        </div>

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
                      {plan === "founding"
                        ? "Founding Provider"
                        : plan === "pro"
                          ? "Pro"
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
                    {plan === "pro" ? "$99" : plan === "founding" ? "$6" : "$10"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {plan === "pro" ? "/ month" : "/ completed visit"}
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

              {plan !== "pro" && (
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
                      onClick={() =>
                        alert(
                          "Pro upgrade coming soon — contact support@moravacare.com to upgrade early.",
                        )
                      }
                      className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-4">
                Payment method
              </div>
              {hasPaymentMethod ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                      CARD
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Payment method on file
                      </div>
                      <div className="text-xs text-slate-400">
                        Billed on the 1st of each month for completed visits
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBillingSetup(true)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >
                    Update
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
                    <span className="text-amber-500 text-lg flex-shrink-0">
                      💳
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-amber-800 mb-1">
                        No payment method on file
                      </div>
                      <div className="text-xs text-amber-700">
                        Add a card before your first completed visit is billed.
                        You won't be charged until a patient attends an
                        appointment.
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

      {showBillingSetup && providerProfile && (
        <BillingSetup
          providerId={providerProfile.providerId}
          providerName={providerProfile.name}
          isFoundingProvider={plan === "founding"}
          onClose={() => setShowBillingSetup(false)}
          onSuccess={() => setShowBillingSetup(false)}
        />
      )}
    </div>
  );
}
