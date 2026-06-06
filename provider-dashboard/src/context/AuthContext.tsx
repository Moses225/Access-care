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
import { getFunctions, httpsCallable } from "firebase/functions";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";

interface ProviderProfile {
  providerId: string;
  name: string;
  specialty: string;
  email: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  manualBilling?: boolean;
  // Complimentary "founding provider" account — full features, no charge, no billing prompts
  foundingComp?: boolean;
  // Regular providers: founding | standard | pro
  // DPC providers:     founding | growth | pro
  plan?: "founding" | "standard" | "growth" | "pro";
  foundingExpiresAt?: string | null;
  // DPC membership fee the provider charges their own patients (display + enrollment-fee basis)
  dpcMonthlyFee?: number | null;
  // Role-based routing — "recovery_facility" sends user to RecoveryDashboard
  role?: "provider" | "recovery_facility" | "admin";
  facilityId?: string;
  practiceType?: string;
  // Recovery facility trial/billing fields
  listingStatus?: "active_free" | "trial_expired" | "active_paid" | "suspended";
  freeTrialStartedAt?: string | null;
  // Recovery facility plan tier — free = basic listing, growth = $49/mo, partner = $99/mo
  // "standard" kept for backwards-compat with existing Firestore docs (maps to growth features)
  listingPlan?: "free" | "standard" | "growth" | "partner";
  // ISO timestamp set when provider account is created — used for billing grace period
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isMFAEnrolled: boolean;
  mfaResolver: MultiFactorResolver | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Call after billing setup to pick up new stripePaymentMethodId without page reload
  refreshProfile: () => Promise<void>;
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
  const [profileLoading, setProfileLoading] = useState(true);
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

