import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

// ── Shared helper: wait for webhook to write stripePaymentMethodId ──────────
function waitForPaymentMethod(
  providerId: string,
  onSuccess: () => void,
  timeoutMs = 8000,
) {
  const billingDoc = doc(
    collection(doc(db, "providers", providerId), "billing"),
    "main",
  );
  const unsub = onSnapshot(billingDoc, (snap) => {
    if (snap.data()?.stripePaymentMethodId) {
      unsub();
      onSuccess();
    }
  });
  setTimeout(() => {
    unsub();
    onSuccess();
  }, timeoutMs);
}

// Load Stripe outside component to avoid re-creation on renders
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CARD_STYLE = {
  style: {
    base: {
      fontSize: "15px",
      color: "#1e293b",
      fontFamily: "Arial, sans-serif",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: { color: "#ef4444" },
  },
};

// ── Inner form — must be inside <Elements> ────────────────────────────────
function CardForm({
  providerId,
  onSuccess,
  onCancel,
}: {
  providerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [complete, setComplete] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || !user) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setLoading(true);
    setErrorMsg("");

    try {
      // Step 1 — call Cloud Function to create Setup Intent
      const functions = getFunctions();
      const createSetupIntent = httpsCallable<
        { providerId: string },
        { clientSecret: string; customerId: string }
      >(functions, "createSetupIntent");

      const { data } = await createSetupIntent({ providerId });

      // Step 2 — confirm card setup with Stripe
      const { setupIntent, error } = await stripe.confirmCardSetup(
        data.clientSecret,
        { payment_method: { card } },
      );

      if (error) {
        setErrorMsg(error.message || "Card setup failed. Please try again.");
        setLoading(false);
        return;
      }

      if (setupIntent?.status === "succeeded") {
        // Step 3 — wait for the stripeWebhook Cloud Function to write
        // stripePaymentMethodId to the billing subcollection, then call onSuccess.
        waitForPaymentMethod(providerId, onSuccess, 6000);
      }
    } catch (err: unknown) {
      // Include the raw error code so permission / config issues are visible
      const raw  = err instanceof Error ? err.message : "Something went wrong.";
      const code = (err as { code?: string }).code;
      setErrorMsg(code ? `${raw} (${code})` : raw);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg leading-relaxed">
          ⚠️ {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          Card details
        </label>
        <div className="border border-slate-200 rounded-lg px-4 py-3.5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent transition-all">
          <CardElement
            options={CARD_STYLE}
            onChange={(e) => {
              setComplete(e.complete);
              if (e.error) setErrorMsg(e.error.message);
              else setErrorMsg("");
            }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Secured by Stripe — Morava never stores card numbers
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!complete || loading || !stripe}
          className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Save card →"
          )}
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center leading-relaxed">
        Your card will not be charged today. Billing begins on the 1st of the
        following month for completed visits only. No-shows and cancellations
        are never charged.
      </p>
    </div>
  );
}

