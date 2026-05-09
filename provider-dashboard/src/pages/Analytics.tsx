import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NavBar from "../components/NavBar";

export default function Analytics() {
  const navigate = useNavigate();
  const { providerProfile } = useAuth();
  const isPro = providerProfile?.plan === "pro";

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
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Analytics</h1>
          <p className="text-slate-500">
            Booking trends, patient insights, and practice performance.
          </p>
        </div>

        {isPro ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Analytics launching soon
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              You'll be among the first to access booking trends, insurance
              breakdowns, no-show rates, and peak-hour data. We'll notify you
              the moment it goes live.
            </p>
            <div className="max-w-2xl mx-auto">
              <div className="filter blur-sm pointer-events-none select-none bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-end justify-center gap-3 h-24">
                  {[4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 14].map((h, i) => (
                    <div
                      key={i}
                      className="bg-teal-200 rounded-t"
                      style={{ width: 20, height: `${h * 6}px` }}
                    />
                  ))}
                </div>
              </div>
              <div className="text-xs text-teal-600 mt-3 font-medium">
                📬 You'll be notified at {providerProfile?.email} when analytics
                launches
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="relative">
              <div className="filter blur-sm pointer-events-none select-none p-8">
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { label: "Total visits", val: "47" },
                    { label: "Avg per month", val: "8.2" },
                    { label: "No-show rate", val: "12%" },
                    { label: "Top insurance", val: "SoonerCare" },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-4">
                      <div className="text-2xl font-bold text-slate-300 mb-1">
                        {s.val}
                      </div>
                      <div className="text-xs text-slate-200">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <div className="flex items-end gap-3 h-24 justify-center">
                    {[3, 5, 4, 7, 6, 8, 5, 10, 8, 12, 9, 11].map((h, i) => (
                      <div
                        key={i}
                        className="bg-slate-200 rounded-t"
                        style={{ width: 20, height: `${h * 6}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-4">
                <div className="text-4xl">🔒</div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">
                    Analytics is a Pro feature
                  </h2>
                  <p className="text-slate-500 text-sm max-w-sm mb-5">
                    Booking trends, insurance breakdowns, no-show rates, and
                    peak hours — all in one dashboard.
                  </p>
                  <button
                    onClick={() => navigate("/billing")}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
                  >
                    Upgrade to Pro to unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
