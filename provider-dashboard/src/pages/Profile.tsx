import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

// ── Types ────────────────────────────────────────────────────────
interface Hours {
  open: string;
  close: string;
  closed: boolean;
}
interface ProviderData {
  name: string;
  specialty: string;
  npi: string;
  licenseNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  hospitalAffiliation: string;
  education: string;
  gender: string;
  bio: string;
  officeNotes: string;
  photoURL: string;
  acceptingNewPatients: boolean;
  acceptingPatients: boolean;
  inPerson: boolean;
  telehealth: boolean;
  telehealthAvailable: boolean;
  telehealthOnly: boolean;
  avgVisitMinutes: number;
  typicalWaitDays: number;
  insuranceAccepted: string[];
  languages: string[];
  communicationStyles: string[];
  whoISee: string[];
  visitApproach: string[];
  voucherParticipant: boolean;
  interviewConsult: { offered: boolean };
  hours: { [day: string]: Hours };
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
const DEFAULT_HOURS: Hours = { open: "09:00", close: "17:00", closed: false };
const INSURANCE_OPTIONS = [
  "SoonerCare",
  "Medicare",
  "Medicaid",
  "BlueCross BlueShield",
  "Aetna",
  "Cigna",
  "United Healthcare",
  "Humana",
  "Community Care",
  "Wellcare",
  "Ambetter",
  "CommunityCare",
  "TRICARE",
  "Cash Pay / Self-Pay",
  "Other",
];
const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "Vietnamese",
  "Arabic",
  "Hmong",
  "Somali",
  "French",
  "Mandarin",
  "Other",
];
const COMM_STYLES = [
  "Warm & Conversational",
  "Direct & Clinical",
  "Holistic Approach",
  "Preventive Focus",
  "Evidence-Based",
  "Patient-Led",
];
const WHO_I_SEE = [
  "Adults (18+)",
  "Seniors (65+)",
  "Children (0-12)",
  "Adolescents (13-17)",
  "All Ages",
  "LGBTQ+ Friendly",
  "New Patients Welcome",
];
const VISIT_APPROACH = [
  "In-Office Visits",
  "Telehealth",
  "Home Visits",
  "Group Sessions",
  "Walk-In Welcome",
];
const TIME_OPTIONS = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

function to12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

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

function MultiSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((x) => x !== opt)
        : [...selected, opt],
    );
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(opt)
                ? "bg-teal-500 text-white border-teal-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { providerProfile } = useAuth();
  const [data, setData] = useState<Partial<ProviderData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!providerProfile?.providerId) return;
    getDoc(doc(db, "providers", providerProfile.providerId))
      .then((snap) => {
        if (snap.exists()) setData(snap.data() as ProviderData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [providerProfile?.providerId]);

  const update = (field: string, value: unknown) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const updateHours = (
    day: string,
    field: keyof Hours,
    value: string | boolean,
  ) =>
    setData((prev) => ({
      ...prev,
      hours: {
        ...(prev.hours || {}),
        [day]: { ...(prev.hours?.[day] || DEFAULT_HOURS), [field]: value },
      },
    }));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !providerProfile?.providerId) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("File must be an image.");
      return;
    }
    setPhotoUploading(true);
    setError("");
    const storage = getStorage();
    const storageRef = ref(
      storage,
      `provider-photos/${providerProfile.providerId}/${Date.now()}_${file.name}`,
    );
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) =>
        setPhotoProgress(
          Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
        ),
      () => {
        setError("Photo upload failed. Please try again.");
        setPhotoUploading(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setData((prev) => ({ ...prev, photoURL: url }));
        setPhotoUploading(false);
        setPhotoProgress(0);
      },
    );
  };

  const handleSave = async () => {
    if (!providerProfile?.providerId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const saveData: Record<string, unknown> = {
        bio: data.bio || "",
        officeNotes: data.officeNotes || "",
        website: data.website || "",
        hospitalAffiliation: data.hospitalAffiliation || "",
        education: data.education || "",
        gender: data.gender || "",
        phone: data.phone || "",
        address: data.address || "",
        acceptingNewPatients: data.acceptingNewPatients ?? true,
        acceptingPatients: data.acceptingPatients ?? true,
        inPerson: data.inPerson ?? true,
        telehealth: data.telehealth ?? false,
        telehealthAvailable: data.telehealthAvailable ?? false,
        telehealthOnly: data.telehealthOnly ?? false,
        avgVisitMinutes: data.avgVisitMinutes || 30,
        typicalWaitDays: data.typicalWaitDays || 5,
        insuranceAccepted: data.insuranceAccepted || [],
        languages: data.languages || [],
        communicationStyles: data.communicationStyles || [],
        whoISee: data.whoISee || [],
        visitApproach: data.visitApproach || [],
        voucherParticipant: data.voucherParticipant ?? false,
        "interviewConsult.offered": data.interviewConsult?.offered ?? false,
        hours: data.hours || {},
        lastUpdatedBy: "provider",
        lastUpdated: new Date(),
      };
      if (data.photoURL) saveData.photoURL = data.photoURL;
      await updateDoc(
        doc(db, "providers", providerProfile.providerId),
        saveData,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const section = (
    title: string,
    subtitle: string,
    icon: string,
    children: React.ReactNode,
  ) => (
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

  const input = (
    label: string,
    field: keyof ProviderData,
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
        onChange={(e) => !readOnly && update(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all ${readOnly ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`}
      />
      {readOnly && (
        <p className="text-xs text-slate-400 mt-1">Managed by Morava admin</p>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors mb-4"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </a>
      </div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-bold text-2xl text-slate-900">Your Profile</h1>
          <p className="text-slate-400 text-sm mt-1">
            This information appears on your Morava listing. Keep it current.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-teal-600 text-sm font-medium">✓ Saved!</span>
          )}
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
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>

      {/* SECTION 1 — Public Profile */}
      {section(
        "Public Profile",
        "Visible to patients searching for providers",
        "👤",
        <div className="space-y-5">
          {/* Photo upload */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Profile Photo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex-shrink-0">
                {data.photoURL ? (
                  <img
                    src={data.photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-3xl">
                    👤
                  </div>
                )}
              </div>
              <div>
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoUploading}
                  className="border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {photoUploading
                    ? `Uploading ${photoProgress}%...`
                    : "Upload photo"}
                </button>
                <p className="text-xs text-slate-400 mt-1">
                  JPG, PNG or WebP · Max 5MB · Square photos work best
                </p>
              </div>
            </div>
          </div>

          {/* Read-only identity fields */}
          <div className="grid grid-cols-2 gap-4">
            {input("Full Name", "name", "", "text", true)}
            {input("Specialty", "specialty", "", "text", true)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {input("NPI Number", "npi", "", "text", true)}
            {input("License Number", "licenseNumber", "", "text", true)}
          </div>

          {/* Editable fields */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Bio
            </label>
            <textarea
              value={data.bio || ""}
              onChange={(e) => update("bio", e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell patients about your background, training, and approach to care..."
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              {(data.bio || "").length}/500 characters
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Welcome Message
            </label>
            <textarea
              value={data.officeNotes || ""}
              onChange={(e) => update("officeNotes", e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="A short note to patients about what to expect..."
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {input("Gender", "gender", "e.g. Male, Female, Non-binary")}
            {input(
              "Hospital Affiliation",
              "hospitalAffiliation",
              "e.g. OU Medical Center",
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {input(
              "Education",
              "education",
              "e.g. OU College of Medicine, 2004",
            )}
            {input("Website", "website", "https://yourclinic.com")}
          </div>
        </div>,
      )}

      {/* SECTION 2 — Practice Info */}
      {section(
        "Practice Information",
        "Contact and location details",
        "🏥",
        <div className="space-y-4">
          {input("Office Phone", "phone", "(405) 555-0100")}
          {input("Office Address", "address", "123 Main St, Suite 100")}
          <div className="grid grid-cols-3 gap-4">
            {input("City", "city")}
            {input("State", "state")}
            {input("ZIP", "zip")}
          </div>
        </div>,
      )}

      {/* SECTION 3 — Availability */}
      {section(
        "Availability",
        "Control how patients can book with you",
        "📅",
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Toggle
              checked={data.acceptingNewPatients ?? true}
              onChange={(v) => update("acceptingNewPatients", v)}
              label="Accepting new patients"
            />
            <Toggle
              checked={data.inPerson ?? true}
              onChange={(v) => update("inPerson", v)}
              label="In-person visits"
            />
            <Toggle
              checked={data.telehealth ?? false}
              onChange={(v) => update("telehealth", v)}
              label="Telehealth available"
            />
            <Toggle
              checked={data.telehealthOnly ?? false}
              onChange={(v) => update("telehealthOnly", v)}
              label="Telehealth only"
            />
            <Toggle
              checked={data.voucherParticipant ?? false}
              onChange={(v) => update("voucherParticipant", v)}
              label="Voucher program participant"
            />
            <Toggle
              checked={data.interviewConsult?.offered ?? false}
              onChange={(v) =>
                setData((prev) => ({
                  ...prev,
                  interviewConsult: { offered: v },
                }))
              }
              label="Free meet & greet offered"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Avg Visit Length (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={data.avgVisitMinutes || 30}
                onChange={(e) =>
                  update("avgVisitMinutes", parseInt(e.target.value))
                }
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Typical Wait (days)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                value={data.typicalWaitDays || 5}
                onChange={(e) =>
                  update("typicalWaitDays", parseInt(e.target.value))
                }
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Office hours */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              Office Hours
            </label>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const h = data.hours?.[day] || DEFAULT_HOURS;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-24 flex-shrink-0">
                      <span className="text-sm text-slate-700 font-medium">
                        {DAY_LABELS[day].slice(0, 3)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateHours(day, "closed", !h.closed)}
                      className={`w-20 text-xs font-medium px-2 py-1 rounded-full border transition-colors flex-shrink-0 ${
                        h.closed
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                          : "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100"
                      }`}
                    >
                      {h.closed ? "✕ Closed" : "✓ Open"}
                    </button>
                    {!h.closed && (
                      <>
                        <select
                          value={h.open}
                          onChange={(e) =>
                            updateHours(day, "open", e.target.value)
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {to12(t)}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400 text-xs">to</span>
                        <select
                          value={h.close}
                          onChange={(e) =>
                            updateHours(day, "close", e.target.value)
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {to12(t)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
      )}

      {/* SECTION 4 — Insurance & Languages */}
      {section(
        "Insurance & Access",
        "Help patients find you by their coverage",
        "🏥",
        <div className="space-y-6">
          <MultiSelect
            options={INSURANCE_OPTIONS}
            selected={data.insuranceAccepted || []}
            onChange={(v) => update("insuranceAccepted", v)}
            label="Insurance Accepted"
          />
          <MultiSelect
            options={LANGUAGE_OPTIONS}
            selected={data.languages || []}
            onChange={(v) => update("languages", v)}
            label="Languages Spoken"
          />
        </div>,
      )}

      {/* SECTION 5 — Care Style */}
      {section(
        "Care Style",
        "Help patients understand your approach",
        "💬",
        <div className="space-y-6">
          <MultiSelect
            options={COMM_STYLES}
            selected={data.communicationStyles || []}
            onChange={(v) => update("communicationStyles", v)}
            label="Communication Style"
          />
          <MultiSelect
            options={WHO_I_SEE}
            selected={data.whoISee || []}
            onChange={(v) => update("whoISee", v)}
            label="Who I See"
          />
          <MultiSelect
            options={VISIT_APPROACH}
            selected={data.visitApproach || []}
            onChange={(v) => update("visitApproach", v)}
            label="Visit Types Offered"
          />
        </div>,
      )}

      {/* Save button bottom */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        {saved && (
          <span className="text-teal-600 text-sm font-medium">
            ✓ All changes saved!
          </span>
        )}
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
  );
}
