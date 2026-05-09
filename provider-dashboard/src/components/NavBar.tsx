import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { providerProfile } = useAuth();
  const isPro = providerProfile?.plan === "pro";

  const tabs = [
    { label: "Home", path: "/dashboard" },
    { label: "Billing", path: "/billing" },
    { label: "Profile", path: "/profile" },
    { label: "Analytics", path: "/analytics", locked: !isPro, soon: isPro },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
      <div className="max-w-5xl mx-auto px-6 flex items-center gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-sm font-medium
                border-b-2 whitespace-nowrap transition-colors
                ${
                  isActive
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
                }
              `}
            >
              {tab.label}
              {tab.locked && (
                <span className="text-xs text-slate-300 ml-0.5">🔒</span>
              )}
              {tab.soon && (
                <span className="text-xs bg-teal-50 text-teal-500 font-semibold px-1.5 py-0.5 rounded-full ml-0.5">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
