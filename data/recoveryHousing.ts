// ================================================================
// RECOVERY HOUSING — Type Definitions
// Morava Care LLC — May 2026
//
// Recovery housing is a SEPARATE collection from providers.
// Collection: recoveryHousing/{facilityId}
// ================================================================

export type GenderServed = 'men' | 'women' | 'co-ed' | 'lgbtq_affirming';
export type AvailabilityStatus = 'available' | 'limited' | 'waitlist' | 'full' | 'call';
export type HousingLevel =
  | 'level_1'   // Social model, peer support only
  | 'level_2'   // Structured, house manager on site
  | 'level_3'   // Clinical services on site
  | 'level_4';  // Highly structured, staff 24/7

export interface RecoveryHousingFacility {
  id: string;

  // Identity
  facilityName: string;
  fullName?: string;             // Spelled-out acronym (e.g. "Daily Recovery Empowers All Minds")
  operatorName?: string;
  ownerName?: string;            // Primary contact / owner name
  phone: string;
  email?: string;
  website?: string;
  description?: string;

  // Services offered (free-text list shown on profile)
  servicesOffered?: string[];

  // Location
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  region?: string;               // okc | tulsa | rural

  // Availability (updated by facility staff via dashboard)
  totalBeds: number;
  availableBeds: number;         // -1 = contact for availability
  availabilityStatus?: AvailabilityStatus;
  waitlistDays?: number;         // Estimated wait in days when status = "waitlist"
  availabilityUpdatedAt?: Date;
  lastUpdated?: Date;

  // Admissions criteria
  genderServed: GenderServed;
  childrenAllowed?: boolean;     // Accepts mothers with children (e.g. D.R.E.A.M.)
  sobrietyRequirementDays?: number;
  minimumAge?: number;
  maximumAge?: number;
  acceptsWithActiveMentalHealth?: boolean;
  acceptsWithCriminalHistory?: boolean;
  medicationAssistedTreatment?: boolean;

  // Intake / interview
  requiresInterview?: boolean;   // Facility screens applicants before accepting
  intakeNotes?: string;          // Shown to patient on profile page

  // Financial
  monthlyRate?: number;
  ratePeriod?: "weekly" | "biweekly" | "monthly";
  acceptsMedicaid?: boolean;
  acceptsVouchers?: boolean;
  acceptsODMHSAS?: boolean;
  acceptsSAMHSA?: boolean;
  acceptsDHS?: boolean;          // Oklahoma DHS families / vouchers (e.g. D.R.E.A.M.)
  slidingScale?: boolean;
  acceptsPrivateInsurance?: boolean;

  // Certifications
  okarrCertified?: boolean;
  oxfordHouseAffiliated?: boolean;
  odmhsasLicensed?: boolean;

  // Housing type
  housingLevel?: HousingLevel;
  isTransitional?: boolean;
  maxStayMonths?: number;
  maxStayUnit?: "days" | "weeks" | "months";

  // Amenities
  mealsProvided?: boolean;
  transportationProvided?: boolean;
  employmentSupport?: boolean;
  peersupport?: boolean;
  onSiteCounseling?: boolean;
  curfew?: string;

  // Rules
  houseRules?: string;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;

  // Photos
  photos?: string[];
  videoURL?: string;

  // Morava admin
  verified?: boolean;
  active?: boolean;
  featured?: boolean;
  displayAvailability?: boolean;
  managedByUid?: string | null;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Listing tier (mirrors providerUsers.listingPlan)
  listingPlan?: "free" | "standard" | "growth";
}

