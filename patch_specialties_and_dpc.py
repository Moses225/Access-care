"""
patch_specialties_and_dpc.py
Run from project root: python3 patch_specialties_and_dpc.py

Applies ALL specialty, DPC, and new market changes to staging files.
Does NOT touch firestore.rules production — staging only.

Changes:
  1. data/providers.ts — new specialty types + new Provider fields
  2. app/(tabs)/index.tsx — new CATEGORY_CONFIG + Provider interface + filter logic
  3. firestore.rules — staging-safe optional field additions
"""

import re

print("=" * 60)
print("MORAVA — SPECIALTY & DPC EXPANSION PATCH")
print("Target: STAGING (accesscare-staging)")
print("=" * 60)

# ─────────────────────────────────────────────────────────────────
# FILE 1: data/providers.ts
# Add new specialty types and new Provider interface fields
# ─────────────────────────────────────────────────────────────────

with open("data/providers.ts", "r") as f:
    providers_ts = f.read()

# 1a. Add new specialty types to ProviderSpecialty union
old_specialty_type = """export type ProviderSpecialty = 
  // Core Services
  | 'OB/GYN'
  | 'Midwife'
  | 'Hospital'
  | 'Family Medicine'
  | 'Pediatrician'
  | 'Dietitian'
  | 'Internal Medicine'
  | 'Dermatology'
  | 'General Surgery'
  
  // Extended Services
  | 'Maternal-Fetal Medicine'
  | 'Lactation Consultant'
  | 'Nutritionist'
  | 'Mental Health Provider'
  | 'Physical Therapist'
  | 'Social Worker'
  | 'Doula Services'
  | 'Home Health Agency'
  | 'Psychiatry'
  | 'Licensed Alcohol and Drug Counselor'
  | 'Diagnostic Radiology'
  
  // Rare & Specialized
  | 'Reproductive Endocrinologist'
  | 'Neonatologist'
  | 'Genetic Counselor'
  | 'Perinatal Mental Health'
  | 'Rheumatologist'
  | 'Infectious Disease'
  | 'Palliative Care'
  | 'Rare Disease Center';"""

new_specialty_type = """export type ProviderSpecialty = 
  // Core Services
  | 'OB/GYN'
  | 'Midwife'
  | 'Hospital'
  | 'Family Medicine'
  | 'Pediatrician'
  | 'Dietitian'
  | 'Internal Medicine'
  | 'Dermatology'
  | 'General Surgery'

  // Extended Services
  | 'Maternal-Fetal Medicine'
  | 'Lactation Consultant'
  | 'Nutritionist'
  | 'Mental Health Provider'
  | 'Physical Therapist'
  | 'Social Worker'
  | 'Doula Services'
  | 'Home Health Agency'
  | 'Psychiatry'
  | 'Licensed Alcohol and Drug Counselor'
  | 'Diagnostic Radiology'

  // Rare & Specialized
  | 'Reproductive Endocrinologist'
  | 'Neonatologist'
  | 'Genetic Counselor'
  | 'Perinatal Mental Health'
  | 'Rheumatologist'
  | 'Infectious Disease'
  | 'Palliative Care'
  | 'Rare Disease Center'

  // New Markets — added May 2026
  | 'Direct Primary Care'        // DPC membership model
  | 'Concierge Medicine'         // Premium membership model
  | 'Telehealth'                 // Telehealth-only providers
  | 'FQHC'                       // Federally Qualified Health Centers
  | 'Tribal Health'              // IHS and tribal health systems
  | 'Occupational Health'        // Workers comp, DOT physicals
  | 'School-Based Health'        // School clinic providers
  | 'Recovery Housing'           // Sober living / transitional housing
  | 'Addiction Medicine'         // Addiction medicine specialists
  | 'Chronic Disease Management' // Diabetes, hypertension management
  | 'Postpartum Care'            // Postpartum and maternal mental health
  | 'Oral Surgery'               // Oral and maxillofacial surgery
  | 'Hematology & Oncology'      // Blood disorders and cancer
  | 'Pulmonary Critical Care Medicine' // Pulmonary and critical care
  | 'Occupational Therapist';    // OT for rehab and pediatrics"""

