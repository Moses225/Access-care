import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ================================================================
// TYPE DEFINITIONS (Keep your existing types)
// ================================================================

export type ProviderCategory = 
  | 'Core Services'
  | 'Extended Services'
  | 'Rare & Specialized Services';

export type ProviderSpecialty = 
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
  | 'Occupational Therapist';    // OT for rehab and pediatrics

export type PracticeType =
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
}

export const providerCategories: Record<ProviderCategory, ProviderSpecialty[]> = {
  'Core Services': [
    'OB/GYN',
    'Midwife',
    'Hospital',
    'Family Medicine',
    'Pediatrician',
    'Dietitian',
    'Internal Medicine',
    'Dermatology',
    'General Surgery'
  ],
  'Extended Services': [
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
    'Occupational Therapist',
    'Social Worker',
    'Doula Services',
    'Home Health Agency',
    'Psychiatry',
    'Licensed Alcohol and Drug Counselor',
    'Diagnostic Radiology'
  ],
  'Rare & Specialized Services': [
    'Reproductive Endocrinologist',
    'Neonatologist',
    'Genetic Counselor',
    'Perinatal Mental Health',
    'Rheumatologist',
    'Infectious Disease',
    'Palliative Care',
    'Rare Disease Center'
  ]
};

// ================================================================
// CATEGORY MAPPING (Firebase → App)
// ================================================================

const categoryMap: Record<string, ProviderCategory> = {
  'Core': 'Core Services',
  'Extended': 'Extended Services',
  'Rare': 'Rare & Specialized Services'
};

// ================================================================
// SPECIALTY MAPPING (Firebase → App)
// ================================================================

const specialtyMap: Record<string, ProviderSpecialty | string> = {
  'Obstetrics & Gynecology': 'OB/GYN',
  'Family Medicine': 'Family Medicine',
  'Pediatrics': 'Pediatrician',
  'Internal Medicine': 'Internal Medicine',
  'Dermatology': 'Dermatology',
  'General Surgery': 'General Surgery',
  'Dietitian': 'Dietitian',
  'Doula Services': 'Doula Services',
  'Home Health Agency': 'Home Health Agency',
  'Licensed Professional Counselor': 'Mental Health Provider',
  'Licensed Alcohol and Drug Counselor': 'Mental Health Provider',
  'Psychiatry': 'Mental Health Provider',
  'Physical Therapist': 'Physical Therapist',
  'Diagnostic Radiology': 'Diagnostic Radiology',
  'Maternal-Fetal Medicine': 'Maternal-Fetal Medicine',
  'Reproductive Endocrinologist': 'Reproductive Endocrinologist',
  'Neonatologist': 'Neonatologist',
  'Genetic Counselor': 'Genetic Counselor',
};

// ================================================================
// FETCH PROVIDERS FROM FIREBASE
// ================================================================

export const fetchProviders = async (): Promise<Provider[]> => {
  try {
    console.log('🔄 Fetching providers from Firebase...');
    
    // Get all documents from 'providers' collection
    const querySnapshot = await getDocs(collection(db, 'providers'));
    
    console.log(`📊 Found ${querySnapshot.size} providers in Firebase`);
    
    const providers: Provider[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Map Firebase data to Provider interface
      const provider: Provider = {
        id: doc.id,
        name: data.name || 'Unknown Provider',
        
        // Map specialty (use mapping or keep original)
        specialty: specialtyMap[data.specialty] || data.specialty || 'Unknown',
        
        // Map category (Core → Core Services, etc.)
        category: categoryMap[data.category] || 'Extended Services',
        
        // Contact info
        address: data.address || '',
        phone: data.phone || '',
        
        // Location (CRITICAL for maps!)
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        
        // Rating
        rating: data.rating || 4.5,
        
        // Distance (will be calculated later based on user location)
        distance: 0,
        
        // Availability
        available: data.acceptingNewPatients !== false,
        
        // Services (optional)
        services: data.services || [],
      };
      
      providers.push(provider);
    });
    
    console.log('✅ Successfully loaded providers:', providers.length);
    
    return providers;
    
  } catch (error) {
    console.error('❌ Error fetching providers from Firebase:', error);
    
    // Return empty array on error (app won't crash)
    return [];
  }
};

// ================================================================
// MOCK PROVIDERS (Fallback - keep for reference)
// ================================================================

// These are your original mock providers
// Keep them commented out as backup
export const mockProviders: Provider[] = [
  // Commented out - now using Firebase data
  // Uncomment if you need to test without Firebase
];