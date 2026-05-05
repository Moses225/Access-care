import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// ─── MFA Login Challenge ───────────────────────────────────────────────────
// Shown automatically when a provider with 2FA enabled logs in.
// Sends SMS to their enrolled phone, collects 6-digit code, completes sign-in.

export default function MFAChallenge() {
  const { startMFAChallenge, completeMFAChallenge, logout } = useAuth();
  const [code,         setCode]         = useState('');
  const [step,         setStep]         = useState<'sending' | 'enter' | 'verifying' | 'error'>('sending');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [resendCount,  setResendCount]  = useState(0);

  const sendCode = async () => {
    setStep('sending');
    setErrorMsg('');
    try {
      await startMFAChallenge();
      setStep('enter');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send code. Try again.');
      setStep('error');
    }
  };

  // Auto-send on mount
  useEffect(() => { sendCode(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setStep('verifying');
    setErrorMsg('');
    try {
      await completeMFAChallenge(code);
      // Auth state change in AuthContext will redirect to /dashboard automatically
    } catch (err: unknown) {
      const code_ = (err as { code?: string })?.code || '';
      if (code_ === 'auth/invalid-verification-code') {
        setErrorMsg('Incorrect code. Please try again.');
      } else if (code_ === 'auth/code-expired') {
        setErrorMsg('Code expired. Request a new one.');
      } else {
        setErrorMsg('Verification failed. Please try again.');
      }
      setStep('enter');
      setCode('');
    }
  };

  const handleResend = () => {
    setCode('');
    setResendCount(c => c + 1);
    sendCode();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">Morava</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Two-step verification</h1>
          <p className="text-slate-500 text-sm">
            {step === 'sending'
              ? 'Sending verification code to your phone...'
              : 'Enter the 6-digit code sent to your enrolled phone number.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">

          {step === 'sending' && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-500 text-sm">Sending SMS...</span>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                {errorMsg}
              </div>
              <button
                onClick={sendCode}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {(step === 'enter' || step === 'verifying') && (
            <div className="space-y-5">
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
                  onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={code.length !== 6 || step === 'verifying'}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
              >
                {step === 'verifying' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : 'Verify →'}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCount >= 3}
                  className="text-sm text-slate-400 hover:text-teal-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resendCount >= 3 ? "Too many attempts — contact support" : "Resend code"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          <button
            onClick={() => logout()}
            className="hover:text-slate-600 transition-colors"
          >
            ← Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
