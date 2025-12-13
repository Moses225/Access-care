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
  
  // Extended Services
  | 'Maternal-Fetal Medicine'
  | 'Lactation Consultant'
  | 'Nutritionist'
  | 'Mental Health Provider'
  | 'Physical Therapist'
  | 'Social Worker'
  
  // Rare & Specialized
  | 'Reproductive Endocrinologist'
  | 'Neonatologist'
  | 'Genetic Counselor'
  | 'Perinatal Mental Health'
  | 'Rheumatologist'
  | 'Infectious Disease'
  | 'Palliative Care'
  | 'Rare Disease Center';

export interface Provider {
  id: string;
  name: string;
  specialty: ProviderSpecialty;
  category: ProviderCategory;
  distance: number;
  rating: number;
  address: string;
  phone: string;
  available: boolean;
  latitude?: number;
  longitude?: number;
  services?: string[];
}

export const providerCategories: Record<ProviderCategory, ProviderSpecialty[]> = {
  'Core Services': [
    'OB/GYN',
    'Midwife',
    'Hospital',
    'Family Medicine',
    'Pediatrician'
  ],
  'Extended Services': [
    'Maternal-Fetal Medicine',
    'Lactation Consultant',
    'Nutritionist',
    'Mental Health Provider',
    'Physical Therapist',
    'Social Worker'
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

export const mockProviders: Provider[] = [
  // Core Services
  {
    id: '1',
    name: 'Dr. Sarah Williams',
    specialty: 'OB/GYN',
    category: 'Core Services',
    distance: 2.3,
    rating: 4.8,
    address: '123 Medical Plaza, Oklahoma City, OK 73102',
    phone: '(405) 555-0123',
    available: true,
    services: ['Prenatal Care', 'Ultrasound', 'Labor & Delivery', 'Annual Exams']
  },
  {
    id: '2',
    name: 'Mary Johnson, CNM',
    specialty: 'Midwife',
    category: 'Core Services',
    distance: 3.1,
    rating: 4.9,
    address: '456 Birth Center Way, Oklahoma City, OK 73103',
    phone: '(405) 555-0456',
    available: true,
    services: ['Home Birth', 'Water Birth', 'Prenatal Care', 'Postpartum Support']
  },
  {
    id: '3',
    name: 'Memorial Hospital',
    specialty: 'Hospital',
    category: 'Core Services',
    distance: 5.7,
    rating: 4.7,
    address: '789 Hospital Drive, Oklahoma City, OK 73104',
    phone: '(405) 555-0789',
    available: true,
    services: ['Emergency Care', 'Labor & Delivery', 'NICU', 'Pediatrics']
  },
  {
    id: '4',
    name: 'Dr. James Chen',
    specialty: 'Family Medicine',
    category: 'Core Services',
    distance: 1.8,
    rating: 4.8,
    address: '321 Family Health Blvd, Oklahoma City, OK 73105',
    phone: '(405) 555-0321',
    available: true,
    services: ['Primary Care', 'Prenatal Care', 'Well-Child Visits', 'Immunizations']
  },
  {
    id: '5',
    name: 'Dr. Lisa Martinez',
    specialty: 'Pediatrician',
    category: 'Core Services',
    distance: 4.2,
    rating: 4.9,
    address: '654 Kids Care Ave, Oklahoma City, OK 73106',
    phone: '(405) 555-0654',
    available: true,
    services: ['Newborn Care', 'Well-Child Visits', 'Vaccinations', 'Developmental Screening']
  },

  // Extended Services
  {
    id: '6',
    name: 'Dr. Rachel Foster',
    specialty: 'Maternal-Fetal Medicine',
    category: 'Extended Services',
    distance: 6.5,
    rating: 4.9,
    address: '987 High-Risk Pregnancy Center, Oklahoma City, OK 73107',
    phone: '(405) 555-0987',
    available: true,
    services: ['High-Risk Pregnancy', 'Fetal Surgery', 'Advanced Ultrasound', 'Genetic Testing']
  },
  {
    id: '7',
    name: 'Jennifer Brooks, IBCLC',
    specialty: 'Lactation Consultant',
    category: 'Extended Services',
    distance: 2.9,
    rating: 5.0,
    address: '159 Breastfeeding Support Center, Oklahoma City, OK 73108',
    phone: '(405) 555-0159',
    available: true,
    services: ['Breastfeeding Support', 'Pumping Guidance', 'Return to Work Planning']
  },
  {
    id: '8',
    name: 'Amanda Green, RD',
    specialty: 'Nutritionist',
    category: 'Extended Services',
    distance: 3.4,
    rating: 4.7,
    address: '753 Nutrition Wellness, Oklahoma City, OK 73109',
    phone: '(405) 555-0753',
    available: true,
    services: ['Prenatal Nutrition', 'Gestational Diabetes', 'Weight Management']
  },
  {
    id: '9',
    name: 'Dr. Michael Torres',
    specialty: 'Mental Health Provider',
    category: 'Extended Services',
    distance: 3.8,
    rating: 4.8,
    address: '951 Wellness Center, Oklahoma City, OK 73110',
    phone: '(405) 555-0951',
    available: true,
    services: ['Therapy', 'Depression Treatment', 'Anxiety Management', 'Family Counseling']
  },

  // Rare & Specialized Services
  {
    id: '10',
    name: 'Dr. Emily Park',
    specialty: 'Reproductive Endocrinologist',
    category: 'Rare & Specialized Services',
    distance: 8.2,
    rating: 4.9,
    address: '357 Fertility Institute, Oklahoma City, OK 73111',
    phone: '(405) 555-0357',
    available: true,
    services: ['IVF', 'Fertility Treatment', 'Hormone Therapy', 'Egg Freezing']
  },
  {
    id: '11',
    name: 'Dr. David Kim',
    specialty: 'Neonatologist',
    category: 'Rare & Specialized Services',
    distance: 6.1,
    rating: 4.9,
    address: '159 NICU Specialists, Oklahoma City, OK 73112',
    phone: '(405) 555-0159',
    available: true,
    services: ['Premature Infant Care', 'NICU', 'Newborn Intensive Care']
  },
  {
    id: '12',
    name: 'Sarah Mitchell, MS, CGC',
    specialty: 'Genetic Counselor',
    category: 'Rare & Specialized Services',
    distance: 7.3,
    rating: 4.8,
    address: '246 Genetics Center, Oklahoma City, OK 73113',
    phone: '(405) 555-0246',
    available: true,
    services: ['Genetic Testing', 'Prenatal Screening', 'Hereditary Conditions', 'Risk Assessment']
  },
  {
    id: '13',
    name: 'Dr. Nicole Rivera',
    specialty: 'Perinatal Mental Health',
    category: 'Rare & Specialized Services',
    distance: 4.7,
    rating: 5.0,
    address: '864 Maternal Mental Health, Oklahoma City, OK 73114',
    phone: '(405) 555-0864',
    available: true,
    services: ['Postpartum Depression', 'Perinatal Anxiety', 'Birth Trauma', 'Maternal PTSD']
  },
   {
    id: '14',
    name: 'Dr. Robert Hayes',
    specialty: 'Physical Therapist',
    category: 'Extended Services',
    distance: 3.2,
    rating: 4.7,
    address: '582 Rehabilitation Center, Oklahoma City, OK 73115',
    phone: '(405) 555-0582',
    available: true,
    services: ['Prenatal Therapy', 'Postpartum Recovery', 'Pelvic Floor Therapy', 'Pain Management']
  },
  {
    id: '15',
    name: 'Karen Miller, LCSW',
    specialty: 'Social Worker',
    category: 'Extended Services',
    distance: 2.6,
    rating: 4.8,
    address: '791 Family Services, Oklahoma City, OK 73116',
    phone: '(405) 555-0791',
    available: true,
    services: ['Care Coordination', 'Resource Navigation', 'Family Support', 'Crisis Intervention']
  },

  // Additional Rare & Specialized
  {
    id: '16',
    name: 'Dr. Patricia Wong',
    specialty: 'Rheumatologist',
    category: 'Rare & Specialized Services',
    distance: 9.1,
    rating: 4.9,
    address: '428 Autoimmune Clinic, Oklahoma City, OK 73117',
    phone: '(405) 555-0428',
    available: true,
    services: ['Lupus Treatment', 'Rheumatoid Arthritis', 'Autoimmune Disorders', 'Pregnancy & Autoimmune']
  },
  {
    id: '17',
    name: 'Dr. Thomas Anderson',
    specialty: 'Infectious Disease',
    category: 'Rare & Specialized Services',
    distance: 7.8,
    rating: 4.8,
    address: '963 Infectious Disease Center, Oklahoma City, OK 73118',
    phone: '(405) 555-0963',
    available: true,
    services: ['HIV/AIDS Care', 'Hepatitis Treatment', 'Complex Infections', 'Travel Medicine']
  },
  {
    id: '18',
    name: 'Dr. Susan Harper',
    specialty: 'Palliative Care',
    category: 'Rare & Specialized Services',
    distance: 6.9,
    rating: 5.0,
    address: '147 Comfort Care Center, Oklahoma City, OK 73119',
    phone: '(405) 555-0147',
    available: true,
    services: ['Pain Management', 'Symptom Relief', 'End-of-Life Care', 'Family Support']
  },
  {
    id: '19',
    name: 'Oklahoma Rare Disease Center',
    specialty: 'Rare Disease Center',
    category: 'Rare & Specialized Services',
    distance: 10.2,
    rating: 4.9,
    address: '852 Medical Excellence Way, Oklahoma City, OK 73120',
    phone: '(405) 555-0852',
    available: true,
    services: ['Multidisciplinary Care', 'Rare Diagnosis', 'Clinical Trials', 'Genetic Research']
  },

  // Additional Core Services
  {
    id: '20',
    name: 'Dr. Angela Davis',
    specialty: 'OB/GYN',
    category: 'Core Services',
    distance: 4.5,
    rating: 4.8,
    address: '369 Women\'s Health Plaza, Oklahoma City, OK 73121',
    phone: '(405) 555-0369',
    available: true,
    services: ['Prenatal Care', 'High-Risk Pregnancy', 'Gynecologic Surgery', 'Family Planning']
  },
  {
    id: '21',
    name: 'Natural Birth Center',
    specialty: 'Midwife',
    category: 'Core Services',
    distance: 5.3,
    rating: 4.9,
    address: '741 Natural Birth Lane, Oklahoma City, OK 73122',
    phone: '(405) 555-0741',
    available: true,
    services: ['Natural Birth', 'Prenatal Classes', 'Doula Services', 'Water Birth']
  },
  {
    id: '22',
    name: 'Dr. Kevin Patel',
    specialty: 'Pediatrician',
    category: 'Core Services',
    distance: 3.7,
    rating: 4.7,
    address: '258 Children\'s Healthcare, Oklahoma City, OK 73123',
    phone: '(405) 555-0258',
    available: true,
    services: ['Newborn Care', 'Developmental Assessments', 'Vaccinations', 'Sick Visits']
  },
  {
    id: '23',
    name: 'Dr. Maria Rodriguez',
    specialty: 'Family Medicine',
    category: 'Core Services',
    distance: 2.1,
    rating: 4.8,
    address: '896 Community Health, Oklahoma City, OK 73124',
    phone: '(405) 555-0896',
    available: true,
    services: ['Prenatal Care', 'Pediatrics', 'Chronic Disease Management', 'Preventive Care']
  },

];