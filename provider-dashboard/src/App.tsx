import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MFAChallenge from "./pages/MFAChallenge";
import Profile from "./pages/Profile";

// ── Protected route — requires auth + no pending MFA challenge ────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaResolver } = useAuth();
  if (loading) return <Spinner />;
  // Mid-login MFA challenge — don't let them into dashboard yet
  if (mfaResolver) return <MFAChallenge />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

// ── Public route — redirect to dashboard if already logged in ─────────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaResolver } = useAuth();
  if (loading) return <Spinner />;
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
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
