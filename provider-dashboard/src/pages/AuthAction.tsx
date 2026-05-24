import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

// ─── Firebase Auth Action Handler ─────────────────────────────────────────────
// Firebase sends action emails (email verification, password reset) with a link
// that contains ?mode=...&oobCode=...&continueUrl=...
//
// Without this page those links land on the login screen and do nothing — the
// oobCode is never consumed, so email verification never completes.
//
// Supported modes:
//   verifyEmail      — called after "Send confirmation email" in MFASetup
//   resetPassword    — called from "Forgot password?" in Login
//
// Firebase console → Authentication → Templates → Action URL should point to:
//   https://morava-dashboard.web.app/auth-action   (or your custom domain /auth-action)

type Mode = "verifyEmail" | "resetPassword" | "unknown";
type Stage = "loading" | "success" | "error" | "reset-form" | "reset-done";

export default function AuthAction() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get("mode") ?? "unknown") as Mode;
  const oobCode = params.get("oobCode") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setErrorMsg("Invalid or missing action code. The link may have expired.");
      setStage("error");
      return;
    }

    if (mode === "verifyEmail") {
      applyActionCode(auth, oobCode)
        .then(() => setStage("success"))
        .catch((err: { code?: string }) => {
          if (err.code === "auth/invalid-action-code") {
            setErrorMsg(
              "This verification link has already been used or has expired. " +
              "Go back to the dashboard and request a new one."
            );
          } else if (err.code === "auth/expired-action-code") {
            setErrorMsg(
              "This verification link has expired. " +
              "Please request a new confirmation email from your dashboard."
            );
          } else {
            setErrorMsg("Email verification failed. Please try again or contact support.");
          }
          setStage("error");
        });
    } else if (mode === "resetPassword") {
      // Validate the code before showing the new-password form
      verifyPasswordResetCode(auth, oobCode)
        .then(() => setStage("reset-form"))
        .catch(() => {
          setErrorMsg(
            "This password reset link has expired or already been used. " +
            "Request a new one from the sign-in page."
          );
          setStage("error");
        });
    } else {
      setErrorMsg("Unrecognised action. The link you followed may be malformed.");
      setStage("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStage("reset-done");
    } catch {
      setErrorMsg("Failed to reset password. The link may have expired — request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="font-display text-2xl text-slate-900">Morava</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">

          {/* Loading */}
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">
                {mode === "verifyEmail" ? "Confirming your email address…" : "Validating link…"}
              </p>
            </div>
          )}

          {/* Email verified — success */}
          {stage === "success" && mode === "verifyEmail" && (
            <div className="text-center space-y-5">
              <div className="text-5xl">✅</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Email confirmed</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Your email address has been verified. You can now finish setting up
                  two-factor authentication on your dashboard.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Back to sign in →
              </button>
            </div>
          )}

          {/* Password reset — new password form */}
          {stage === "reset-form" && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Set new password</h2>
                <p className="text-slate-500 text-sm">Choose a strong password for your account.</p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 pr-11 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : "Save new password →"}
                </button>
              </form>
            </div>
          )}

          {/* Password reset — done */}
          {stage === "reset-done" && (
            <div className="text-center space-y-5">
              <div className="text-5xl">🔒</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Password updated</h2>
                <p className="text-slate-500 text-sm">
                  Your password has been reset. Sign in with your new password.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Sign in →
              </button>
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div className="text-center space-y-5">
              <div className="text-5xl">⚠️</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {mode === "verifyEmail" ? "Verification failed" : "Link invalid"}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">{errorMsg}</p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Back to sign in
              </button>
              <p className="text-xs text-slate-400">
                Need help?{" "}
                <a href="mailto:support@moravacare.com" className="text-teal-600 hover:underline">
                  support@moravacare.com
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
