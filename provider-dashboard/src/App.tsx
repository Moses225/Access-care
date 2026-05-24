import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Analytics from "./pages/Analytics";
import AuthAction from "./pages/AuthAction";
import RecoveryDashboard from "./pages/RecoveryDashboard";
import RecoveryProfile from "./pages/RecoveryProfile";
import RecoveryBilling from "./pages/RecoveryBilling";
import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MFAChallenge from "./pages/MFAChallenge";
import MFASetup from "./pages/MFASetup";
import Profile from "./pages/Profile";

// ── MFA enforcement gate — H-6 ────────────────────────────────────────────
// Renders a full-screen mandatory MFASetup modal when a provider hasn't
// enrolled in 2FA yet. Recovery facility accounts are exempt — they are
// operations staff, not direct providers of clinical care.
// The gate cannot be dismissed (required={true} hides "Set up later").
function MFAEnforcementGate({ children }: { children: React.ReactNode }) {
  const { user, isMFAEnrolled, providerProfile, loading, profileLoading } = useAuth();
  const [enrolled, setEnrolled] = useState(false);

  // Let parent spinners handle loading states
  if (loading || profileLoading || !user) return <>{children}</>;

  // Recovery facility operators are exempt from MFA enforcement
  const isRecoveryFacility = providerProfile?.role === "recovery_facility";
  if (isRecoveryFacility) return <>{children}</>;

  // If already enrolled (or just completed enrollment), let them through
  if (isMFAEnrolled || enrolled) return <>{children}</>;

  // Block access until MFA is configured — no escape route
  return (
    <>
      {/* Render children in background so state is preserved after enrollment */}
      <div className="pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <MFASetup
        required
        onEnrolled={() => setEnrolled(true)}
        onClose={() => { /* required=true — no dismiss, but keep handler for type safety */ }}
      />
    </>
  );
}

// ── Protected route — requires auth + full profile load ──────────────────
// Checks BOTH loading (Firebase auth) and profileLoading (Firestore profile
// fetch) so no child ever renders with stale or null providerProfile data.
// This is the second line of defense against the profile flash bug —
// the first is resetting providerProfile at the top of onAuthStateChanged.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading, mfaResolver } = useAuth();
  if (loading || profileLoading) return <Spinner />;
  // Mid-login MFA challenge — don't let them into dashboard yet
  if (mfaResolver) return <MFAChallenge />;
  if (!user) return <Navigate to="/login" replace />;
  return <MFAEnforcementGate>{children}</MFAEnforcementGate>;
}

// ── Provider-only route — blocks recovery facility accounts ───────────────
// Recovery facility users who type /analytics directly are redirected home.
function ProviderOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading, providerProfile, mfaResolver } = useAuth();
  if (loading || profileLoading) return <Spinner />;
  if (mfaResolver) return <MFAChallenge />;
  if (!user) return <Navigate to="/login" replace />;
  if (providerProfile?.role === "recovery_facility") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── Public route — redirect to dashboard if already logged in ─────────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading, mfaResolver } = useAuth();
  if (loading || profileLoading) return <Spinner />;
  // MFA challenge pending — stay on challenge screen
  if (mfaResolver) return <MFAChallenge />;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Routes provider vs recovery facility based on role
// Waits for BOTH auth loading and Firestore profile fetch to complete
function RoleRouter({
  providerElement,
  facilityElement,
}: {
  providerElement: React.ReactNode;
  facilityElement: React.ReactNode;
}) {
  const { providerProfile, loading, profileLoading } = useAuth();

  // Wait for Firebase auth AND the Firestore providerUsers profile to finish loading.
  // profileLoading stays true until the getDoc() call resolves, so checking only
  // `loading` could cause role to be evaluated while providerProfile is still null.
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Profile loaded — route by role
  if (providerProfile?.role === "recovery_facility") return <>{facilityElement}</>;
  return <>{providerElement}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRouter providerElement={<Dashboard />} facilityElement={<RecoveryDashboard />} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recovery-dashboard"
            element={
              <ProtectedRoute>
                <RecoveryDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <RoleRouter
                  providerElement={<Profile />}
                  facilityElement={<RecoveryProfile />}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <RoleRouter
                  providerElement={<Billing />}
                  facilityElement={<RecoveryBilling />}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProviderOnlyRoute>
                <Analytics />
              </ProviderOnlyRoute>
            }
          />
          {/* Firebase auth action handler — email verification & password reset links */}
          <Route path="/auth-action" element={<AuthAction />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
