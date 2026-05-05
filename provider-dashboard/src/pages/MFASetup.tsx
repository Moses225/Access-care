import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// ─── MFA Enrollment Modal ──────────────────────────────────────────────────
// Shown inside the dashboard when a provider hasn't set up 2FA yet.
// Two-step: enter phone → enter SMS code → enrolled.

interface MFASetupProps {
  onClose: () => void;
  onEnrolled: () => void;
}

export default function MFASetup({ onClose, onEnrolled }: MFASetupProps) {
  const { startMFAEnrollment, completeMFAEnrollment, cancelMFAEnrollment } = useAuth();

  const [step,     setStep]     = useState<'phone' | 'code' | 'loading' | 'done'>('phone');
  const [phone,    setPhone]    = useState('');
  const [code,     setCode]     = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3)  return digits;
    if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  };

  const e164 = (formatted: string) => {
    const digits = formatted.replace(/\D/g, '');
    return `+1${digits}`;
  };

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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send code. Try again.');
      setStep('phone');
    }
  };

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
            <p className="text-slate-500 text-xs mt-0.5">Required before adding billing information</p>
          </div>
        </div>

        {/* Step: phone */}
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
              <button
                onClick={handleClose}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
              >
                Set up later
              </button>
              <button
                onClick={handleSendCode}
                disabled={step === 'loading'}
                className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
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

        {/* Step: code */}
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

        {/* Step: done */}
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
