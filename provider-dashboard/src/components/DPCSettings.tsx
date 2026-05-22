// ================================================================
// DPC SETTINGS COMPONENT
// provider-dashboard/src/components/DPCSettings.tsx
//
// Renders inside Profile.tsx for all providers — inactive unless
// they set practiceType = "dpc".
// Saves: dpcMonthlyFee, dpcDescription, hsaEligible,
//        acceptingNewMembers, practiceType to /providers/{id}.
// ================================================================

import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

interface DPCSettingsProps {
  initialFee?: number;
  initialDescription?: string;
  initialHsaEligible?: boolean;
  initialAcceptingNewMembers?: boolean;
}

export default function DPCSettings({
  initialFee,
  initialDescription,
  initialHsaEligible,
  initialAcceptingNewMembers,
}: DPCSettingsProps) {
  const { providerProfile } = useAuth();
  const [fee, setFee] = useState<string>(initialFee ? String(initialFee) : "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [hsaEligible, setHsaEligible] = useState(initialHsaEligible ?? false);
  const [acceptingNewMembers, setAcceptingNewMembers] = useState(
    initialAcceptingNewMembers ?? true,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!providerProfile?.providerId) return;
    const feeNum = parseFloat(fee);
    if (fee && (isNaN(feeNum) || feeNum < 0)) {
      setError("Please enter a valid monthly fee.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "providers", providerProfile.providerId), {
        dpcMonthlyFee: fee ? feeNum : null,
        dpcDescription: description.trim() || null,
        hsaEligible,
        acceptingNewMembers,
        practiceType: "dpc",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reusable toggle ────────────────────────────────────────────────────────
  const Toggle = ({
    checked,
    onChange,
    label,
    sub,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    sub?: string;
  }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 flex-shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? "bg-purple-500" : "bg-slate-200"}`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </div>
      <div>
        <span className="text-sm text-slate-700 font-medium">{label}</span>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </label>
  );

  return (
    <div className="space-y-5">
      {/* Monthly fee */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
          Monthly membership fee (USD)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm font-medium">$</span>
          <input
            type="number"
            min={0}
            placeholder="e.g. 75"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <span className="text-slate-400 text-sm">/ month</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Leave blank to show "Contact for pricing" on your listing
        </p>
      </div>

      {/* What's included */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
          What's included in the membership
        </label>
        <textarea
          rows={4}
          placeholder="e.g. Unlimited primary care visits, same/next-day appointments, preventive care, basic labs included, no insurance billing, direct access to your physician via phone and text..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">{description.length}/500</p>
      </div>

      {/* HSA + Accepting Members toggles */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
          Listing badges — shown to patients
        </div>

        <Toggle
          checked={hsaEligible}
          onChange={setHsaEligible}
          label="HSA-eligible membership"
          sub="2025 CARES Act makes DPC memberships HSA-compatible. Check this only if you've confirmed your practice qualifies."
        />

        <Toggle
          checked={acceptingNewMembers}
          onChange={setAcceptingNewMembers}
          label="Currently accepting new members"
          sub="Uncheck this to display 'Panel Closed' on your listing when your panel is full."
        />
      </div>

      {/* How DPC appears on Morava */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-purple-800 mb-2">
          How your DPC listing appears to patients
        </p>
        <ul className="text-xs text-purple-700 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="font-bold flex-shrink-0">🏥</span>
            <span>"Direct Primary Care" badge on your provider card and detail page</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold flex-shrink-0">💵</span>
            <span>Monthly fee shown as a pill on your card — "$75/mo"</span>
          </li>
          {hsaEligible && (
            <li className="flex items-start gap-2">
              <span className="font-bold flex-shrink-0">💰</span>
              <span>"HSA Eligible" badge shown on card and detail page</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="font-bold flex-shrink-0">✓</span>
            <span>
              {acceptingNewMembers
                ? '"Accepting Members" shown on your card'
                : '"Panel Closed" shown — patients are told to check back later'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold flex-shrink-0">ℹ</span>
            <span>SoonerCare/Medicaid patients see a note that DPC is a cash-pay model</span>
          </li>
        </ul>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        {saving ? "Saving..." : saved ? "✓ Saved — visible to patients now" : "Save DPC Settings"}
      </button>
    </div>
  );
}