if old_specialty_type in providers_ts:
    providers_ts = providers_ts.replace(old_specialty_type, new_specialty_type)
    print("✅ FILE 1a: ProviderSpecialty union expanded (14 new types)")
else:
    print("❌ FILE 1a: ProviderSpecialty pattern not found")

# 1b. Add new fields to Provider interface
old_provider_interface = """export interface Provider {
  id: string;
  name: string;
  specialty: ProviderSpecialty | string; // Allow any specialty from Firebase
  category: ProviderCategory;
  distance: number;
  rating: number;
  address: string;
  phone: string;
  available: boolean;
  latitude: number;
  longitude: number;
  services?: string[];
}"""

new_provider_interface = """export type PracticeType =
  | 'standard'         // Regular fee-for-service
  | 'dpc'              // Direct Primary Care membership
  | 'concierge'        // Concierge/premium membership
  | 'fqhc'             // Federally Qualified Health Center
  | 'tribal'           // IHS or tribal health system
  | 'telehealth_only'  // Telehealth-only practice
  | 'recovery_housing' // Sober living / recovery housing
  | 'school_based';    // School-based health center

export interface Provider {
  id: string;
  name: string;
  specialty: ProviderSpecialty | string;
  category: ProviderCategory;
  distance: number;
  rating: number;
  address: string;
  phone: string;
  available: boolean;
  latitude: number;
  longitude: number;
  services?: string[];

  // New fields — May 2026 market expansion
  practiceType?: PracticeType;        // Practice model type
  dpcMonthlyFee?: number;             // DPC monthly membership fee
  dpcDescription?: string;            // DPC what's included text
  telehealthAvailable?: boolean;      // Offers telehealth visits
  telehealthOnly?: boolean;           // Telehealth visits only, no in-person
  acceptsSelfPay?: boolean;           // Accepts self-pay / uninsured
  acceptsMedicaid?: boolean;          // Explicitly accepts Medicaid/SoonerCare
  fqhc?: boolean;                     // Is an FQHC
  tribal?: boolean;                   // Is a tribal health facility
  slidingScale?: boolean;             // Offers sliding scale fees
  verified?: boolean;                 // Morava-verified provider
  npi?: string;                       // NPI number
  city?: string;                      // City
  state?: string;                     // State
}"""

if old_provider_interface in providers_ts:
    providers_ts = providers_ts.replace(old_provider_interface, new_provider_interface)
    print("✅ FILE 1b: Provider interface expanded (12 new optional fields + PracticeType)")
else:
    print("❌ FILE 1b: Provider interface pattern not found")

# 1c. Update providerCategories to include new specialties
old_extended = """  'Extended Services': [
    'Maternal-Fetal Medicine',
    'Lactation Consultant',
    'Nutritionist',
    'Mental Health Provider',
    'Physical Therapist',"""

new_extended = """  'Extended Services': [
    'Maternal-Fetal Medicine',
    'Lactation Consultant',
    'Nutritionist',
    'Mental Health Provider',
    'Physical Therapist',
    'Direct Primary Care',
    'Concierge Medicine',
    'Telehealth',
    'FQHC',
    'Tribal Health',
    'Occupational Health',
    'School-Based Health',
    'Addiction Medicine',
    'Chronic Disease Management',
    'Postpartum Care',
    'Hematology & Oncology',
    'Pulmonary Critical Care Medicine',
    'Occupational Therapist',"""

if old_extended in providers_ts:
    providers_ts = providers_ts.replace(old_extended, new_extended)
    print("✅ FILE 1c: providerCategories Extended Services updated")
