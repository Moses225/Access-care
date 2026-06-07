// ================================================================
// RECOVERY FACILITY PROFILE
// provider-dashboard/src/pages/RecoveryProfile.tsx
//
// Profile editor purpose-built for recovery housing operators.
// Reads/writes to /recoveryHousing/{facilityId} — NOT /providers.
// Shares the shell (NavBar, top nav) with the provider dashboard
// but all fields, sections and copy are recovery-specific.
// ================================================================

import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

// ── Types ─────────────────────────────────────────────────────────────────────
type GenderServed = "men" | "women" | "co-ed" | "lgbtq_affirming";
type HousingLevel = "level_1" | "level_2" | "level_3" | "level_4";

interface FacilityProfile {
  facilityName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  // Legacy single photo (kept for backwards compat) + new gallery
  photoURL?: string;
  photoURLs?: string[];         // Standard+: up to 8 photos
  videoURL?: string;            // Standard+: YouTube or Vimeo URL
  genderServed: GenderServed;
  childrenAllowed: boolean;
  minimumAge: number;
  sobrietyRequirementDays: number;
  acceptsWithActiveMentalHealth: boolean;
  acceptsWithCriminalHistory: boolean;
  medicationAssistedTreatment: boolean;
  requiresInterview: boolean;
  intakeNotes: string;
  acceptsMedicaid: boolean;
  acceptsVouchers: boolean;
  acceptsODMHSAS: boolean;
  acceptsSAMHSA: boolean;
  acceptsDHS: boolean;
  slidingScale: boolean;
  acceptsPrivateInsurance: boolean;
  monthlyRate: number;
  ratePeriod?: "weekly" | "biweekly" | "monthly";
  okarrCertified: boolean;
  oxfordHouseAffiliated: boolean;
  odmhsasLicensed: boolean;
  housingLevel: HousingLevel;
  isTransitional: boolean;
  maxStayMonths: number;
  maxStayUnit?: "days" | "weeks" | "months";
  mealsProvided: boolean;
  transportationProvided: boolean;
  employmentSupport: boolean;
  peersupport: boolean;
  onSiteCounseling: boolean;
  curfew: string;
  houseRules: string;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  servicesOffered: string[];
}

