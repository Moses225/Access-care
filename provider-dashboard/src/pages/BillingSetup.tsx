import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

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
        // Step 3 — Cloud Function already saved stripeCustomerId + stripePaymentMethodId
        // Wait for Firestore to confirm the write before calling onSuccess
        const unsub = onSnapshot(doc(db, "providers", providerId), (snap) => {
          if (snap.data()?.stripePaymentMethodId) {
            unsub();
            onSuccess();
          }
        });
        // Fallback timeout — call success after 5s even if snapshot is slow
        setTimeout(() => {
          unsub();
          onSuccess();
        }, 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
          {errorMsg}
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

// ── Modal wrapper ─────────────────────────────────────────────────────────
interface BillingSetupProps {
  providerId: string;
  providerName: string;
  isFoundingProvider: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BillingSetup({
  providerId,
  providerName,
  isFoundingProvider,
  onClose,
  onSuccess,
}: BillingSetupProps) {
  const [step, setStep] = useState<"info" | "card" | "manual" | "done">("info");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSent, setManualSent] = useState(false);

  const handleSuccess = () => {
    setStep("done");
    setTimeout(() => onSuccess(), 1800);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-xl">
            💳
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
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-teal-800 mb-2">
                {isFoundingProvider
                  ? "🏅 Founding Provider rate — $6/visit for 2 years"
                  : "💼 Standard rate — $10/visit"}
              </div>
              <ul className="text-xs text-teal-700 space-y-1.5">
                <li>→ Billed automatically on the 1st of each month</li>
                <li>→ Only charged for completed, attended visits</li>
                <li>→ No-shows and cancellations are never charged</li>
                <li>→ No monthly fees or subscription costs</li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700 mb-1">
                How it works
              </div>
              <div>1. Add a card on file today (no charge)</div>
              <div>2. Patients book and attend appointments</div>
              <div>
                3. On the 1st, your card is charged for last month's visits
              </div>
              <div>4. You receive an itemized receipt by email</div>
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
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
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

        {/* Step: card */}
        {step === "card" && (
          <Elements stripe={stripePromise}>
            <CardForm
              providerId={providerId}
              onSuccess={handleSuccess}
              onCancel={() => setStep("info")}
            />
          </Elements>
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
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm font-semibold text-teal-800">
                  Request sent
                </div>
                <div className="text-xs text-teal-600 mt-1">
                  We'll contact you at{" "}
                  {providerName.split("·")[1]?.trim() || "your email"} within 1
                  business day.
                </div>
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
                      await updateDoc(doc(db, "providers", providerId), {
                        manualBilling: true,
                        manualBillingRequestedAt: new Date(),
                      });
                      setManualSent(true);
                    } catch {
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
              Your card is saved. You'll receive an itemized receipt on the 1st
              of each month for completed visits only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
