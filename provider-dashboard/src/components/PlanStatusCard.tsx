import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Props {
  visitsThisMonth: number;
}

export default function PlanStatusCard({ visitsThisMonth }: Props) {
  const navigate = useNavigate();
  const { providerProfile } = useAuth();
  const plan = providerProfile?.plan ?? "founding";
  const rate = plan === "founding" ? 6 : plan === "standard" ? 10 : null;
  const breakeven = rate ? Math.ceil(99 / rate) : null;
  const pct = breakeven
    ? Math.min(Math.round((visitsThisMonth / breakeven) * 100), 100)
    : 100;
  const monthCost = rate ? visitsThisMonth * rate : 99;

  const expiryLabel = (() => {
    if (!providerProfile?.foundingExpiresAt) return null;
    try {
      return new Date(providerProfile.foundingExpiresAt).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" },
      );
    } catch {
      return null;
    }
  })();

  if (plan === "pro") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-teal-500 p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">
              ⭐ Pro Plan
            </span>
            <span className="bg-teal-50 text-teal-600 text-xs font-medium px-2 py-0.5 rounded-full">
              Priority search active
            </span>
            <span className="bg-teal-50 text-teal-600 text-xs font-medium px-2 py-0.5 rounded-full">
              Pro badge live
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            $99{" "}
            <span className="text-sm font-normal text-slate-400">
              / month · unlimited visits
            </span>
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
              Visits this month
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {visitsThisMonth}
            </div>
            <div className="text-xs text-teal-600">No cap</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
              Effective rate
            </div>
            <div className="text-2xl font-bold text-teal-600">
              {visitsThisMonth > 0
                ? `$${(99 / visitsThisMonth).toFixed(2)}`
                : "—"}
            </div>
            <div className="text-xs text-slate-400">per visit</div>
          </div>
        </div>
        <button
          onClick={() => navigate("/billing")}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg transition-colors"
        >
          Manage plan
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {plan === "founding" ? (
              <span className="bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">
                🏅 Founding Provider
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
                Standard
              </span>
            )}
          </div>
          <div className="text-xl font-bold text-slate-900">
            ${rate}{" "}
            <span className="text-sm font-normal text-slate-400">
              / completed visit
            </span>
          </div>
          {plan === "founding" && (
            <div className="text-xs text-teal-600 mt-0.5">
              🔒{" "}
              {expiryLabel
                ? `Rate locked until ${expiryLabel}`
                : "Rate locked for 2 years from activation"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>
              {visitsThisMonth} / {breakeven} visits toward Pro savings
            </span>
            <span className={pct >= 100 ? "text-teal-600 font-semibold" : ""}>
              {pct}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct >= 100 ? "bg-teal-500" : "bg-teal-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {pct >= 100 ? (
              <span className="text-teal-600 font-medium">
                Pro breakeven reached — upgrade now to save ${monthCost - 99}
              </span>
            ) : (
              <>
                {breakeven! - visitsThisMonth} more visits until Pro pays for
                itself · Current charge:{" "}
                <span className="font-medium text-slate-600">${monthCost}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={() => navigate("/billing")}
            className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Upgrade to Pro
          </button>
          <span className="text-xs text-slate-400">$99/mo · unlimited</span>
        </div>
      </div>
    </div>
  );
}
