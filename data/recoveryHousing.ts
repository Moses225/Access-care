// ================================================================
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