else:
    print("❌ FILE 1c: Extended Services pattern not found")

with open("data/providers.ts", "w") as f:
    f.write(providers_ts)
print("✅ FILE 1: data/providers.ts saved\n")

# ─────────────────────────────────────────────────────────────────
# FILE 2: app/(tabs)/index.tsx
# Add new CATEGORY_CONFIG entries + Provider interface fields +
# filter logic for DPC, telehealth, self-pay
# ─────────────────────────────────────────────────────────────────

with open("app/(tabs)/index.tsx", "r") as f:
    index_tsx = f.read()

# 2a. Add new categories to CATEGORY_CONFIG
old_ortho_end = """  Orthopedics: {
    icon: "🦴",
    color: "#3F51B5",
    searchTerms: ["orthopedic", "orthopedics", "bone", "joint"],
  },
};"""

new_ortho_end = """  Orthopedics: {
    icon: "🦴",
    color: "#3F51B5",
    searchTerms: ["orthopedic", "orthopedics", "bone", "joint"],
  },

  // ── New market categories — May 2026 ─────────────────────────
  "Direct Primary Care": {
    icon: "🏥",
    color: "#00838F",
    searchTerms: ["direct primary care", "dpc", "concierge medicine", "membership"],
  },
  "Behavioral Health": {
    icon: "🧩",
    color: "#7C3AED",
    searchTerms: [
      "mental health", "psychiatry", "psychology", "therapist",
      "counselor", "behavioral", "ladc", "alcohol", "drug",
      "addiction", "recovery", "substance",
    ],
  },
  "Telehealth": {
    icon: "📱",
    color: "#0EA5E9",
    searchTerms: ["telehealth", "telemedicine", "virtual", "remote visit"],
  },
  "FQHC & Community": {
    icon: "🏘️",
    color: "#059669",
    searchTerms: [
      "fqhc", "community health", "federally qualified",
      "community clinic", "variety care", "chci",
    ],
  },
  "Tribal Health": {
    icon: "🪶",
    color: "#92400E",
    searchTerms: [
      "tribal", "ihs", "indian health", "cherokee", "choctaw",
      "chickasaw", "creek", "seminole", "osage", "pawnee",
    ],
  },
  "Occupational Health": {
    icon: "🦺",
    color: "#D97706",
    searchTerms: [
      "occupational health", "workers comp", "dot physical",
      "work injury", "occupational medicine",
    ],
  },
  "Maternal Health": {
    icon: "👶",
    color: "#EC4899",
    searchTerms: [
      "obgyn", "ob/gyn", "obstetrics", "gynecology", "midwife",
      "doula", "maternal", "postpartum", "lactation",
      "maternal-fetal", "perinatal",
    ],
  },
  "Chronic Disease": {
    icon: "💊",
    color: "#DC2626",
    searchTerms: [
      "diabetes", "endocrinology", "chronic disease",
      "hypertension", "dietitian", "nutrition",
    ],
  },
  "Recovery & Sobriety": {
    icon: "🌱",
    color: "#16A34A",
    searchTerms: [
      "recovery", "sober living", "recovery housing",
      "addiction", "substance use", "ladc", "alcohol",
      "drug counselor",
    ],
  },
};"""

if old_ortho_end in index_tsx:
    index_tsx = index_tsx.replace(old_ortho_end, new_ortho_end)
    print("✅ FILE 2a: CATEGORY_CONFIG expanded (9 new categories)")
else:
    print("❌ FILE 2a: CATEGORY_CONFIG end pattern not found")

# 2b. Update Provider interface in index.tsx to include new fields
old_provider_iface = """interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  insuranceAccepted: string[];
  category?: string;
  categories?: string[];
  city?: string;
  state?: string;
  verified?: boolean;
  hospitalAffiliation?: string;
}"""

