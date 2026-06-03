# Morava

**Connecting Oklahoma patients with quality healthcare — search, discover, and book local providers in one place.**

Morava is a healthcare technology platform (Morava Care LLC) that helps patients in Oklahoma find healthcare providers and request appointments. It is a multi-sided system: a patient mobile app, a provider web dashboard, a rep & admin portal, and a serverless backend.

> Morava is a technology platform, not a healthcare provider. It does not provide medical advice. See the in-app [Terms of Service](./docs/terms.html) and Privacy Policy for details.

---

## 🧩 Platform Overview

Morava is made up of four surfaces sharing one Firebase backend:

| Surface | Audience | Stack | Location |
|---|---|---|---|
| **Patient app** | Patients | React Native + Expo (iOS/Android) | `app/` |
| **Provider dashboard** | Providers & facility operators | React + Vite (web) | `provider-dashboard/` |
| **Rep portal + Admin** | Recruiting reps & internal admin | Static HTML/JS | `landing/` |
| **Backend** | — | Firebase Cloud Functions (TypeScript) | `functions/` |

---

## 🎯 Key Capabilities

### Patients (mobile app)
- Provider search & discovery with specialty, insurance, distance, and availability filters
- Provider detail profiles and appointment requests
- Recovery housing search with in-app intake requests and status tracking
- Optional health intake profile, transmitted to providers only at booking
- Appointment management (confirm, reschedule, cancel) with push & SMS reminders
- Dependent/family booking, biometric sign-in, dark mode

### Providers (web dashboard)
- Profile, hours, insurance, and listing management
- Real-time booking queue: confirm, decline, reschedule, mark complete/no-show
- EHR-style patient summary per booking + provider-only clinical notes
- Direct Primary Care (DPC) listings with a free-to-list, pay-on-enrollment model
- Recovery housing operator dashboard: live bed availability + intake inbox
- Stripe-backed billing (per-completed-visit for standard providers)
- Multi-factor authentication enforced for clinical providers

### Reps & Admin
- Rep application + OTP-verified provider submission flow
- Submission status tracking
- Admin review, provider onboarding, performance, and payroll tooling

---

## 🛠️ Tech Stack

- **Mobile:** React Native, Expo (SDK 54), Expo Router, TypeScript
- **Web dashboard:** React, Vite, Tailwind CSS, TypeScript
- **Backend:** Firebase — Firestore, Auth, Storage, Cloud Functions (2nd gen)
- **Payments:** Stripe (provider billing)
- **Messaging:** Resend (email), Twilio (SMS), Expo push notifications
- **Monitoring:** Sentry
- **Builds & OTA:** EAS Build + EAS Update

---

## 📂 Repository Structure

```
.
├── app/                    # Patient mobile app (Expo Router screens)
│   ├── (tabs)/             # Main tab navigation (search, appointments, profile)
│   ├── booking/            # Appointment booking flow
│   ├── provider/           # Provider detail screens
│   ├── recovery-housing/   # Recovery housing search + intake
│   └── profile/            # Account, edit, terms, settings
├── provider-dashboard/     # Provider/facility web dashboard (React + Vite)
├── landing/                # Marketing site, rep portal, admin panel (static)
├── functions/              # Firebase Cloud Functions (TypeScript)
├── docs/                   # Terms of Service / Privacy (GitHub Pages)
├── scripts/                # Operational scripts (run with Admin SDK)
├── context/                # Shared React contexts (theme, auth)
├── components/ hooks/ utils/ data/ types/   # Shared app code
├── firestore.rules         # Firestore security rules
├── app.json                # Expo app configuration
└── eas.json                # EAS build & submit profiles
```

---

## 🚀 Getting Started (local development)

### Prerequisites
- Node.js 18+
- npm
- Expo CLI / EAS CLI (`npm i -g eas-cli`)
- iOS Simulator (macOS) or Android Studio

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Provide configuration via environment variables (see below) — never hardcode
cp .env.example .env   # then fill in your own values

# 3. Start the app
npx expo start
```

Sub-projects each have their own dependencies:

```bash
cd provider-dashboard && npm install   # provider web dashboard
cd functions && npm install            # cloud functions
```

---

## 🔐 Security & Configuration

This project follows a strict no-secrets-in-source policy. **Do not commit credentials.**

- **All keys and config come from environment variables**, not source code. Client-side Firebase/Maps config is provided via `EXPO_PUBLIC_*` env vars; server-side secrets are managed through Firebase/EAS secret stores.
- **Service account keys** (`*serviceAccount*.json`, `google-services.json`, `GoogleService-Info.plist`) are git-ignored and must never be staged. Operational scripts authenticate via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
- **Firestore security rules** (`firestore.rules`) enforce least-privilege access: patients see only their own data, providers only their bookings, and privileged collections are Admin-SDK-only.
- **PHI handling** is governed by HIPAA, applicable Business Associate Agreements, and the Privacy Policy. Sensitive health data is transmitted to providers only at the point of booking.
- Contributors are expected to run a local pre-commit hook that scans for hardcoded credentials before committing.

If you discover a security issue, contact **support@moravacare.com** — do not open a public issue.

---

## 📦 Builds & Releases

- **Native builds:** `eas build --platform <ios|android> --profile production`
- **Over-the-air JS updates:** `eas update --channel production` (ships JavaScript-only changes to the matching runtime version; native changes require a new build)
- Version name and Android `versionCode` are managed remotely by EAS (`appVersionSource: "remote"`, auto-increment enabled).

---

## 📄 Legal

- [Terms of Service](./docs/terms.html)
- Privacy Policy (published via GitHub Pages)

© Morava Care LLC · Oklahoma City, OK