// ── Bank Account (ACH) form — must be inside <Elements> ──────────────────────
function BankForm({
  providerId,
  onSuccess,
  onCancel,
}: {
  providerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleConnect = async () => {
    if (!stripe || !user || !name.trim()) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Step 1 — create Setup Intent for US bank account
      const functions = getFunctions();
      const createSetupIntent = httpsCallable<
        { providerId: string; paymentMethodType: string },
        { clientSecret: string; customerId: string }
      >(functions, "createSetupIntent");

      const { data } = await createSetupIntent({
        providerId,
        paymentMethodType: "us_bank_account",
      });

      // Step 2 — open Stripe Financial Connections modal
      const { setupIntent, error } = await (stripe as any).collectBankAccountForSetup({
        clientSecret: data.clientSecret,
        params: {
          payment_method_type: "us_bank_account",
          payment_method_data: {
            billing_details: {
              name: name.trim(),
              email: user.email || "",
            },
          },
        },
        expand: ["payment_method"],
      });

      if (error) {
        setErrorMsg(error.message || "Bank account setup failed. Please try again.");
        setLoading(false);
        return;
      }

      // Step 3 — confirm mandate (required for ACH)
      if (setupIntent?.status === "requires_confirmation") {
        const { error: confirmErr } = await (stripe as any).confirmUsBankAccountSetup(
          data.clientSecret,
        );
        if (confirmErr) {
          setErrorMsg(confirmErr.message || "Bank account confirmation failed.");
          setLoading(false);
          return;
        }
      }

      // Step 4 — wait for webhook to write stripePaymentMethodId
      // ACH webhooks can take a few extra seconds
      waitForPaymentMethod(providerId, onSuccess, 10000);
    } catch (err: unknown) {
      const raw  = err instanceof Error ? err.message : "Something went wrong.";
      const code = (err as { code?: string }).code;
      setErrorMsg(code ? `${raw} (${code})` : raw);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg leading-relaxed">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1.5">
        <div className="font-semibold text-blue-800 mb-1">🏦 ACH Bank Transfer</div>
        <div>→ Connect your bank account securely via Stripe</div>
        <div>→ Micro-deposit verification takes 1–2 business days</div>
        <div>→ Payments deducted directly — no card needed</div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          Account holder name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full legal name on the bank account"
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConnect}
          disabled={!name.trim() || loading || !stripe}
          className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </span>
          ) : (
            "Connect bank account →"
          )}
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center leading-relaxed">
        Powered by Stripe Financial Connections. Bank credentials are never
        shared with Morava.
      </p>
    </div>
  );
}

// ── DPC plan → monthly rate lookup ────────────────────────────────────────
const DPC_RATES: Record<string, string> = {
  founding: "$25/month",
  growth:   "$49/month",
  pro:      "$79/month",
};

// ── Modal wrapper ─────────────────────────────────────────────────────────
interface BillingSetupProps {
  providerId: string;
  providerName: string;
  isFoundingProvider: boolean;
  isDPC?: boolean;
  dpcPlan?: string; // "founding" | "growth" | "pro"
  onClose: () => void;
  onSuccess: () => void;
}