new_provider_iface = """interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  insuranceAccepted: string[];
  category?: string;
  categories?: string[];
  city?: string;
  state?: string;
  verified?: boolean;
  hospitalAffiliation?: string;
  // New fields — May 2026
  practiceType?: string;
  dpcMonthlyFee?: number;
  dpcDescription?: string;
  telehealthAvailable?: boolean;
  telehealthOnly?: boolean;
  acceptsSelfPay?: boolean;
  acceptsMedicaid?: boolean;
  fqhc?: boolean;
  tribal?: boolean;
  slidingScale?: boolean;
}"""

if old_provider_iface in index_tsx:
    index_tsx = index_tsx.replace(old_provider_iface, new_provider_iface)
    print("✅ FILE 2b: Provider interface in index.tsx expanded")
else:
    print("❌ FILE 2b: Provider interface pattern not found")

# 2c. Update loadProviders to map new fields from Firestore
old_push = """        providersList.push({
          id: docSnap.id,
          name: data.name,
          specialty: data.specialty,
          address: data.address || "",
          phone: data.phone || "",
          rating: safeRating,
          acceptsNewPatients:
            data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
          location: { latitude: safeLatitude, longitude: safeLongitude },
          latitude: safeLatitude,
          longitude: safeLongitude,
          insuranceAccepted: safeInsurance,
          category: data.category || "",
          categories: safeCategories,
          city: data.city || "",
          state: data.state || "Oklahoma",
          verified: data.verified ?? false,
          hospitalAffiliation:
            typeof data.hospitalAffiliation === "string"
              ? data.hospitalAffiliation
              : "",
        });"""

new_push = """        providersList.push({
          id: docSnap.id,
          name: data.name,
          specialty: data.specialty,
          address: data.address || "",
          phone: data.phone || "",
          rating: safeRating,
          acceptsNewPatients:
            data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
          location: { latitude: safeLatitude, longitude: safeLongitude },
          latitude: safeLatitude,
          longitude: safeLongitude,
          insuranceAccepted: safeInsurance,
          category: data.category || "",
          categories: safeCategories,
          city: data.city || "",
          state: data.state || "Oklahoma",
          verified: data.verified ?? false,
          hospitalAffiliation:
            typeof data.hospitalAffiliation === "string"
              ? data.hospitalAffiliation
              : "",
          // New fields — May 2026
          practiceType: data.practiceType || "standard",
          dpcMonthlyFee: typeof data.dpcMonthlyFee === "number" ? data.dpcMonthlyFee : undefined,
          dpcDescription: typeof data.dpcDescription === "string" ? data.dpcDescription : undefined,
          telehealthAvailable: data.telehealthAvailable ?? data.telehealthOnly ?? false,
          telehealthOnly: data.telehealthOnly ?? false,
          acceptsSelfPay: data.acceptsSelfPay ?? false,
          acceptsMedicaid: data.acceptsMedicaid ?? false,
          fqhc: data.fqhc ?? false,
          tribal: data.tribal ?? false,
          slidingScale: data.slidingScale ?? false,
        });"""

if old_push in index_tsx:
    index_tsx = index_tsx.replace(old_push, new_push)
    print("✅ FILE 2c: loadProviders maps new Firestore fields")
else:
    print("❌ FILE 2c: providersList.push pattern not found")

with open("app/(tabs)/index.tsx", "w") as f:
    f.write(index_tsx)
print("✅ FILE 2: app/(tabs)/index.tsx saved\n")

# ─────────────────────────────────────────────────────────────────
# FILE 3: data/recoveryHousing.ts — NEW FILE
# Type definitions and Firestore mapping for recovery housing
# ─────────────────────────────────────────────────────────────────