// ── Small reusable components ──────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-teal-500" : "bg-slate-200"}`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </div>
      <span className="text-sm text-slate-700 group-hover:text-slate-900">
        {label}
      </span>
    </label>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <span className="text-2xl">{icon}</span>
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">{title}</h2>
          <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecoveryProfile() {
  const { providerProfile, logout } = useAuth();
  const navigate = useNavigate();
  const facilityId  = providerProfile?.facilityId;
  const listingPlan = (providerProfile?.listingPlan ?? "free") as "free" | "standard" | "growth";
  const isStandardPlus = listingPlan === "standard" || listingPlan === "growth";
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); navigate("/login"); } catch { setLoggingOut(false); }
  };

  const [data, setData] = useState<Partial<FacilityProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [newService, setNewService] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!facilityId) { setLoading(false); return; }
    getDoc(doc(db, "recoveryHousing", facilityId))
      .then((snap) => {
        if (snap.exists()) setData(snap.data() as FacilityProfile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [facilityId]);

  const set = (field: keyof FacilityProfile, value: unknown) =>
    setData((prev) => ({ ...prev, [field]: value }));

  // ── Photo upload ─────────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!facilityId) { setError("No facility linked to this account — cannot upload."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Photo must be under 10MB."); return; }
    if (!file.type.startsWith("image/")) { setError("File must be an image."); return; }
    setPhotoUploading(true);
    setError("");
    const storageRef = ref(getStorage(), `facility-photos/${facilityId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => setPhotoProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err: any) => {
        console.error("[cover upload] failed:", err?.code, err?.message, err);
        setError(`Photo upload failed: ${err?.code || err?.message || "unknown"}`);
        setPhotoUploading(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        set("photoURL", url);
        setPhotoUploading(false);
        setPhotoProgress(0);
      },
    );
  };

  // ── Gallery upload (Standard+, up to 8 photos) ──────────────────────────────
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !facilityId) return;
    const current = data.photoURLs || [];
    const slots   = 8 - current.length;
    if (slots <= 0) { setError("Gallery is full (8 photos max)."); return; }
    const toUpload = files.slice(0, slots);
    for (const f of toUpload) {
      if (f.size > 6 * 1024 * 1024) { setError(`${f.name} is too large (6 MB max).`); continue; }
      if (!f.type.startsWith("image/")) { setError(`${f.name} is not an image.`); continue; }
    }
    setGalleryUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const f of toUpload) {
        const storageRef = ref(getStorage(), `facility-photos/${facilityId}/gallery_${Date.now()}_${f.name}`);
        const task = uploadBytesResumable(storageRef, f);
        const url = await new Promise<string>((resolve, reject) => {
          task.on("state_changed", null, reject, async () => {
            resolve(await getDownloadURL(task.snapshot.ref));
          });
        });
        urls.push(url);
      }
      set("photoURLs", [...current, ...urls]);
    } catch (err: any) {
      console.error("[gallery upload] failed:", err?.code, err?.message, err);
      setError(`Gallery upload failed: ${err?.code || err?.message || "unknown"}`);
    } finally {
      setGalleryUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const removeGalleryPhoto = (idx: number) =>
    set("photoURLs", (data.photoURLs || []).filter((_, i) => i !== idx));

  // ── Video URL helper (extract YouTube/Vimeo embed ID) ────────────────────────
  const getEmbedURL = (url: string): string | null => {
    if (!url) return null;
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
  };

  // ── Services list helpers ────────────────────────────────────────────────────
  const addService = () => {
    const s = newService.trim();
    if (!s) return;
    set("servicesOffered", [...(data.servicesOffered || []), s]);
    setNewService("");
  };
  const removeService = (i: number) =>
    set("servicesOffered", (data.servicesOffered || []).filter((_, idx) => idx !== i));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!facilityId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        phone:                      data.phone || "",
        email:                      data.email || "",
        website:                    data.website || "",
        description:                data.description || "",
        genderServed:               data.genderServed || "co-ed",
        childrenAllowed:            data.childrenAllowed ?? false,
        minimumAge:                 data.minimumAge || 18,
        sobrietyRequirementDays:    data.sobrietyRequirementDays || 0,
        acceptsWithActiveMentalHealth: data.acceptsWithActiveMentalHealth ?? false,
        acceptsWithCriminalHistory: data.acceptsWithCriminalHistory ?? false,
        medicationAssistedTreatment: data.medicationAssistedTreatment ?? false,
        requiresInterview:          data.requiresInterview ?? false,
        intakeNotes:                data.intakeNotes || "",
        acceptsMedicaid:            data.acceptsMedicaid ?? false,
        acceptsVouchers:            data.acceptsVouchers ?? false,
        acceptsODMHSAS:             data.acceptsODMHSAS ?? false,
        acceptsSAMHSA:              data.acceptsSAMHSA ?? false,
        acceptsDHS:                 data.acceptsDHS ?? false,
        slidingScale:               data.slidingScale ?? false,
        acceptsPrivateInsurance:    data.acceptsPrivateInsurance ?? false,
        monthlyRate:                data.monthlyRate || 0,
        ratePeriod:                 data.ratePeriod || "monthly",
        okarrCertified:             data.okarrCertified ?? false,
        oxfordHouseAffiliated:      data.oxfordHouseAffiliated ?? false,
        odmhsasLicensed:            data.odmhsasLicensed ?? false,
        housingLevel:               data.housingLevel || "level_1",
        isTransitional:             data.isTransitional ?? false,
        maxStayMonths:              data.maxStayMonths || 0,
        maxStayUnit:                data.maxStayUnit || "months",
        mealsProvided:              data.mealsProvided ?? false,
        transportationProvided:     data.transportationProvided ?? false,
        employmentSupport:          data.employmentSupport ?? false,
        peersupport:                data.peersupport ?? false,
        onSiteCounseling:           data.onSiteCounseling ?? false,
        curfew:                     data.curfew || "",
        houseRules:                 data.houseRules || "",
        petsAllowed:                data.petsAllowed ?? false,
        smokingAllowed:             data.smokingAllowed ?? false,
        servicesOffered:            data.servicesOffered || [],
        lastUpdatedBy:              "facility",
        lastUpdated:                new Date(),
      };
      if (data.photoURL)   payload.photoURL   = data.photoURL;
      if (data.photoURLs)  payload.photoURLs  = data.photoURLs;
      if (data.videoURL !== undefined) payload.videoURL = data.videoURL || "";
      await updateDoc(doc(db, "recoveryHousing", facilityId), payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <TopNav profile={providerProfile} onLogout={handleLogout} loggingOut={loggingOut} />
      <NavBar />
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!facilityId) return (
    <div className="min-h-screen bg-slate-50">
      <TopNav profile={providerProfile} onLogout={handleLogout} loggingOut={loggingOut} />
      <NavBar />
      <div className="max-w-lg mx-auto mt-20 text-center px-4">
        <p className="text-2xl mb-2">🌱</p>
        <h2 className="text-lg font-semibold text-slate-700 mb-2">No facility linked</h2>
        <p className="text-slate-500 text-sm">
          Contact{" "}
          <a href="mailto:support@moravacare.com" className="text-teal-600 underline">
            support@moravacare.com
          </a>{" "}
          to link your account to your facility.
        </p>
      </div>
    </div>
  );

  const fieldInput = (
    label: string,
    field: keyof FacilityProfile,
    placeholder = "",
    type = "text",
    readOnly = false,
  ) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={(data[field] as string) || ""}
        readOnly={readOnly}
        onChange={(e) => !readOnly && set(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all ${readOnly ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`}
      />
      {readOnly && <p className="text-xs text-slate-400 mt-1">Managed by Morava admin</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav profile={providerProfile} onLogout={handleLogout} loggingOut={loggingOut} />
      <NavBar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-4">
          <a href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </a>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-bold text-2xl text-slate-900">Facility Profile</h1>
            <p className="text-slate-400 text-sm mt-1">
              This information is shown to patients and case managers searching for housing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-teal-600 text-sm font-medium">✓ Saved!</span>}
            {error && <span className="text-red-500 text-sm">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : "Save changes"}
            </button>
          </div>
        </div>

        {/* ── SECTION 1 — Facility Identity ──────────────────────────────────── */}
        <Section title="Facility Identity" subtitle="Basic info shown on your public listing" icon="🏡">
          <div className="space-y-5">
            {/* Cover photo (all tiers) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Cover Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex-shrink-0">
                  {(data.photoURLs?.[0] || data.photoURL) ? (
                    <img src={data.photoURLs?.[0] || data.photoURL} alt="Facility" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-3xl">🏡</div>
                  )}
                </div>
                <div>
                  <input type="file" ref={fileRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoUploading}
                    className="border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {photoUploading ? `Uploading ${photoProgress}%...` : "Upload cover photo"}
                  </button>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG or WebP · Max 6 MB</p>
                </div>
              </div>
            </div>

            {/* Photo gallery (Standard+) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Photo Gallery
                  <span className="ml-2 text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-200 normal-case tracking-normal">Standard+</span>
                </label>
                <span className="text-xs text-slate-400">{(data.photoURLs || []).length}/8 photos</span>
              </div>

              {!isStandardPlus ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50">
                  <p className="text-sm text-slate-400 mb-2">🔒 Gallery photos are available on Standard and Growth plans</p>
                  <button
                    type="button"
                    onClick={() => navigate("/billing")}
                    className="text-xs text-teal-600 font-semibold hover:text-teal-800 underline"
                  >
                    Upgrade to Standard →
                  </button>
                </div>
              ) : (
                <>
                  {/* Existing gallery grid */}
                  {(data.photoURLs || []).length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {(data.photoURLs || []).map((url, idx) => (
                        <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                          <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeGalleryPhoto(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">Cover</span>
                          )}
                        </div>
                      ))}
                      {/* Empty slots */}
                      {Array.from({ length: Math.max(0, 4 - (data.photoURLs || []).length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 text-xl">
                          +
                        </div>
                      ))}
                    </div>
                  )}

                  {(data.photoURLs || []).length < 8 && (
                    <div>
                      <input
                        type="file"
                        ref={galleryRef}
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        disabled={galleryUploading}
                        className="border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {galleryUploading ? "Uploading..." : `Add photos (${8 - (data.photoURLs || []).length} remaining)`}
                      </button>
                      <p className="text-xs text-slate-400 mt-1">Up to 8 photos · JPG, PNG or WebP · 6 MB each</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Video tour (Standard+) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Video Tour
                <span className="ml-2 text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-200 normal-case tracking-normal">Standard+</span>
              </label>
              {!isStandardPlus ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                  <span>🔒</span>
                  <span>Video tours available on Standard and Growth plans</span>
                </div>
              ) : (
                <>
                  <input
                    type="url"
                    value={data.videoURL || ""}
                    onChange={(e) => set("videoURL", e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">YouTube or Vimeo links — shown as a video player on your listing</p>
                  {data.videoURL && getEmbedURL(data.videoURL) && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 aspect-video">
                      <iframe
                        src={getEmbedURL(data.videoURL)!}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {data.videoURL && !getEmbedURL(data.videoURL) && (
                    <p className="text-xs text-red-500 mt-1">⚠ Paste a YouTube or Vimeo URL to see a preview</p>
                  )}
                </>
              )}
            </div>

            {/* Read-only identity */}
            <div className="grid grid-cols-2 gap-4">
              {fieldInput("Facility Name", "facilityName", "", "text", true)}
              {fieldInput("City", "city", "", "text", true)}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                About This House
              </label>
              <textarea
                value={data.description || ""}
                onChange={(e) => set("description", e.target.value)}
                maxLength={600}
                rows={4}
                placeholder="Tell patients and case managers about your house, your mission, and the community you offer..."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{(data.description || "").length}/600 characters</p>
            </div>

            {/* Services offered */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Services Offered
              </label>
              <p className="text-xs text-slate-400 mb-3">
                List specific services — e.g. "AA/NA meetings on-site", "Job placement assistance", "MAT-friendly"
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(data.servicesOffered || []).map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-medium px-3 py-1.5 rounded-full">
                    {s}
                    <button type="button" onClick={() => removeService(i)} className="text-teal-400 hover:text-red-500 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
                  placeholder="Add a service..."
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={addService}
                  className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── SECTION 2 — Contact Information ────────────────────────────────── */}
        <Section title="Contact Information" subtitle="How patients and case managers reach you" icon="📞">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {fieldInput("Phone Number", "phone", "(405) 555-0100")}
              {fieldInput("Email", "email", "info@yourhouse.org")}
            </div>
            {fieldInput("Website", "website", "https://yourhouse.org")}
          </div>
        </Section>

        {/* ── SECTION 3 — Admissions Criteria ────────────────────────────────── */}
        <Section title="Admissions Criteria" subtitle="Who you serve and what's required to enter" icon="📋">
          <div className="space-y-5">
            {/* Gender served */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Gender Served
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "men",             label: "Men only" },
                    { value: "women",           label: "Women only" },
                    { value: "co-ed",           label: "Co-ed" },
                    { value: "lgbtq_affirming", label: "LGBTQ+ affirming" },
                  ] as { value: GenderServed; label: string }[]
                ).map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${data.genderServed === opt.value ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <input
                      type="radio"
                      name="genderServed"
                      value={opt.value}
                      checked={data.genderServed === opt.value}
                      onChange={() => set("genderServed", opt.value)}
                      className="accent-teal-600"
                    />
                    <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Age & sobriety */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Minimum Age
                </label>
                <input
                  type="number" min={0} max={99}
                  value={data.minimumAge || 18}
                  onChange={(e) => set("minimumAge", parseInt(e.target.value) || 18)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Sobriety Required (days)
                </label>
                <input
                  type="number" min={0} max={365}
                  value={data.sobrietyRequirementDays || 0}
                  onChange={(e) => set("sobrietyRequirementDays", parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">Set 0 if no requirement</p>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <Toggle checked={data.childrenAllowed ?? false} onChange={(v) => set("childrenAllowed", v)} label="Accepts mothers with children" />
              <Toggle checked={data.medicationAssistedTreatment ?? false} onChange={(v) => set("medicationAssistedTreatment", v)} label="MAT-friendly (Suboxone, etc.)" />
              <Toggle checked={data.acceptsWithActiveMentalHealth ?? false} onChange={(v) => set("acceptsWithActiveMentalHealth", v)} label="Accepts active mental health dx" />
              <Toggle checked={data.acceptsWithCriminalHistory ?? false} onChange={(v) => set("acceptsWithCriminalHistory", v)} label="Accepts criminal history" />
            </div>
          </div>
        </Section>

        {/* ── SECTION 4 — Intake Process ──────────────────────────────────────── */}
        <Section title="Intake Process" subtitle="What patients can expect when they apply" icon="📝">
          <div className="space-y-4">
            <Toggle
              checked={data.requiresInterview ?? false}
              onChange={(v) => set("requiresInterview", v)}
              label="Requires an interview or phone screening before admission"
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Intake Notes
              </label>
              <textarea
                value={data.intakeNotes || ""}
                onChange={(e) => set("intakeNotes", e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="Anything patients should know before applying — what to bring, what to expect, how to reach you..."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{(data.intakeNotes || "").length}/400 characters — shown to patients on your profile page</p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 5 — Financial Options ───────────────────────────────────── */}
        <Section title="Financial Options" subtitle="How residents pay for housing" icon="💰">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Toggle checked={data.acceptsMedicaid ?? false}         onChange={(v) => set("acceptsMedicaid", v)}         label="Medicaid accepted" />
              <Toggle checked={data.acceptsVouchers ?? false}         onChange={(v) => set("acceptsVouchers", v)}         label="Vouchers accepted" />
              <Toggle checked={data.acceptsODMHSAS ?? false}          onChange={(v) => set("acceptsODMHSAS", v)}          label="ODMHSAS voucher" />
              <Toggle checked={data.acceptsSAMHSA ?? false}           onChange={(v) => set("acceptsSAMHSA", v)}           label="SAMHSA grant" />
              <Toggle checked={data.acceptsDHS ?? false}              onChange={(v) => set("acceptsDHS", v)}              label="Oklahoma DHS / families" />
              <Toggle checked={data.slidingScale ?? false}            onChange={(v) => set("slidingScale", v)}            label="Sliding scale fees" />
              <Toggle checked={data.acceptsPrivateInsurance ?? false} onChange={(v) => set("acceptsPrivateInsurance", v)} label="Private insurance" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Private-Pay Rate (USD)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number" min={0}
                  value={data.monthlyRate || 0}
                  onChange={(e) => set("monthlyRate", parseInt(e.target.value) || 0)}
                  className="w-32 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-slate-400 text-sm">per</span>
                <select
                  value={data.ratePeriod || "monthly"}
                  onChange={(e) => set("ratePeriod", e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="weekly">week</option>
                  <option value="biweekly">2 weeks</option>
                  <option value="monthly">month</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-1">Set 0 if no private-pay rate or rate varies</p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 6 — Certifications & Housing Type ───────────────────────── */}
        <Section title="Certifications & Housing Type" subtitle="Credentials and structure of your program" icon="🏅">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Toggle checked={data.okarrCertified ?? false}      onChange={(v) => set("okarrCertified", v)}      label="OKARR Certified" />
              <Toggle checked={data.odmhsasLicensed ?? false}     onChange={(v) => set("odmhsasLicensed", v)}     label="ODMHSAS Licensed" />
              <Toggle checked={data.oxfordHouseAffiliated ?? false} onChange={(v) => set("oxfordHouseAffiliated", v)} label="Oxford House affiliated" />
              <Toggle checked={data.isTransitional ?? false}      onChange={(v) => set("isTransitional", v)}      label="Transitional housing" />
            </div>

            {/* Housing level */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Housing Level
              </label>
              <div className="space-y-2">
                {(
                  [
                    { value: "level_1", label: "Level 1", desc: "Social model — peer support only, no on-site staff" },
                    { value: "level_2", label: "Level 2", desc: "Structured — house manager on site" },
                    { value: "level_3", label: "Level 3", desc: "Clinical services on site" },
                    { value: "level_4", label: "Level 4", desc: "Highly structured — 24/7 professional staff" },
                  ] as { value: HousingLevel; label: string; desc: string }[]
                ).map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${data.housingLevel === opt.value ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <input type="radio" name="housingLevel" value={opt.value} checked={data.housingLevel === opt.value} onChange={() => set("housingLevel", opt.value)} className="accent-teal-600 mt-0.5" />
                    <div>
                      <span className="text-sm font-semibold text-slate-700">{opt.label}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Maximum Stay
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0}
                  value={data.maxStayMonths || 0}
                  onChange={(e) => set("maxStayMonths", parseInt(e.target.value) || 0)}
                  className="w-28 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <select
                  value={data.maxStayUnit || "months"}
                  onChange={(e) => set("maxStayUnit", e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-1">Set 0 for no maximum</p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 7 — Amenities ───────────────────────────────────────────── */}
        <Section title="Amenities & Support" subtitle="Resources available to residents" icon="🌿">
          <div className="grid grid-cols-2 gap-4">
            <Toggle checked={data.mealsProvided ?? false}        onChange={(v) => set("mealsProvided", v)}        label="Meals provided" />
            <Toggle checked={data.transportationProvided ?? false} onChange={(v) => set("transportationProvided", v)} label="Transportation assistance" />
            <Toggle checked={data.employmentSupport ?? false}    onChange={(v) => set("employmentSupport", v)}    label="Employment support" />
            <Toggle checked={data.peersupport ?? false}          onChange={(v) => set("peersupport", v)}          label="Peer support / recovery coach" />
            <Toggle checked={data.onSiteCounseling ?? false}     onChange={(v) => set("onSiteCounseling", v)}     label="On-site counseling" />
          </div>
        </Section>

        {/* ── SECTION 8 — House Rules ─────────────────────────────────────────── */}
        <Section title="House Rules" subtitle="Expectations for residents" icon="📌">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Toggle checked={data.petsAllowed ?? false}    onChange={(v) => set("petsAllowed", v)}    label="Pets allowed" />
              <Toggle checked={data.smokingAllowed ?? false} onChange={(v) => set("smokingAllowed", v)} label="Smoking allowed on property" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Curfew
              </label>
              <input
                type="text"
                value={data.curfew || ""}
                onChange={(e) => set("curfew", e.target.value)}
                placeholder="e.g. 10:00 PM weekdays, 11:00 PM weekends"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                House Rules Summary
              </label>
              <textarea
                value={data.houseRules || ""}
                onChange={(e) => set("houseRules", e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Summarize your key house rules — meeting requirements, chores, guest policy, etc."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{(data.houseRules || "").length}/500</p>
            </div>
          </div>
        </Section>

        {/* Bottom save */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          {saved && <span className="text-teal-600 text-sm font-medium">✓ All changes saved!</span>}
          {error && <span className="text-red-500 text-sm">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
          >
            {saving ? "Saving..." : "Save all changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared top nav strip ───────────────────────────────────────────────────────
function TopNav({
  profile,
  onLogout,
  loggingOut,
}: {
  profile: { name?: string; facilityId?: string } | null;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <span className="text-slate-900 text-lg font-semibold">Morava</span>
            <span className="hidden sm:inline text-slate-400 text-sm ml-2">Recovery Housing Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {profile?.name && (
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-slate-700">{profile.name}</div>
              <div className="text-xs text-teal-600 font-medium">Recovery Housing</div>
            </div>
          )}
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loggingOut ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </nav>
  );
}