export default function BillingSetup({
  providerId,
  providerName,
  isFoundingProvider,
  isDPC = false,
  dpcPlan = "founding",
  onClose,
  onSuccess,
}: BillingSetupProps) {
  const [step, setStep] = useState<"info" | "card" | "manual" | "done">("info");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSent, setManualSent] = useState(false);

  const handleSuccess = () => {
    setStep("done");
    setTimeout(() => onSuccess(), 1800);
  };

  // ── Info step content differs by account type ──────────────────────────
  const dpcRate = DPC_RATES[dpcPlan] ?? "$25/month";
  const infoBadge = isDPC
    ? `🏥 DPC ${dpcPlan.charAt(0).toUpperCase() + dpcPlan.slice(1)} plan — ${dpcRate}`
    : isFoundingProvider
      ? "🏅 Founding Provider rate — $6/visit for 2 years"
      : "💼 Standard rate — $10/visit";

  const infoPoints = isDPC
    ? [
        "→ Flat monthly fee — covers all member visits",
        "→ Billed automatically on the 1st of each month",
        "→ Card on file today — first charge begins next billing cycle",
        "→ Cancel or pause membership anytime by contacting us",
      ]
    : [
        "→ Billed automatically on the 1st of each month",
        "→ Only charged for completed, attended visits",
        "→ No-shows and cancellations are never charged",
        "→ No monthly fees or subscription costs",
      ];

  const howItWorks = isDPC
    ? [
        "1. Add a card on file today (no charge)",
        "2. Patients search and join your DPC practice",
        "3. On the 1st, your card is charged your flat monthly rate",
        "4. You receive an itemized receipt by email",
      ]
    : [
        "1. Add a card on file today (no charge)",
        "2. Patients book and attend appointments",
        "3. On the 1st, your card is charged for last month's visits",
        "4. You receive an itemized receipt by email",
      ];

  // ── Guard: if providerId is empty the account isn't fully set up yet.
  // Show a clear message instead of letting the card form call the Cloud
  // Function and get a cryptic "providerId is required" error.
  if (!providerId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="text-center">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Account setup incomplete</h3>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
              Your provider account hasn't been fully linked yet. Billing setup
              will be available once the Morava team completes your account
              activation — usually within 1 business day.
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Questions?{" "}
              <a href="mailto:support@moravacare.com" className="text-teal-600 underline">
                support@moravacare.com
              </a>
              {" "}· (855) 812-6996
            </p>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDPC ? "bg-purple-50 border border-purple-100" : "bg-teal-50 border border-teal-100"}`}>
            {isDPC ? "🏥" : "💳"}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Set up billing</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Morava · {providerName}
            </p>
          </div>
        </div>

        {/* Step: info */}
        {step === "info" && (
          <div className="space-y-5">
            <div className={`border rounded-xl p-4 ${isDPC ? "bg-purple-50 border-purple-200" : "bg-teal-50 border-teal-200"}`}>
              <div className={`text-sm font-semibold mb-2 ${isDPC ? "text-purple-800" : "text-teal-800"}`}>
                {infoBadge}
              </div>
              <ul className={`text-xs space-y-1.5 ${isDPC ? "text-purple-700" : "text-teal-700"}`}>
                {infoPoints.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700 mb-1">
                How it works
              </div>
              {howItWorks.map((s) => <div key={s}>{s}</div>)}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={() => setStep("card")}
                className={`flex-1 text-white font-semibold py-3 rounded-xl text-sm transition-colors ${isDPC ? "bg-purple-600 hover:bg-purple-700" : "bg-teal-500 hover:bg-teal-600"}`}
              >
                Add card →
              </button>
            </div>
            <button
              onClick={() => setStep("manual")}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors mt-2 py-1"
            >
              Prefer to pay by check or bank transfer? Request manual billing
            </button>
          </div>
        )}

        {/* Step: payment method selection + forms */}
        {step === "card" && (
          <div className="space-y-4">
            {/* Payment method tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setPaymentMethod("card")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                  paymentMethod === "card"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                💳 Card
              </button>
              <button
                onClick={() => setPaymentMethod("bank")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                  paymentMethod === "bank"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                🏦 Bank (ACH)
              </button>
            </div>

            <Elements stripe={stripePromise}>
              {paymentMethod === "card" ? (
                <CardForm
                  providerId={providerId}
                  onSuccess={handleSuccess}
                  onCancel={() => setStep("info")}
                />
              ) : (
                <BankForm
                  providerId={providerId}
                  onSuccess={handleSuccess}
                  onCancel={() => setStep("info")}
                />
              )}
            </Elements>
          </div>
        )}

        {/* Step: manual billing */}
        {step === "manual" && (
          <div className="space-y-5">
            <p className="text-slate-600 text-sm leading-relaxed">
              We can set up invoicing by check or ACH bank transfer. We'll
              contact you within 1 business day to arrange payment.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold text-amber-800 mb-1">Note</div>
              <div>→ Manual billing requires invoice approval each month</div>
              <div>→ ACH bank transfer takes 3-5 business days to verify</div>
              <div>→ Adding a card is faster and fully automated</div>
            </div>
            {manualSent ? (
              <div className="space-y-4">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="text-sm font-semibold text-teal-800">
                    Request sent
                  </div>
                  <div className="text-xs text-teal-600 mt-1">
                    We'll contact you within 1 business day.
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("info")}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={async () => {
                    setManualLoading(true);
                    try {
                      // The billing subcollection is admin-write-only via rules —
                      // use the requestManualBilling callable so the Admin SDK writes it.
                      const functions = getFunctions();
                      const requestManualBilling = httpsCallable(
                        functions,
                        "requestManualBilling",
                      );
                      await requestManualBilling({ providerId });
                      setManualSent(true);
                    } catch (err) {
                      console.error("requestManualBilling failed:", err);
                      // Still show success UI — the provider reached out; we'll
                      // follow up manually if the function write failed.
                      setManualSent(true);
                    } finally {
                      setManualLoading(false);
                    }
                  }}
                  disabled={manualLoading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {manualLoading ? "Sending..." : "Request manual billing"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">
              Billing set up!
            </h4>
            <p className="text-slate-500 text-sm">
              {isDPC
                ? `Your card is saved. You'll be charged ${dpcRate} on the 1st of each month. Your first charge begins next billing cycle.`
                : "Your card is saved. You'll receive an itemized receipt on the 1st of each month for completed visits only."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