recovery_housing_ts = '''// ================================================================
// RECOVERY HOUSING — Type Definitions
// Morava Care LLC — May 2026
//
// Recovery housing is a SEPARATE collection from providers.
// Collection: recoveryHousing/{facilityId}
//
// This module defines the data structure and Firestore mapping
// for sober living and transitional housing facilities.
// ================================================================

export type GenderServed = 'men' | 'women' | 'co-ed' | 'lgbtq_affirming';
export type HousingLevel =
  | 'level_1'   // Social model, peer support only
  | 'level_2'   // Structured, house manager on site
  | 'level_3'   // Clinical services on site
  | 'level_4';  // Highly structured, staff 24/7

export interface RecoveryHousingFacility {
  id: string;

  // Identity
  facilityName: string;
  operatorName?: string;         // Who runs it
  phone: string;
  email?: string;
  website?: string;

  // Location
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  region?: string;               // okc | tulsa | rural

  // Availability (updated by facility staff)
  totalBeds: number;
  availableBeds: number;         // -1 = contact for availability
  availabilityUpdatedAt?: Date;

  // Admissions criteria
  genderServed: GenderServed;
  sobrietyRequirementDays?: number;  // Min days sober to enter (0 = no requirement)
  minimumAge?: number;
  maximumAge?: number;
  acceptsWithActiveMentalHealth?: boolean;
  acceptsWithCriminalHistory?: boolean;
  medicationAssistedTreatment?: boolean;  // MAT allowed (Suboxone, Methadone)

  // Financial
  monthlyRate?: number;
  acceptsMedicaid?: boolean;
  acceptsVouchers?: boolean;     // ODMHSAS, county vouchers
  acceptsODMHSAS?: boolean;
  acceptsSAMHSA?: boolean;
  slidingScale?: boolean;
  acceptsPrivateInsurance?: boolean;

  // Certifications
  okarrCertified?: boolean;      // Oklahoma Association of Recovery Residences
  oxfordHouseAffiliated?: boolean;
  odmhsasLicensed?: boolean;

  // Housing type
  housingLevel?: HousingLevel;
  isTransitional?: boolean;      // Short-term transitional vs long-term sober living
  maxStayMonths?: number;        // Max stay in months (undefined = no limit)

  // Amenities (visible to patients)
  mealsProvided?: boolean;
  transportationProvided?: boolean;
  employmentSupport?: boolean;
  peersupport?: boolean;
  onSiteCounseling?: boolean;
  curfew?: string;               // e.g. "10pm weekdays, midnight weekends"

  // What IS and IS NOT allowed
  houseRules?: string;           // Free text house rules
  petsAllowed?: boolean;
  smokingAllowed?: boolean;

  // Photos (array of Firebase Storage URLs)
  photos?: string[];             // Exterior and common areas only

  // Morava admin fields
  verified?: boolean;
  active?: boolean;
  displayAvailability?: boolean; // If false, show "Contact for availability"
  notes?: string;                // Internal notes, not shown to patients
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Firestore field mapping ───────────────────────────────────────
export function mapFirestoreToFacility(
  id: string,
  data: Record<string, unknown>
): RecoveryHousingFacility {
  return {
    id,
    facilityName: (data.facilityName as string) || "Unknown Facility",
    operatorName: data.operatorName as string | undefined,
    phone: (data.phone as string) || "",
    email: data.email as string | undefined,
    website: data.website as string | undefined,
    address: (data.address as string) || "",
    city: (data.city as string) || "",
    state: (data.state as string) || "Oklahoma",
    zip: (data.zip as string) || "",
    latitude: data.latitude as number | undefined,
    longitude: data.longitude as number | undefined,
    region: data.region as string | undefined,
    totalBeds: (data.totalBeds as number) || 0,
    availableBeds: data.availableBeds !== undefined ? (data.availableBeds as number) : -1,
    genderServed: (data.genderServed as GenderServed) || "co-ed",
    sobrietyRequirementDays: data.sobrietyRequirementDays as number | undefined,
    minimumAge: data.minimumAge as number | undefined,
    maximumAge: data.maximumAge as number | undefined,
    acceptsWithActiveMentalHealth: data.acceptsWithActiveMentalHealth as boolean | undefined,
    acceptsWithCriminalHistory: data.acceptsWithCriminalHistory as boolean | undefined,
    medicationAssistedTreatment: data.medicationAssistedTreatment as boolean | undefined,
    monthlyRate: data.monthlyRate as number | undefined,
    acceptsMedicaid: (data.acceptsMedicaid as boolean) ?? false,
    acceptsVouchers: (data.acceptsVouchers as boolean) ?? false,
    acceptsODMHSAS: (data.acceptsODMHSAS as boolean) ?? false,
    acceptsSAMHSA: (data.acceptsSAMHSA as boolean) ?? false,
    slidingScale: (data.slidingScale as boolean) ?? false,
    acceptsPrivateInsurance: (data.acceptsPrivateInsurance as boolean) ?? false,
    okarrCertified: (data.okarrCertified as boolean) ?? false,
    oxfordHouseAffiliated: (data.oxfordHouseAffiliated as boolean) ?? false,
    odmhsasLicensed: (data.odmhsasLicensed as boolean) ?? false,
    housingLevel: data.housingLevel as HousingLevel | undefined,
    isTransitional: (data.isTransitional as boolean) ?? false,
    maxStayMonths: data.maxStayMonths as number | undefined,
    mealsProvided: (data.mealsProvided as boolean) ?? false,
    transportationProvided: (data.transportationProvided as boolean) ?? false,
    employmentSupport: (data.employmentSupport as boolean) ?? false,
    peersupport: (data.peersupport as boolean) ?? false,
    onSiteCounseling: (data.onSiteCounseling as boolean) ?? false,
    curfew: data.curfew as string | undefined,
    houseRules: data.houseRules as string | undefined,
    petsAllowed: (data.petsAllowed as boolean) ?? false,
    smokingAllowed: (data.smokingAllowed as boolean) ?? false,
    photos: (data.photos as string[]) ?? [],
    verified: (data.verified as boolean) ?? false,
    active: (data.active as boolean) ?? true,
    displayAvailability: (data.displayAvailability as boolean) ?? false,
    notes: data.notes as string | undefined,
  };
}

// ── Display helpers ───────────────────────────────────────────────
export function getAvailabilityLabel(facility: RecoveryHousingFacility): string {
  if (!facility.displayAvailability || facility.availableBeds === -1) {
    return "Contact for availability";
  }
  if (facility.availableBeds === 0) return "No beds available";
  if (facility.availableBeds === 1) return "1 bed available";
  return `${facility.availableBeds} beds available`;
}

export function getAvailabilityColor(facility: RecoveryHousingFacility): string {
  if (!facility.displayAvailability || facility.availableBeds === -1) return "#94A3B8";
  if (facility.availableBeds === 0) return "#EF4444";
  if (facility.availableBeds <= 2) return "#F59E0B";
  return "#22C55E";
}

export function getGenderLabel(gender: GenderServed): string {
  const labels: Record<GenderServed, string> = {
    men: "Men only",
    women: "Women only",
    "co-ed": "Co-ed",
    lgbtq_affirming: "LGBTQ+ affirming",
  };
  return labels[gender] || gender;
}

export function getFundingLabel(facility: RecoveryHousingFacility): string[] {
  const labels: string[] = [];
  if (facility.acceptsODMHSAS) labels.push("ODMHSAS voucher");
  if (facility.acceptsMedicaid) labels.push("Medicaid");
  if (facility.acceptsVouchers) labels.push("Vouchers accepted");
  if (facility.slidingScale) labels.push("Sliding scale");
  if (facility.acceptsPrivateInsurance) labels.push("Private insurance");
  if (labels.length === 0 && facility.monthlyRate) labels.push("Private pay");
  return labels;
}
'''

