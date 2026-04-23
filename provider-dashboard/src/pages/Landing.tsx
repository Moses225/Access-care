import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Patient redirect banner ──────────────────────────────────── */}
      <div className="w-full bg-teal-50 border-b border-teal-100 py-2 px-4 text-center text-sm text-teal-800">
        Looking for care as a patient?{" "}
        <a
          href="https://moravacare.com"
          className="font-semibold text-teal-600 underline hover:text-teal-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download the Morava patient app →
        </a>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-10 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <span className="font-display text-xl text-slate-900">Morava</span>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full ml-1">
              for Providers
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </button>
            <a
              href="#apply"
              className="text-sm font-semibold bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Claim your profile →
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 text-sm font-medium px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            Now live on Google Play & App Store · Free to list
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-slate-900 leading-tight mb-6 text-balance">
            Reach patients who need you{" "}
            <span className="italic text-teal-500">most.</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Morava connects Oklahoma SoonerCare and Medicaid patients with
            providers like you. List your practice for free and start receiving
            appointments today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#apply"
              className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5"
            >
              Claim your free profile
            </a>
            <button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              I already have an account
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <section className="bg-slate-900 py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { stat: "199+", label: "Providers listed" },
            { stat: "800K+", label: "SoonerCare members in Oklahoma" },
            { stat: "100%", label: "Free to list your practice" },
          ].map(({ stat, label }) => (
            <div key={label}>
              <div className="font-display text-4xl text-teal-400 mb-1">
                {stat}
              </div>
              <div className="text-slate-400 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-slate-900 mb-4">
              How it works
            </h2>
            <p className="text-slate-500 text-lg">
              Get listed in minutes. Start receiving appointments the same day.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Claim your profile",
                desc: "Fill out the form below. We verify your credentials and create your profile within 24 hours.",
                icon: "📋",
              },
              {
                step: "02",
                title: "Patients find you",
                desc: "SoonerCare patients in Oklahoma search by specialty, location, and availability. Your profile appears instantly.",
                icon: "🔍",
              },
              {
                step: "03",
                title: "Manage bookings",
                desc: "Confirm or decline appointment requests from this dashboard. Patients are notified immediately.",
                icon: "📅",
              },
            ].map(({ step, title, desc, icon }) => (
              <div
                key={step}
                className="bg-white rounded-2xl p-8 border border-slate-100 hover:border-teal-200 transition-colors"
              >
                <div className="text-3xl mb-4">{icon}</div>
                <div className="text-xs font-bold text-teal-500 tracking-widest mb-2">
                  STEP {step}
                </div>
                <h3 className="font-display text-xl text-slate-900 mb-3">
                  {title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-display text-4xl text-slate-900 mb-6 leading-tight">
                Built for providers who accept Medicaid
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Morava is purpose-built for the Oklahoma SoonerCare ecosystem.
                We understand the unique challenges of serving Medicaid patients
                and we've designed every feature with that in mind.
              </p>
              <ul className="space-y-4">
                {[
                  "Free listing — no subscription, no per-appointment fees during launch",
                  "Real-time booking notifications sent to your email",
                  "Every booking includes a patient health summary PDF for your EHR",
                  "Manage in-person and telehealth appointments",
                  "Profile verified and live within 24 hours",
                  "HIPAA-compliant booking and communication",
                  "Dashboard accessible from any device",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-3 h-3 text-teal-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-slate-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-8 text-white">
              <div className="text-teal-400 text-sm font-bold tracking-widest mb-6">
                PROVIDER DASHBOARD PREVIEW
              </div>
              <div className="space-y-3">
                {[
                  {
                    name: "Maria G.",
                    type: "New Patient Visit",
                    time: "Today 9:00 AM",
                    status: "pending",
                  },
                  {
                    name: "James T.",
                    type: "Follow-up",
                    time: "Today 11:30 AM",
                    status: "confirmed",
                  },
                  {
                    name: "Sarah K.",
                    type: "Lab Work",
                    time: "Tomorrow 2:00 PM",
                    status: "pending",
                  },
                ].map((appt) => (
                  <div
                    key={appt.name}
                    className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{appt.name}</div>
                      <div className="text-slate-400 text-xs">
                        {appt.type} · {appt.time}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        appt.status === "confirmed"
                          ? "bg-teal-500/20 text-teal-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {appt.status === "confirmed"
                        ? "✓ Confirmed"
                        : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <div className="flex-1 bg-teal-500 rounded-lg py-2 text-center text-sm font-semibold">
                  Confirm
                </div>
                <div className="flex-1 bg-slate-700 rounded-lg py-2 text-center text-sm font-semibold text-slate-300">
                  Decline
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Apply form ───────────────────────────────────────────────── */}
      <section id="apply" className="py-24 px-6 bg-teal-500">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-teal-100 mb-10">
            Fill out this form and we'll reach out within 24 hours to verify
            your credentials and activate your profile.
          </p>
          <ApplyForm />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-teal-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-display text-white">Morava</span>
          </div>
          <p className="text-slate-500 text-sm">
            © 2026 Morava Care LLC · Oklahoma City, OK · EIN 41-5066125
          </p>
          <div className="flex gap-6">
            <a
              href="https://moses225.github.io/Access-care/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="mailto:support@moravacare.com"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Apply Form ────────────────────────────────────────────────────────────────
function ApplyForm() {
  const [form, setForm] = useState({
    name: "",
    practice: "",
    specialty: "",
    npi: "",
    email: "",
    phone: "",
    city: "",
    insuranceAccepted: [] as string[],
    telehealth: "",
    notificationEmail: "",
    referredBy: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const toggleInsurance = (val: string) => {
    setForm((prev) => ({
      ...prev,
      insuranceAccepted: prev.insuranceAccepted.includes(val)
        ? prev.insuranceAccepted.filter((i) => i !== val)
        : [...prev.insuranceAccepted, val],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, "providerApplications"), {
        ...form,
        status: "pending",
        submittedAt: serverTimestamp(),
        source: "web_dashboard",
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Application submission error:", err);
      alert(
        "Something went wrong. Please try again or email us at support@moravacare.com",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const insuranceOptions = [
    "SoonerCare / Medicaid",
    "Medicare",
    "BlueCross BlueShield",
    "Aetna",
    "UnitedHealthcare",
    "Cigna",
    "Humana",
    "Tricare",
    "CHIP",
    "Self-Pay / Sliding Scale",
    "Out of Pocket",
    "Most Major Insurance",
  ];

  if (submitted)
    return (
      <div className="bg-white rounded-2xl p-10 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="font-display text-2xl text-slate-900 mb-2">
          Application received!
        </h3>
        <p className="text-slate-500">
          We'll reach out to {form.email} within 24 hours to verify your
          credentials and activate your profile. You'll receive booking
          notifications at{" "}
          {form.notificationEmail || form.email}.
        </p>
      </div>
    );

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-8 text-left space-y-5"
    >
      {/* Row 1: Name + Practice */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Full Name"
          value={form.name}
          onChange={set("name")}
          placeholder="Dr. Jane Smith"
          required
        />
        <Field
          label="Practice / Clinic Name"
          value={form.practice}
          onChange={set("practice")}
          placeholder="Smith Family Medicine"
          required
        />
      </div>

      {/* Row 2: Specialty + City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            Specialty *
          </label>
          <select
            value={form.specialty}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, specialty: e.target.value }))
            }
            required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Select specialty...</option>
            {[
              "Family Medicine",
              "Internal Medicine",
              "Pediatrics",
              "OB/GYN",
              "Psychiatry / Mental Health",
              "Cardiology",
              "Dermatology",
              "Orthopedics",
              "Urgent Care",
              "Dental / General Dentistry",
              "Physical Therapy",
              "Occupational Therapy",
              "Chiropractic",
              "Neurology",
              "Oncology",
              "Ophthalmology",
              "Doula Services",
              "Home Health",
              "Other",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="City / Location"
          value={form.city}
          onChange={set("city")}
          placeholder="Oklahoma City, OK"
          required
        />
      </div>

      {/* Row 3: NPI + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="NPI Number"
          value={form.npi}
          onChange={set("npi")}
          placeholder="1234567890"
        />
        <Field
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={set("phone")}
          placeholder="(405) 555-0100"
          required
        />
      </div>

      {/* Row 4: Email + Notification Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="dr.smith@clinic.com"
          required
        />
        <div>
          <Field
            label="Booking Alert Email"
            type="email"
            value={form.notificationEmail}
            onChange={set("notificationEmail")}
            placeholder="frontdesk@clinic.com"
          />
          <p className="text-xs text-slate-400 mt-1">
            Where to send new booking alerts (can be front desk)
          </p>
        </div>
      </div>

      {/* Telehealth */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          Do you offer telehealth?
        </label>
        <div className="flex gap-3">
          {["Yes", "No", "Both in-person and telehealth"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, telehealth: opt }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                form.telehealth === opt
                  ? "bg-teal-500 text-white border-teal-500"
                  : "border-slate-200 text-slate-600 hover:border-teal-300"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Insurance accepted */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          Insurance Accepted (select all that apply)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {insuranceOptions.map((ins) => (
            <button
              key={ins}
              type="button"
              onClick={() => toggleInsurance(ins)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-colors ${
                form.insuranceAccepted.includes(ins)
                  ? "bg-teal-50 text-teal-700 border-teal-400"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {form.insuranceAccepted.includes(ins) ? "✓ " : ""}
              {ins}
            </button>
          ))}
        </div>
      </div>

      {/* Referred by */}
      <Field
        label="Referred by (optional)"
        value={form.referredBy}
        onChange={set("referredBy")}
        placeholder="Name of person who referred you to Morava"
      />

      {/* Message */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
          Anything else?
        </label>
        <textarea
          value={form.message}
          onChange={set("message")}
          placeholder="Tell us about your practice, hours, or any questions..."
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
      >
        {submitting ? "Sending..." : "Submit application →"}
      </button>
      <p className="text-center text-xs text-slate-400">
        By submitting, you agree to our{" "}
        <a
          href="https://moses225.github.io/Access-care/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Privacy Policy
        </a>
        . We'll never share your information.
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label} {required && "*"}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
      />
    </div>
  );
}
