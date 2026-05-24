import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
} from 'firebase/auth';
import { useState } from 'react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

// ─── MFA Enrollment Modal ──────────────────────────────────────────────────
// Shown inside the dashboard when a provider hasn't set up 2FA yet.
// Two-step: enter phone → enter SMS code → enrolled.
//
// Extra steps that may appear:
//   reauth       — Firebase requires a recent login before MFA enrollment.
//                  Prompts for password, reauthenticates, then retries.
//   verify-email — Firebase requires email verification before MFA enrollment.
//                  Shows "send confirmation email" flow.

interface MFASetupProps {
  onClose: () => void;
  onEnrolled: () => void;
  /** When true, hides the "Set up later" button — used for enforcement gates */
  required?: boolean;
}

type Step = 'phone' | 'reauth' | 'code' | 'loading' | 'done' | 'verify-email';

export default function MFASetup({ onClose, onEnrolled, required = false }: MFASetupProps) {
  const { startMFAEnrollment, completeMFAEnrollment, cancelMFAEnrollment } = useAuth();

  const [step,             setStep]             = useState<Step>('phone');
  const [phone,            setPhone]            = useState('');
  const [code,             setCode]             = useState('');
  const [password,         setPassword]         = useState('');
  const [showPass,         setShowPass]         = useState(false);
  const [reauthLoading,    setReauthLoading]    = useState(false);
  const [errorMsg,         setErrorMsg]         = useState('');
  const [verifyEmailSent,  setVerifyEmailSent]  = useState(false);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3)  return digits;
    if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  };

  const e164 = (formatted: string) => `+1${formatted.replace(/\D/g, '')}`;

  // ── Step 1a: Send SMS code ──────────────────────────────────────────────
  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setErrorMsg('Enter a valid 10-digit US phone number.');
      return;
    }
    setStep('loading');
    setErrorMsg('');
    try {
      await startMFAEnrollment(e164(phone));
      setStep('code');
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code || '';
      if (errCode === 'auth/unverified-email') {
        // Firebase requires email verification before MFA enrollment.
        setStep('verify-email');
      } else if (errCode === 'auth/requires-recent-login') {
        // Session is stale — Firebase requires a fresh login for sensitive operations.
        // Show reauth step so the provider can re-enter their password without logging out.
        setStep('reauth');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to send code. Try again.');
        setStep('phone');
      }
    }
  };

  // ── Reauth: re-enter password, then retry enrollment ───────────────────
  const handleReauth = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setErrorMsg('Could not identify your account. Please sign out and sign back in.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setReauthLoading(true);
    setErrorMsg('');
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      // Successfully reauthenticated — now retry the enrollment
      setPassword('');
      setStep('loading');
      await startMFAEnrollment(e164(phone));
      setStep('code');
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code || '';
      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        setErrorMsg('Incorrect password. Please try again.');
      } else if (errCode === 'auth/too-many-requests') {
        setErrorMsg('Too many attempts. Please wait a few minutes.');
      } else {
        setErrorMsg('Verification failed. Please sign out and sign back in.');
      }
    } finally {
      setReauthLoading(false);
    }
  };

  // ── Verify email step ──────────────────────────────────────────────────
  const handleSendVerificationEmail = async () => {
    try {
      const user = auth.currentUser;
      if (user) await sendEmailVerification(user);
      setVerifyEmailSent(true);
    } catch {
      setErrorMsg('Could not send verification email. Try again or contact support.');
    }
  };

  // ── Step 2: Verify SMS code ────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (code.length !== 6) return;
    setStep('loading');
    setErrorMsg('');
    try {
      await completeMFAEnrollment(code);
      setStep('done');
      setTimeout(() => onEnrolled(), 1500);
    } catch (err: unknown) {
      const c = (err as { code?: string })?.code || '';
      if (c === 'auth/invalid-verification-code') {
        setErrorMsg('Incorrect code. Please try again.');
      } else if (c === 'auth/code-expired') {
        setErrorMsg('Code expired. Go back and resend.');
      } else {
        setErrorMsg('Verification failed. Please try again.');
      }
      setStep('code');
      setCode('');
    }
  };

  const handleClose = () => {
    cancelMFAEnrollment();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-xl">
            🔐
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Set up two-factor authentication</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {required
                ? 'Required to access your provider dashboard'
                : 'Required before adding billing information'}
            </p>
          </div>
        </div>

        {/* ── Step: reauth ─────────────────────────────────────────────────────
             Firebase requires a recent sign-in before allowing MFA enrollment.
             This can happen when the session has been open for a while, or after
             following an email verification link. The provider re-enters their
             password here — no sign-out/sign-in loop required. */}
        {step === 'reauth' && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <span className="text-2xl mt-0.5">🔑</span>
              <div>
                <p className="text-amber-900 text-sm font-semibold mb-1">Confirm your password to continue</p>
                <p className="text-amber-700 text-sm leading-relaxed">
                  For security, please re-enter your password before adding
                  phone verification to your account.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your current password"
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 pr-16 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  onKeyDown={e => { if (e.key === 'Enter') handleReauth(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              onClick={handleReauth}
              disabled={reauthLoading || !password}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {reauthLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming…
                </span>
              ) : 'Confirm & continue →'}
            </button>

            <button
              onClick={() => { setStep('phone'); setErrorMsg(''); setPassword(''); }}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300 transition-colors"
            >
              ← Back to phone number
            </button>
          </div>
        )}

        {/* ── Step: verify-email ───────────────────────────────────────────────
             This step appears only if the provider account was created without
             email verification. All new Morava accounts are pre-verified —
             this is a safety net for legacy or manually created accounts. */}
        {step === 'verify-email' && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <span className="text-2xl mt-0.5">📬</span>
              <div>
                <p className="text-amber-900 text-sm font-semibold mb-1">One more step — confirm your email</p>
                <p className="text-amber-700 text-sm leading-relaxed">
                  Your email address hasn't been confirmed yet. We need to
                  verify it before adding phone authentication. Click below
                  and we'll send a confirmation link to your inbox.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            {verifyEmailSent ? (
              <div className="bg-teal-50 border border-teal-100 text-teal-700 text-sm px-4 py-3 rounded-lg space-y-2">
                <p className="font-semibold text-center">✅ Confirmation email sent</p>
                <p className="text-xs text-center">
                  Check your inbox and click the link. Once confirmed,
                  come back here and click <strong>Back</strong> to retry.
                </p>
                <p className="text-xs text-teal-600 text-center">
                  Can't find it? Check your spam folder or contact{' '}
                  <a href="mailto:support@moravacare.com" className="underline">
                    support@moravacare.com
                  </a>
                </p>
              </div>
            ) : (
              <button
                onClick={handleSendVerificationEmail}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-teal-500 hover:bg-teal-600 transition-colors"
              >
                Send confirmation email
              </button>
            )}

            <button
              onClick={() => { setStep('phone'); setErrorMsg(''); }}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300 transition-colors"
            >
              ← Back to phone number
            </button>
          </div>
        )}

        {/* ── Step: phone ──────────────────────────────────────────────────── */}
        {(step === 'phone' || (step === 'loading' && code === '')) && (
          <div className="space-y-5">
            <p className="text-slate-600 text-sm leading-relaxed">
              Add your phone number to protect your account. You'll receive a 6-digit code each time you log in from a new device.
            </p>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Mobile phone number
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                <span className="px-3 py-3 bg-slate-50 text-slate-500 text-sm border-r border-slate-200 font-medium">
                  +1
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(405) 555-0123"
                  className="flex-1 px-4 py-3 text-sm text-slate-700 focus:outline-none"
                  maxLength={14}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSendCode(); }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">US numbers only. Standard SMS rates apply.</p>
            </div>

            <div className="flex gap-3">
              {!required && (
                <button
                  onClick={handleClose}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
                >
                  Set up later
                </button>
              )}
              <button
                onClick={handleSendCode}
                disabled={step === 'loading'}
                className={`${required ? 'w-full' : 'flex-1'} bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors`}
              >
                {step === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : 'Send code →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: code ───────────────────────────────────────────────────── */}
        {(step === 'code' || (step === 'loading' && code !== '')) && (
          <div className="space-y-5">
            <p className="text-slate-600 text-sm leading-relaxed">
              Enter the 6-digit code sent to <strong>{phone}</strong>.
            </p>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-center text-2xl font-bold tracking-widest text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleVerifyCode(); }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('phone'); setCode(''); setErrorMsg(''); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6 || step === 'loading'}
                className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {step === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : 'Verify & enable →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: done ───────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Two-factor authentication enabled</h4>
            <p className="text-slate-500 text-sm">Your account is now protected. You'll be asked for a code on each new device login.</p>
          </div>
        )}
      </div>
    </div>
  );
}