with open("data/recoveryHousing.ts", "w") as f:
    f.write(recovery_housing_ts)
print("✅ FILE 3: data/recoveryHousing.ts created (new collection types)\n")

# ─────────────────────────────────────────────────────────────────
# FILE 4: firestore.rules — staging additions only
# Add new optional provider fields + recoveryHousing collection
# ─────────────────────────────────────────────────────────────────

with open("firestore.rules", "r") as f:
    rules = f.read()

# Add new optional provider fields to the providers write validation
old_provider_rule = "                 && validOptionalString('specialty', 100)"
new_provider_rule = """                 && validOptionalString('specialty', 100)
                 && (!('practiceType' in request.resource.data) || validString(request.resource.data.practiceType, 30))
                 && (!('dpcDescription' in request.resource.data) || validOptionalString(request.resource.data.dpcDescription, 500))
                 && (!('telehealthAvailable' in request.resource.data) || request.resource.data.telehealthAvailable is bool)
                 && (!('telehealthOnly' in request.resource.data) || request.resource.data.telehealthOnly is bool)
                 && (!('acceptsSelfPay' in request.resource.data) || request.resource.data.acceptsSelfPay is bool)
                 && (!('acceptsMedicaid' in request.resource.data) || request.resource.data.acceptsMedicaid is bool)
                 && (!('fqhc' in request.resource.data) || request.resource.data.fqhc is bool)
                 && (!('tribal' in request.resource.data) || request.resource.data.tribal is bool)
                 && (!('slidingScale' in request.resource.data) || request.resource.data.slidingScale is bool)"""