  // Helper: create a fresh invisible reCAPTCHA verifier attached to a container div.
  //
  // WHY THE WRAPPER PATTERN:
  // RecaptchaVerifier registers the element ID with Google's global reCAPTCHA
  // service. Even after navigating away (e.g. following an email link), the global
  // registration persists. Calling innerHTML="" on the same element doesn't
  // unregister it — only .clear() does. But .clear() is unavailable after a page
  // reload (refs are gone). Replacing the child element with a brand-new DOM node
  // gives reCAPTCHA a fresh, unregistered element each time, eliminating the
  // "reCAPTCHA has already been rendered in this element" error.
  const makeVerifier = (containerId: string): RecaptchaVerifier => {
    const wrapperId = `${containerId}-wrapper`;
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
      // Destroy old child (including any reCAPTCHA iframe it contains), add fresh one
      wrapper.innerHTML = `<div id="${containerId}"></div>`;
    }
    return new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  };

  // ── loadProfileForUser ────────────────────────────────────────────────────
  // Extracted so it can be called both from onAuthStateChanged AND from
  // refreshProfile() (called after billing setup to pick up the new
  // stripePaymentMethodId without requiring a page reload).
  const loadProfileForUser = async (u: User) => {
    setProfileLoading(true);
    try {
      // ── Force token refresh to ensure custom claims are current ──────────
      // Custom claims (provider: true, providerId) are set by the Admin SDK.
      // Firebase caches the JWT for up to 1 hour — force a refresh so we
      // always start with the latest claims.
      await u.getIdToken(/* forceRefresh */ true);

      const snap = await getDoc(doc(db, "providerUsers", u.uid));
      if (snap.exists()) {
        const d = snap.data();

        // ── Ensure custom claims are stamped ────────────────────────────
        // Regular providers onboarded before the claim-stamping flow was
        // added may have a providerUsers document but no custom claims.
        // Without claims, isBookingProvider() and createSetupIntent both
        // fail.  Check the token; if claims are absent or stale, call the
        // ensureProviderClaims Cloud Function then force-refresh so the new
        // claims are in every subsequent Firestore / Functions call.
        const tokenResult = await u.getIdTokenResult(/* forceRefresh */ false);
        const claimedProviderId = tokenResult.claims.providerId as string | undefined;

        if (!tokenResult.claims.provider || claimedProviderId !== d.providerId) {
          try {
            const functions = getFunctions();
            const ensureClaims = httpsCallable(functions, "ensureProviderClaims");
            await ensureClaims({});
            // Fresh token now includes the new claims
            await u.getIdToken(/* forceRefresh */ true);
          } catch (claimsErr) {
            console.warn("ensureProviderClaims failed:", claimsErr);
            // Continue loading the profile even if claims sync fails —
            // the user can still access their profile; only actions that
            // require the custom claim (bookings query, Stripe setup) will
            // be restricted until they sign out and back in.
          }
        }

        // ── Guard: providerId missing means the account is incomplete ───
        // The admin hasn't linked this providerUsers doc to a providers doc
        // yet.  Set a minimal profile so the UI can show an actionable error
        // instead of spinning forever.
        if (!d.providerId) {
          setProviderProfile({
            providerId: "",
            name: d.name || d.facilityName || u.email || "",
            specialty: "",
            email: u.email || "",
            role: (d.role as "provider" | "recovery_facility" | "admin") || "provider",
            plan: d.plan || "founding",
          });
          setProfileLoading(false);
          return;
        }

        const provSnap = await getDoc(doc(db, "providers", d.providerId));
        const prov = provSnap.exists() ? provSnap.data() : {};

        // ── Billing subcollection — provider+admin only ─────────────────────
        // Sensitive fields (stripeCustomerId, stripePaymentMethodId, manualBilling,
        // commissionRate, etc.) moved out of the patient-readable providers doc.
        // Falls back to providerUsers doc fields for providers whose migration
        // hasn't run yet (handles any race during rollout).
        let billing: Record<string, unknown> = {};
        try {
          const billingSnap = await getDoc(
            doc(db, "providers", d.providerId, "billing", "main"),
          );
          billing = billingSnap.exists() ? (billingSnap.data() as Record<string, unknown>) : {};
        } catch (billingErr) {
          // Claims may not be stamped yet — billing data will be absent until
          // next sign-in or manual token refresh.
          console.warn("loadProfileForUser: billing subcollection read failed:", billingErr);
        }

        setProviderProfile({
          providerId: d.providerId,
          name: prov.name || d.facilityName || "",
          specialty: prov.specialty || "",
          email: u.email || "",
          // Prefer billing subcollection; fall back to providerUsers doc for
          // providers who haven't migrated yet.
          stripeCustomerId:
            (billing.stripeCustomerId as string) || d.stripeCustomerId || "",
          stripePaymentMethodId:
            (billing.stripePaymentMethodId as string) || d.stripePaymentMethodId || "",
          manualBilling: (billing.manualBilling as boolean) || d.manualBilling || false,
          plan: d.plan || prov.plan || "founding",
          foundingExpiresAt: (() => {
            const raw = d.foundingExpiresAt || prov.foundingExpiresAt;
            if (!raw) return null;
            if (typeof raw === "string") return raw;
            if (typeof raw?.toDate === "function")
              return raw.toDate().toISOString();
            return null;
          })(),
          role: (d.role as "provider" | "recovery_facility" | "admin") || "provider",
          facilityId: d.facilityId || undefined,
          practiceType: prov.practiceType || d.practiceType || undefined,
          dpcMonthlyFee: typeof prov.dpcMonthlyFee === "number" ? prov.dpcMonthlyFee : null,
          listingStatus: d.listingStatus || undefined,
          listingPlan: (d.listingPlan as "free" | "standard" | "growth") || "free",
          foundingComp: (d.foundingComp as boolean) || (prov.foundingComp as boolean) || false,
          freeTrialStartedAt: (() => {
            const raw = d.freeTrialStartedAt;
            if (!raw) return null;
            if (typeof raw === "string") return raw;
            if (typeof raw?.toDate === "function") return raw.toDate().toISOString();
            return null;
          })(),
          // createdAt — used for billing grace-period countdown.
          // Must handle Firestore Timestamp objects as well as ISO strings.
          createdAt: (() => {
            const raw = d.createdAt;
            if (!raw) return undefined;
            if (typeof raw === "string") return raw;
            if (typeof raw?.toDate === "function") return raw.toDate().toISOString();
            return undefined;
          })(),
        });
      } else {
        setProviderProfile(null);
      }
    } catch {
      setProviderProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // refreshProfile — re-fetches providerUsers + providers docs for the current
  // user.  Call this after billing setup so hasStripe flips to true immediately
  // without requiring a page reload.
  const refreshProfile = async () => {
    const u = auth.currentUser;
    if (!u) return;
    await loadProfileForUser(u);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      // ── Security: immediately wipe stale profile data before any async work ──
      // Without this, a second login (different user or re-auth) would show the
      // previous session's providerProfile for the duration of the Firestore fetch,
      // letting a recovery facility user briefly see a provider's data (or vice versa).
      if (u) {
        setProviderProfile(null);
        setProfileLoading(true);
      }
      setUser(u);
      if (u) {
        await loadProfileForUser(u);
      } else {
        setProviderProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });
    return unsub;
  // loadProfileForUser is defined inside the component — safe to omit from deps
  // (it only ever sees the current closure's state setters, which are stable).
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        profileLoading,
        isMFAEnrolled,
        mfaResolver,
        login,
        logout,
        refreshProfile,
        startMFAEnrollment,
        completeMFAEnrollment,
        cancelMFAEnrollment,
        startMFAChallenge,
        completeMFAChallenge,
      }}
    >
      {/* Invisible reCAPTCHA wrapper divs — makeVerifier replaces the inner child
          each time to get a fresh element and avoid "already rendered" errors */}
      <div id="recaptcha-enroll-wrapper" style={{ display: "none" }}>
        <div id="recaptcha-enroll" />
      </div>
      <div id="recaptcha-challenge-wrapper" style={{ display: "none" }}>
        <div id="recaptcha-challenge" />
      </div>
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
