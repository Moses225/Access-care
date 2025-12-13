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
  latitude: number;
  longitude: number;
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
    address: '1000 N Lincoln Blvd, Oklahoma City, OK 73104',
    phone: '(405) 555-0123',
    available: true,
    latitude: 35.4822,
    longitude: -97.5053,
    services: ['Prenatal Care', 'Ultrasound', 'Labor & Delivery', 'Annual Exams']
  },
  {
    id: '2',
    name: 'Mary Johnson, CNM',
    specialty: 'Midwife',
    category: 'Core Services',
    distance: 3.1,
    rating: 4.9,
    address: '4200 N Classen Blvd, Oklahoma City, OK 73118',
    phone: '(405) 555-0456',
    available: true,
    latitude: 35.5121,
    longitude: -97.5309,
    services: ['Home Birth', 'Water Birth', 'Prenatal Care', 'Postpartum Support']
  },
  {
    id: '3',
    name: 'OU Health Hospital',
    specialty: 'Hospital',
    category: 'Core Services',
    distance: 5.7,
    rating: 4.7,
    address: '1200 Everett Dr, Oklahoma City, OK 73104',
    phone: '(405) 271-4700',
    available: true,
    latitude: 35.4785,
    longitude: -97.4969,
    services: ['Emergency Care', 'Labor & Delivery', 'NICU', 'Pediatrics']
  },
  {
    id: '4',
    name: 'Dr. James Chen',
    specialty: 'Family Medicine',
    category: 'Core Services',
    distance: 1.8,
    rating: 4.8,
    address: '5300 N May Ave, Oklahoma City, OK 73112',
    phone: '(405) 555-0321',
    available: true,
    latitude: 35.5389,
    longitude: -97.5647,
    services: ['Primary Care', 'Prenatal Care', 'Well-Child Visits', 'Immunizations']
  },
  {
    id: '5',
    name: 'Dr. Lisa Martinez',
    specialty: 'Pediatrician',
    category: 'Core Services',
    distance: 4.2,
    rating: 4.9,
    address: '3400 NW Expressway, Oklahoma City, OK 73112',
    phone: '(405) 555-0654',
    available: true,
    latitude: 35.5431,
    longitude: -97.5752,
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
    address: '825 NE 10th St, Oklahoma City, OK 73104',
    phone: '(405) 555-0987',
    available: true,
    latitude: 35.4759,
    longitude: -97.5013,
    services: ['High-Risk Pregnancy', 'Fetal Surgery', 'Advanced Ultrasound', 'Genetic Testing']
  },
  {
    id: '7',
    name: 'Jennifer Brooks, IBCLC',
    specialty: 'Lactation Consultant',
    category: 'Extended Services',
    distance: 2.9,
    rating: 5.0,
    address: '6800 N May Ave, Oklahoma City, OK 73116',
    phone: '(405) 555-0159',
    available: true,
    latitude: 35.5676,
    longitude: -97.5647,
    services: ['Breastfeeding Support', 'Pumping Guidance', 'Return to Work Planning']
  },
  {
    id: '8',
    name: 'Amanda Green, RD',
    specialty: 'Nutritionist',
    category: 'Extended Services',
    distance: 3.4,
    rating: 4.7,
    address: '2109 SW 59th St, Oklahoma City, OK 73119',
    phone: '(405) 555-0753',
    available: true,
    latitude: 35.4123,
    longitude: -97.5342,
    services: ['Prenatal Nutrition', 'Gestational Diabetes', 'Weight Management']
  },
  {
    id: '9',
    name: 'Dr. Michael Torres',
    specialty: 'Mental Health Provider',
    category: 'Extended Services',
    distance: 3.8,
    rating: 4.8,
    address: '4805 N Lincoln Blvd, Oklahoma City, OK 73105',
    phone: '(405) 555-0951',
    available: true,
    latitude: 35.5234,
    longitude: -97.5053,
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
    address: '10001 S Pennsylvania Ave, Oklahoma City, OK 73159',
    phone: '(405) 555-0357',
    available: true,
    latitude: 35.3476,
    longitude: -97.5234,
    services: ['IVF', 'Fertility Treatment', 'Hormone Therapy', 'Egg Freezing']
  },
  {
    id: '11',
    name: 'Dr. David Kim',
    specialty: 'Neonatologist',
    category: 'Rare & Specialized Services',
    distance: 6.1,
    rating: 4.9,
    address: '1200 N Everett Dr, Oklahoma City, OK 73104',
    phone: '(405) 555-0159',
    available: true,
    latitude: 35.4799,
    longitude: -97.4969,
    services: ['Premature Infant Care', 'NICU', 'Newborn Intensive Care']
  },
  {
    id: '12',
    name: 'Sarah Mitchell, MS, CGC',
    specialty: 'Genetic Counselor',
    category: 'Rare & Specialized Services',
    distance: 7.3,
    rating: 4.8,
    address: '800 Stanton L Young Blvd, Oklahoma City, OK 73104',
    phone: '(405) 555-0246',
    available: true,
    latitude: 35.4812,
    longitude: -97.4987,
    services: ['Genetic Testing', 'Prenatal Screening', 'Hereditary Conditions', 'Risk Assessment']
  },
  {
    id: '13',
    name: 'Dr. Nicole Rivera',
    specialty: 'Perinatal Mental Health',
    category: 'Rare & Specialized Services',
    distance: 4.7,
    rating: 5.0,
    address: '7601 NW Expressway, Oklahoma City, OK 73132',
    phone: '(405) 555-0864',
    available: true,
    latitude: 35.5543,
    longitude: -97.6234,
    services: ['Postpartum Depression', 'Perinatal Anxiety', 'Birth Trauma', 'Maternal PTSD']
  },

  // Additional Extended Services
  {
    id: '14',
    name: 'Dr. Robert Hayes',
    specialty: 'Physical Therapist',
    category: 'Extended Services',
    distance: 3.2,
    rating: 4.7,
    address: '2501 Parklawn Dr, Oklahoma City, OK 73110',
    phone: '(405) 555-0582',
    available: true,
    latitude: 35.4423,
    longitude: -97.4812,
    services: ['Prenatal Therapy', 'Postpartum Recovery', 'Pelvic Floor Therapy', 'Pain Management']
  },
  {
    id: '15',
    name: 'Karen Miller, LCSW',
    specialty: 'Social Worker',
    category: 'Extended Services',
    distance: 2.6,
    rating: 4.8,
    address: '1125 N Shartel Ave, Oklahoma City, OK 73103',
    phone: '(405) 555-0791',
    available: true,
    latitude: 35.4756,
    longitude: -97.5234,
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
    address: '4221 S Western Ave, Oklahoma City, OK 73109',
    phone: '(405) 555-0428',
    available: true,
    latitude: 35.4234,
    longitude: -97.5389,
    services: ['Lupus Treatment', 'Rheumatoid Arthritis', 'Autoimmune Disorders', 'Pregnancy & Autoimmune']
  },
  {
    id: '17',
    name: 'Dr. Thomas Anderson',
    specialty: 'Infectious Disease',
    category: 'Rare & Specialized Services',
    distance: 7.8,
    rating: 4.8,
    address: '940 NE 13th St, Oklahoma City, OK 73104',
    phone: '(405) 555-0963',
    available: true,
    latitude: 35.4789,
    longitude: -97.5000,
    services: ['HIV/AIDS Care', 'Hepatitis Treatment', 'Complex Infections', 'Travel Medicine']
  },
  {
    id: '18',
    name: 'Dr. Susan Harper',
    specialty: 'Palliative Care',
    category: 'Rare & Specialized Services',
    distance: 6.9,
    rating: 5.0,
    address: '3366 NW Expressway, Oklahoma City, OK 73112',
    phone: '(405) 555-0147',
    available: true,
    latitude: 35.5431,
    longitude: -97.5734,
    services: ['Pain Management', 'Symptom Relief', 'End-of-Life Care', 'Family Support']
  },
  {
    id: '19',
    name: 'Oklahoma Rare Disease Center',
    specialty: 'Rare Disease Center',
    category: 'Rare & Specialized Services',
    distance: 10.2,
    rating: 4.9,
    address: '13400 N Western Ave, Edmond, OK 73013',
    phone: '(405) 555-0852',
    available: true,
    latitude: 35.6876,
    longitude: -97.5247,
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
    address: '8001 S Walker Ave, Oklahoma City, OK 73139',
    phone: '(405) 555-0369',
    available: true,
    latitude: 35.3876,
    longitude: -97.5456,
    services: ['Prenatal Care', 'High-Risk Pregnancy', 'Gynecologic Surgery', 'Family Planning']
  },
  {
    id: '21',
    name: 'Natural Birth Center',
    specialty: 'Midwife',
    category: 'Core Services',
    distance: 5.3,
    rating: 4.9,
    address: '2408 N Meridian Ave, Oklahoma City, OK 73107',
    phone: '(405) 555-0741',
    available: true,
    latitude: 35.4912,
    longitude: -97.5734,
    services: ['Natural Birth', 'Prenatal Classes', 'Doula Services', 'Water Birth']
  },
  {
    id: '22',
    name: 'Dr. Kevin Patel',
    specialty: 'Pediatrician',
    category: 'Core Services',
    distance: 3.7,
    rating: 4.7,
    address: '6900 N May Ave, Oklahoma City, OK 73116',
    phone: '(405) 555-0258',
    available: true,
    latitude: 35.5698,
    longitude: -97.5647,
    services: ['Newborn Care', 'Developmental Assessments', 'Vaccinations', 'Sick Visits']
  },
  {
    id: '23',
    name: 'Dr. Maria Rodriguez',
    specialty: 'Family Medicine',
    category: 'Core Services',
    distance: 2.1,
    rating: 4.8,
    address: '1044 SW 44th St, Oklahoma City, OK 73109',
    phone: '(405) 555-0896',
    available: true,
    latitude: 35.4323,
    longitude: -97.5298,
    services: ['Prenatal Care', 'Pediatrics', 'Chronic Disease Management', 'Preventive Care']
  },
];