# Only add if not already there
if "practiceType" not in rules:
    if old_provider_rule in rules:
        rules = rules.replace(old_provider_rule, new_provider_rule, 1)  # first occurrence only
        print("✅ FILE 4a: Firestore rules — new provider fields added")
    else:
        print("❌ FILE 4a: Provider rules pattern not found")
else:
    print("⏭️  FILE 4a: practiceType already in rules, skipping")

# Add recoveryHousing collection rules before the catch-all deny
old_catchall = """    // ================================================================
    // CATCH-ALL DENY
    // ================================================================
    match /{document=**} {
      allow read, write: if false;
    }"""

new_catchall = """    // ================================================================
    // RECOVERY HOUSING — May 2026
    // Separate collection from providers
    // Public read for patient discovery
    // Write restricted to admin only (staff update via admin SDK)
    // ================================================================
    match /recoveryHousing/{facilityId} {
      // Anyone can read active facilities (patient discovery)
      allow read: if resource.data.active == true || isAdmin();

      // Only admin can create/update facilities
      allow create, update: if isAdmin()
        && validString(request.resource.data.facilityName, 200)
        && request.resource.data.totalBeds is int
        && validString(request.resource.data.phone, 20);

      allow delete: if false;

      // Availability subcollection — for real-time bed updates by facility staff
      match /availability/{docId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }

    // ================================================================
    // CATCH-ALL DENY
    // ================================================================
    match /{document=**} {
      allow read, write: if false;
    }"""

if "recoveryHousing" not in rules:
    if old_catchall in rules:
        rules = rules.replace(old_catchall, new_catchall)
        print("✅ FILE 4b: Firestore rules — recoveryHousing collection added")
    else:
        print("❌ FILE 4b: Catch-all pattern not found")
else:
    print("⏭️  FILE 4b: recoveryHousing already in rules, skipping")

with open("firestore.rules", "w") as f:
    f.write(rules)
print("✅ FILE 4: firestore.rules saved\n")

print("=" * 60)
print("PATCH COMPLETE — Run TypeScript check next:")
print("  npx tsc --noEmit 2>/dev/null | grep -v node_modules | head -20")
print("")
print("Then deploy to STAGING only:")
print("  firebase deploy --only firestore:rules --project accesscare-staging")
print("  npx eas update --branch staging --message 'feat: DPC + new markets expansion'")
print("=" * 60)