// ── Firestore field mapping ───────────────────────────────────────
export function mapFirestoreToFacility(
  id: string,
  data: Record<string, unknown>
): RecoveryHousingFacility {
  return {
    id,
    facilityName: (data.facilityName as string) || "Unknown Facility",
    fullName: data.fullName as string | undefined,
    operatorName: data.operatorName as string | undefined,
    ownerName: data.ownerName as string | undefined,
    phone: (data.phone as string) || "",
    email: data.email as string | undefined,
    website: data.website as string | undefined,
    description: data.description as string | undefined,
    servicesOffered: (data.servicesOffered as string[]) ?? [],
    address: (data.address as string) || "",
    city: (data.city as string) || "",
    state: (data.state as string) || "Oklahoma",
    zip: (data.zip as string) || "",
    latitude: data.latitude as number | undefined,
    longitude: data.longitude as number | undefined,
    region: data.region as string | undefined,
    totalBeds: (data.totalBeds as number) || 0,
    availableBeds: data.availableBeds !== undefined ? (data.availableBeds as number) : -1,
    // availabilityStatus: fall back to deriving from availableBeds if not set
    availabilityStatus: (data.availabilityStatus as AvailabilityStatus) ?? deriveStatus(
      data.availableBeds as number,
      data.totalBeds as number
    ),
    waitlistDays: data.waitlistDays as number | undefined,
    genderServed: (data.genderServed as GenderServed) || "co-ed",
    childrenAllowed: (data.childrenAllowed as boolean) ?? false,
    sobrietyRequirementDays: data.sobrietyRequirementDays as number | undefined,
    minimumAge: data.minimumAge as number | undefined,
    maximumAge: data.maximumAge as number | undefined,
    acceptsWithActiveMentalHealth: data.acceptsWithActiveMentalHealth as boolean | undefined,
    acceptsWithCriminalHistory: data.acceptsWithCriminalHistory as boolean | undefined,
    medicationAssistedTreatment: data.medicationAssistedTreatment as boolean | undefined,
    requiresInterview: (data.requiresInterview as boolean) ?? false,
    intakeNotes: data.intakeNotes as string | undefined,
    monthlyRate: data.monthlyRate as number | undefined,
    ratePeriod: data.ratePeriod as "weekly" | "biweekly" | "monthly" | undefined,
    acceptsMedicaid: (data.acceptsMedicaid as boolean) ?? false,
    acceptsVouchers: (data.acceptsVouchers as boolean) ?? false,
    acceptsODMHSAS: (data.acceptsODMHSAS as boolean) ?? false,
    acceptsSAMHSA: (data.acceptsSAMHSA as boolean) ?? false,
    acceptsDHS: (data.acceptsDHS as boolean) ?? false,
    slidingScale: (data.slidingScale as boolean) ?? false,
    acceptsPrivateInsurance: (data.acceptsPrivateInsurance as boolean) ?? false,
    okarrCertified: (data.okarrCertified as boolean) ?? false,
    oxfordHouseAffiliated: (data.oxfordHouseAffiliated as boolean) ?? false,
    odmhsasLicensed: (data.odmhsasLicensed as boolean) ?? false,
    housingLevel: data.housingLevel as HousingLevel | undefined,
    isTransitional: (data.isTransitional as boolean) ?? false,
    maxStayMonths: data.maxStayMonths as number | undefined,
    maxStayUnit: data.maxStayUnit as "days" | "weeks" | "months" | undefined,
    mealsProvided: (data.mealsProvided as boolean) ?? false,
    transportationProvided: (data.transportationProvided as boolean) ?? false,
    employmentSupport: (data.employmentSupport as boolean) ?? false,
    peersupport: (data.peersupport as boolean) ?? false,
    onSiteCounseling: (data.onSiteCounseling as boolean) ?? false,
    curfew: data.curfew as string | undefined,
    houseRules: data.houseRules as string | undefined,
    petsAllowed: (data.petsAllowed as boolean) ?? false,
    smokingAllowed: (data.smokingAllowed as boolean) ?? false,
    // Combine cover (photoURL) + gallery (photoURLs) + legacy (photos), de-duped
    photos: Array.from(new Set([
      ...(data.photoURL ? [data.photoURL as string] : []),
      ...(Array.isArray(data.photoURLs) ? (data.photoURLs as string[]) : []),
      ...(Array.isArray(data.photos) ? (data.photos as string[]) : []),
    ].filter(Boolean))),
    videoURL: data.videoURL as string | undefined,
    listingPlan: (data.listingPlan as "free" | "standard" | "growth") ?? "free",
    verified: (data.verified as boolean) ?? false,
    active: (data.active as boolean) ?? true,
    featured: (data.featured as boolean) ?? false,
    // FIX: was defaulting to false, hiding availability for all facilities
    displayAvailability: (data.displayAvailability as boolean) ?? true,
    managedByUid: (data.managedByUid as string | null) ?? null,
    notes: data.notes as string | undefined,
  };
}

// Derives a status string when Firestore record has no explicit availabilityStatus
function deriveStatus(
  availableBeds: number,
  totalBeds: number
): AvailabilityStatus {
  if (availableBeds === undefined || availableBeds < 0) return "call";
  if (availableBeds === 0) return "full";
  if (totalBeds > 0 && availableBeds / totalBeds <= 0.25) return "limited";
  return "available";
}

// ── Display helpers ───────────────────────────────────────────────
export function getAvailabilityLabel(facility: RecoveryHousingFacility): string {
  const status = facility.availabilityStatus ?? deriveStatus(
    facility.availableBeds, facility.totalBeds
  );

  switch (status) {
    case "available":
      if (facility.availableBeds > 0)
        return `${facility.availableBeds} bed${facility.availableBeds > 1 ? "s" : ""} available`;
      return "Beds available";
    case "limited":
      if (facility.availableBeds > 0)
        return `Limited — ${facility.availableBeds} bed${facility.availableBeds > 1 ? "s" : ""} left`;
      return "Limited availability";
    case "waitlist":
      return facility.waitlistDays
        ? `Waitlist — est. ${facility.waitlistDays} day${facility.waitlistDays > 1 ? "s" : ""}`
        : "Waitlist — call for details";
    case "full":
      return "No beds available";
    case "call":
    default:
      return "Call for availability";
  }
}

export function getAvailabilityColor(facility: RecoveryHousingFacility): string {
  const status = facility.availabilityStatus ?? deriveStatus(
    facility.availableBeds, facility.totalBeds
  );
  switch (status) {
    case "available": return "#22C55E";
    case "limited":   return "#F59E0B";
    case "waitlist":  return "#F97316";
    case "full":      return "#EF4444";
    case "call":
    default:          return "#94A3B8";
  }
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
  if (facility.acceptsDHS)              labels.push("DHS Families");
  if (facility.acceptsODMHSAS)          labels.push("ODMHSAS voucher");
  if (facility.acceptsMedicaid)         labels.push("Medicaid");
  if (facility.acceptsVouchers)         labels.push("Vouchers accepted");
  if (facility.slidingScale)            labels.push("Sliding scale");
  if (facility.acceptsPrivateInsurance) labels.push("Private insurance");
  if (labels.length === 0 && facility.monthlyRate) labels.push("Private pay");
  return labels;
}
