import type { User } from "firebase/auth";
import {
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signOut,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";

interface ProviderProfile {
  providerId: string;
  name: string;
  specialty: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  isMFAEnrolled: boolean;
  mfaResolver: MultiFactorResolver | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // MFA enrollment (from dashboard)
  startMFAEnrollment: (phone: string) => Promise<void>;
  completeMFAEnrollment: (code: string) => Promise<void>;
  cancelMFAEnrollment: () => void;
  // MFA challenge (mid-login)
  startMFAChallenge: () => Promise<void>;
  completeMFAChallenge: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [providerProfile, setProviderProfile] =
    useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(
    null,
  );

  // Refs for ongoing phone auth sessions
  const enrollVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const challengeVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const enrollVerificationIdRef = useRef<string>("");
  const challengeVerificationIdRef = useRef<string>("");

  const isMFAEnrolled = !!(
    user && multiFactor(user).enrolledFactors.length > 0
  );

  // Helper: create a fresh invisible reCAPTCHA verifier attached to a container div
  const makeVerifier = (containerId: string): RecaptchaVerifier => {
    const existing = document.getElementById(containerId);
    if (existing) existing.innerHTML = "";
    return new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "providerUsers", u.uid));
          if (snap.exists()) {
            const d = snap.data();
            const provSnap = await getDoc(doc(db, "providers", d.providerId));
            const prov = provSnap.exists() ? provSnap.data() : {};
            setProviderProfile({
              providerId: d.providerId,
              name: prov.name || "",
              specialty: prov.specialty || "",
              email: u.email || "",
            });
          } else {
            setProviderProfile(null);
          }
        } catch {
          setProviderProfile(null);
        }
      } else {
        setProviderProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Login — catches MFA challenge and stores resolver ─────────────────────
  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMfaResolver(null);
    } catch (err: unknown) {
      const mfaErr = err as MultiFactorError;
      if (mfaErr?.code === "auth/multi-factor-auth-required") {
        // Store resolver — App.tsx will show MFAChallenge
        const resolver = getMultiFactorResolver(auth, mfaErr);
        setMfaResolver(resolver);
        throw err; // re-throw so Login.tsx knows to wait
      }
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setMfaResolver(null);
  };

  // ── MFA Enrollment: Step 1 — send SMS to phone number ─────────────────────
  const startMFAEnrollment = async (phone: string) => {
    if (!user) throw new Error("Not authenticated");
    if (enrollVerifierRef.current) {
      enrollVerifierRef.current.clear();
      enrollVerifierRef.current = null;
    }
    const verifier = makeVerifier("recaptcha-enroll");
    enrollVerifierRef.current = verifier;
    const session = await multiFactor(user).getSession();
    const provider = new PhoneAuthProvider(auth);
    enrollVerificationIdRef.current = await provider.verifyPhoneNumber(
      { phoneNumber: phone, session },
      verifier,
    );
  };

  // ── MFA Enrollment: Step 2 — verify code and enroll ───────────────────────
  const completeMFAEnrollment = async (code: string) => {
    if (!user) throw new Error("Not authenticated");
    const cred = PhoneAuthProvider.credential(
      enrollVerificationIdRef.current,
      code,
    );
    const assertion = PhoneMultiFactorGenerator.assertion(cred);
    await multiFactor(user).enroll(assertion, "Phone");
    enrollVerificationIdRef.current = "";
    if (enrollVerifierRef.current) {
      enrollVerifierRef.current.clear();
      enrollVerifierRef.current = null;
    }
    // Reload the actual auth user — spreading breaks Firebase internal methods
    await auth.currentUser?.reload();
    setUser(auth.currentUser);
  };

  const cancelMFAEnrollment = () => {
    enrollVerificationIdRef.current = "";
    if (enrollVerifierRef.current) {
      enrollVerifierRef.current.clear();
      enrollVerifierRef.current = null;
    }
  };

  // ── MFA Challenge: Step 1 — send SMS using stored resolver ────────────────
  const startMFAChallenge = async () => {
    if (!mfaResolver) throw new Error("No MFA resolver — log in first");
    if (challengeVerifierRef.current) {
      challengeVerifierRef.current.clear();
      challengeVerifierRef.current = null;
    }
    const verifier = makeVerifier("recaptcha-challenge");
    challengeVerifierRef.current = verifier;
    const phoneHint = mfaResolver.hints.find(
      (h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
    );
    if (!phoneHint) throw new Error("No phone factor enrolled");
    const provider = new PhoneAuthProvider(auth);
    challengeVerificationIdRef.current = await provider.verifyPhoneNumber(
      { multiFactorHint: phoneHint, session: mfaResolver.session },
      verifier,
    );
  };

  // ── MFA Challenge: Step 2 — verify code and complete login ────────────────
  const completeMFAChallenge = async (code: string) => {
    if (!mfaResolver) throw new Error("No MFA resolver");
    const cred = PhoneAuthProvider.credential(
      challengeVerificationIdRef.current,
      code,
    );
    const assertion = PhoneMultiFactorGenerator.assertion(cred);
    await mfaResolver.resolveSignIn(assertion);
    setMfaResolver(null);
    challengeVerificationIdRef.current = "";
    if (challengeVerifierRef.current) {
      challengeVerifierRef.current.clear();
      challengeVerifierRef.current = null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        providerProfile,
        loading,
        isMFAEnrolled,
        mfaResolver,
        login,
        logout,
        startMFAEnrollment,
        completeMFAEnrollment,
        cancelMFAEnrollment,
        startMFAChallenge,
        completeMFAChallenge,
      }}
    >
      {/* Invisible reCAPTCHA containers — hidden, required by Firebase Phone Auth */}
      <div id="recaptcha-enroll" style={{ display: "none" }} />
      <div id="recaptcha-challenge" style={{ display: "none" }} />
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
