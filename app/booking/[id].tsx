import { logBookingCreated } from '../../utils/auditLog';
import { logAnalyticsEvent } from '../../utils/analytics';
import { validateBooking, sanitizeText, sanitizePhone } from '../../utils/validation';
import { logError } from '../../utils/crashReporting';
import { checkBookingRateLimit, recordBookingCreation } from '../../utils/rateLimit';
import { checkEmailVerification, showVerificationPrompt } from '../../utils/emailVerification';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection, doc, getDoc,
  getDocs, serverTimestamp, runTransaction,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db } from '../../firebase';
import { sendBookingConfirmationSMS } from '../../utils/sms';

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const TELEHEALTH_INCOMPATIBLE = new Set(['lab_work', 'imaging']);

// ─── Specialty → service categories (20 specialties) ─────────────────────────
const SPECIALTY_SERVICES: Record<string, {
  id: string; label: string; icon: string; description: string; inPersonOnly?: boolean;
}[]> = {
  cardiology: [
    { id: 'hypertension',      label: 'Hypertension / High Blood Pressure', icon: '🫀', description: 'Blood pressure management and monitoring' },
    { id: 'chest_pain',        label: 'Chest Pain / Discomfort',            icon: '⚠️', description: 'Evaluation of chest pain or pressure', inPersonOnly: true },
    { id: 'arrhythmia',        label: 'Arrhythmia / Irregular Heartbeat',   icon: '📈', description: 'Irregular rhythm assessment' },
    { id: 'heart_failure',     label: 'Heart Failure Management',           icon: '🏥', description: 'Ongoing heart failure care' },
    { id: 'cholesterol',       label: 'Cholesterol Management',             icon: '🩸', description: 'Lipid levels and cardiovascular risk' },
    { id: 'shortness_breath',  label: 'Shortness of Breath',                icon: '💨', description: 'Breathing difficulty evaluation' },
    { id: 'palpitations',      label: 'Palpitations',                       icon: '💓', description: 'Heart racing or fluttering' },
    { id: 'preventive_cardio', label: 'Preventive Cardiology',              icon: '🛡️', description: 'Heart disease prevention and screening' },
    { id: 'post_surgery_card', label: 'Post-Surgery Follow-up',             icon: '🔄', description: 'Recovery check after cardiac procedure' },
    { id: 'other_cardio',      label: 'Other',                              icon: '💬', description: 'Something not listed above' },
  ],
  'primary care': [
    { id: 'sick_visit',           label: 'Sick Visit',                           icon: '🤒', description: 'Cold, flu, infection, or sudden illness' },
    { id: 'annual_wellness',      label: 'Annual Physical / Wellness',           icon: '🩺', description: 'Routine yearly checkup' },
    { id: 'prescription_refill',  label: 'Prescription Refill',                  icon: '💊', description: 'Refill or adjustment of existing medication' },
    { id: 'mental_health_pc',     label: 'Mental Health / Anxiety / Depression', icon: '🧠', description: 'Mental wellness support and referrals' },
    { id: 'diabetes_mgmt',        label: 'Diabetes Management',                 icon: '🩸', description: 'Blood sugar monitoring and care' },
    { id: 'hypertension_pc',      label: 'High Blood Pressure',                 icon: '🫀', description: 'Blood pressure management' },
    { id: 'back_joint',           label: 'Back / Joint Pain',                    icon: '🦴', description: 'Musculoskeletal pain and discomfort' },
    { id: 'preventive_screening', label: 'Preventive Screening',                icon: '🔍', description: 'Cancer screening, bloodwork, checkups' },
    { id: 'vaccination_pc',       label: 'Vaccination',                          icon: '💉', description: 'Immunizations and boosters' },
    { id: 'other_pc',             label: 'Other',                                icon: '💬', description: 'Something not listed above' },
  ],
  'family medicine': [
    { id: 'sick_visit_fm',     label: 'Sick Visit',                 icon: '🤒', description: 'Sudden illness or infection' },
    { id: 'chronic_disease',   label: 'Chronic Disease Management', icon: '📋', description: 'Ongoing condition monitoring' },
    { id: 'annual_physical_fm',label: 'Annual Physical',            icon: '🩺', description: 'Routine yearly checkup' },
    { id: 'vaccination_fm',    label: 'Vaccination',                icon: '💉', description: 'Immunizations and boosters' },
    { id: 'womens_health_fm',  label: "Women's Health",             icon: '🌸', description: 'Gynecological concerns and care' },
    { id: 'pediatric_fm',      label: 'Child / Pediatric Care',     icon: '👶', description: 'Care for infants and children' },
    { id: 'mental_health_fm',  label: 'Mental Health',              icon: '🧠', description: 'Anxiety, depression, counseling referral' },
    { id: 'other_fm',          label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  'internal medicine': [
    { id: 'chronic_mgmt',    label: 'Chronic Condition Management', icon: '📋', description: 'Diabetes, hypertension, thyroid, etc.' },
    { id: 'diagnostic',      label: 'Diagnostic Evaluation',        icon: '🔍', description: 'Unexplained symptoms or test results' },
    { id: 'preventive_im',   label: 'Preventive Care',              icon: '🛡️', description: 'Screenings and annual wellness' },
    { id: 'medication_mgmt', label: 'Medication Management',        icon: '💊', description: 'Review or adjustment of medications' },
    { id: 'infectious_im',   label: 'Infectious Disease',           icon: '🦠', description: 'Infections and immune concerns' },
    { id: 'other_im',        label: 'Other',                        icon: '💬', description: 'Something not listed above' },
  ],
  pediatric: [
    { id: 'well_child',       label: 'Well-Child Visit',        icon: '👶', description: 'Routine developmental checkup' },
    { id: 'sick_child',       label: 'Sick Visit',              icon: '🤒', description: 'Cold, fever, infection' },
    { id: 'vaccination_peds', label: 'Vaccination',             icon: '💉', description: 'Scheduled immunizations' },
    { id: 'adhd',             label: 'ADHD / Behavioral',       icon: '🧩', description: 'Attention, focus, and behavioral concerns' },
    { id: 'asthma_peds',      label: 'Asthma / Respiratory',    icon: '💨', description: 'Breathing and asthma management' },
    { id: 'ear_infection',    label: 'Ear Infection',           icon: '👂', description: 'Ear pain or hearing concerns' },
    { id: 'developmental',    label: 'Developmental Concern',   icon: '📊', description: 'Milestones, speech, motor skills' },
    { id: 'sports_physical',  label: 'Sports Physical',         icon: '🏃', description: 'Pre-participation athletic exam' },
    { id: 'newborn',          label: 'Newborn / Infant Care',   icon: '🍼', description: 'Early infant health and feeding' },
    { id: 'other_peds',       label: 'Other',                   icon: '💬', description: 'Something not listed above' },
  ],
  obgyn: [
    { id: 'prenatal',          label: 'Prenatal Care',                   icon: '🤰', description: 'Pregnancy monitoring and care' },
    { id: 'annual_womens',     label: 'Annual Well-Woman Exam',          icon: '🌸', description: 'Routine gynecological checkup' },
    { id: 'uti',               label: 'UTI / Infection',                 icon: '🦠', description: 'Urinary or vaginal infection symptoms' },
    { id: 'contraception',     label: 'Contraception Consultation',      icon: '💊', description: 'Birth control options and management' },
    { id: 'fertility',         label: 'Fertility',                       icon: '🌱', description: 'Fertility evaluation and planning' },
    { id: 'menopause',         label: 'Menopause',                       icon: '🌡️', description: 'Perimenopause and menopause symptoms' },
    { id: 'pelvic_pain',       label: 'Pelvic Pain',                     icon: '⚠️', description: 'Pelvic or abdominal discomfort' },
    { id: 'abnormal_bleeding', label: 'Abnormal Bleeding',               icon: '🩸', description: 'Irregular or heavy menstrual bleeding' },
    { id: 'sti',               label: 'STI Testing / Sexual Health',     icon: '🔬', description: 'STI screening and sexual health care', inPersonOnly: true },
    { id: 'other_obgyn',       label: 'Other',                           icon: '💬', description: 'Something not listed above' },
  ],
  'mental health': [
    { id: 'anxiety',       label: 'Anxiety',                        icon: '😰', description: 'Generalized anxiety, panic, stress' },
    { id: 'depression',    label: 'Depression',                     icon: '😔', description: 'Low mood, loss of motivation' },
    { id: 'trauma',        label: 'Trauma / PTSD',                  icon: '🛡️', description: 'Trauma processing and PTSD care' },
    { id: 'adhd_mh',       label: 'ADHD',                           icon: '🧩', description: 'Attention and focus evaluation' },
    { id: 'bipolar',       label: 'Bipolar Disorder',               icon: '🔄', description: 'Mood stabilization and management' },
    { id: 'substance',     label: 'Substance Use / Addiction',      icon: '🫂', description: 'Alcohol, drug, or substance support' },
    { id: 'couples',       label: 'Couples / Relationship Therapy', icon: '👫', description: 'Relationship and communication support' },
    { id: 'grief',         label: 'Grief / Loss',                   icon: '🕊️', description: 'Bereavement and loss support' },
    { id: 'medication_mh', label: 'Medication Management',          icon: '💊', description: 'Psychiatric medication review' },
    { id: 'other_mh',      label: 'Other',                          icon: '💬', description: 'Something not listed above' },
  ],
  dermatology: [
    { id: 'skin_check',    label: 'Skin Cancer Screening', icon: '🔍', description: 'Full body mole and lesion check', inPersonOnly: true },
    { id: 'acne',          label: 'Acne',                  icon: '🫧', description: 'Acne treatment and management' },
    { id: 'eczema',        label: 'Eczema / Psoriasis',    icon: '🧴', description: 'Chronic inflammatory skin conditions' },
    { id: 'rash',          label: 'Rash / Irritation',     icon: '⚠️', description: 'Unexplained rash or skin reaction' },
    { id: 'cosmetic_derm', label: 'Cosmetic Procedure',    icon: '✨', description: 'Cosmetic skin treatment', inPersonOnly: true },
    { id: 'hair_loss',     label: 'Hair Loss',             icon: '💇', description: 'Alopecia and hair thinning' },
    { id: 'nail',          label: 'Nail Condition',        icon: '💅', description: 'Nail infection or abnormality' },
    { id: 'other_derm',    label: 'Other',                 icon: '💬', description: 'Something not listed above' },
  ],
  orthopedic: [
    { id: 'knee',               label: 'Knee Pain / Injury',     icon: '🦵', description: 'Knee evaluation and treatment' },
    { id: 'shoulder',           label: 'Shoulder Pain / Injury', icon: '🦾', description: 'Shoulder evaluation and care' },
    { id: 'back_ortho',         label: 'Back / Spine',           icon: '🦴', description: 'Spinal pain or injury' },
    { id: 'hip',                label: 'Hip Pain',               icon: '🦴', description: 'Hip evaluation and care' },
    { id: 'fracture',           label: 'Fracture / Broken Bone', icon: '🩺', description: 'Bone fracture evaluation', inPersonOnly: true },
    { id: 'sports_injury',      label: 'Sports Injury',          icon: '🏃', description: 'Athletic injury evaluation' },
    { id: 'arthritis',          label: 'Arthritis',              icon: '🖐️', description: 'Joint inflammation and pain' },
    { id: 'post_surgery_ortho', label: 'Post-Surgery Follow-up', icon: '🔄', description: 'Recovery after orthopedic procedure' },
    { id: 'other_ortho',        label: 'Other',                  icon: '💬', description: 'Something not listed above' },
  ],
  'urgent care': [
    { id: 'minor_injury',      label: 'Minor Injury / Cut / Burn', icon: '🩹', description: 'Non-emergency injury care', inPersonOnly: true },
    { id: 'fever',             label: 'Fever / Flu',               icon: '🤒', description: 'High fever or flu symptoms' },
    { id: 'respiratory',       label: 'Respiratory / Breathing',   icon: '💨', description: 'Cough, cold, shortness of breath' },
    { id: 'uti_urgent',        label: 'UTI / Infection',           icon: '🦠', description: 'Urinary tract or other infection' },
    { id: 'prescription_urg',  label: 'Prescription / Medication', icon: '💊', description: 'Urgent prescription need' },
    { id: 'allergic_reaction', label: 'Allergic Reaction',         icon: '⚠️', description: 'Mild to moderate allergic reaction', inPersonOnly: true },
    { id: 'other_urgent',      label: 'Other',                     icon: '💬', description: 'Something not listed above' },
  ],
  endocrinology: [
    { id: 'diabetes_type1', label: 'Type 1 Diabetes',           icon: '🩸', description: 'Insulin-dependent diabetes management' },
    { id: 'diabetes_type2', label: 'Type 2 Diabetes',           icon: '🩸', description: 'Diabetes management and prevention' },
    { id: 'thyroid',        label: 'Thyroid Condition',          icon: '🦋', description: 'Hypothyroidism, hyperthyroidism, nodules' },
    { id: 'prediabetes',    label: 'Prediabetes / Prevention',   icon: '📊', description: 'Early intervention and lifestyle changes' },
    { id: 'adrenal',        label: 'Adrenal Disorder',           icon: '⚡', description: 'Adrenal gland conditions' },
    { id: 'pcos',           label: 'PCOS',                       icon: '🌸', description: 'Polycystic ovary syndrome management' },
    { id: 'osteoporosis',   label: 'Osteoporosis / Bone Health', icon: '🦴', description: 'Bone density and metabolism' },
    { id: 'weight_endo',    label: 'Weight / Metabolic Health',  icon: '⚖️', description: 'Metabolic conditions and weight management' },
    { id: 'other_endo',     label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  gastroenterology: [
    { id: 'colonoscopy',    label: 'Colonoscopy / Screening',    icon: '🔍', description: 'Colorectal cancer screening', inPersonOnly: true },
    { id: 'gerd',           label: 'GERD / Acid Reflux',         icon: '🔥', description: 'Heartburn and reflux management' },
    { id: 'ibs',            label: 'IBS / Irritable Bowel',      icon: '🫃', description: 'Bowel irregularity and cramping' },
    { id: 'ibd',            label: "IBD / Crohn's / Colitis",    icon: '⚠️', description: 'Inflammatory bowel disease management' },
    { id: 'liver',          label: 'Liver Disease / Hepatitis',  icon: '🫀', description: 'Liver health evaluation and monitoring' },
    { id: 'abdominal_pain', label: 'Abdominal Pain',             icon: '😣', description: 'Stomach or abdominal pain evaluation' },
    { id: 'swallowing',     label: 'Swallowing Difficulty',      icon: '😮', description: 'Dysphagia or throat concerns' },
    { id: 'other_gi',       label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  neurology: [
    { id: 'headache',    label: 'Headache / Migraine',         icon: '🤕', description: 'Chronic or severe headache management' },
    { id: 'epilepsy',    label: 'Epilepsy / Seizures',         icon: '⚡', description: 'Seizure evaluation and treatment' },
    { id: 'memory',      label: 'Memory / Cognitive Concerns', icon: '🧠', description: 'Memory loss, dementia, cognitive decline' },
    { id: 'ms',          label: 'Multiple Sclerosis',          icon: '🔄', description: 'MS diagnosis and management' },
    { id: 'parkinson',   label: "Parkinson's Disease",         icon: '🤲', description: 'Movement disorder management' },
    { id: 'stroke',      label: 'Stroke / TIA Follow-up',      icon: '🏥', description: 'Post-stroke care and monitoring' },
    { id: 'nerve_pain',  label: 'Nerve Pain / Neuropathy',     icon: '⚡', description: 'Tingling, numbness, nerve discomfort' },
    { id: 'dizziness',   label: 'Dizziness / Balance',         icon: '😵', description: 'Vertigo and balance disorders' },
    { id: 'other_neuro', label: 'Other',                       icon: '💬', description: 'Something not listed above' },
  ],
  nephrology: [
    { id: 'ckd',               label: 'Chronic Kidney Disease',  icon: '🫘', description: 'CKD monitoring and management' },
    { id: 'dialysis',          label: 'Dialysis Management',     icon: '🏥', description: 'Dialysis care and coordination' },
    { id: 'kidney_stones',     label: 'Kidney Stones',           icon: '⚠️', description: 'Stone prevention and management' },
    { id: 'hypertension_neph', label: 'Hypertension / Kidney',  icon: '🫀', description: 'Blood pressure affecting kidney health' },
    { id: 'transplant_neph',   label: 'Transplant Follow-up',    icon: '🔄', description: 'Post-kidney transplant care' },
    { id: 'protein_urine',     label: 'Protein in Urine',        icon: '🔬', description: 'Proteinuria evaluation' },
    { id: 'other_neph',        label: 'Other',                   icon: '💬', description: 'Something not listed above' },
  ],
  oncology: [
    { id: 'new_diagnosis',  label: 'New Cancer Diagnosis',    icon: '🔍', description: 'Initial evaluation and staging' },
    { id: 'chemo',          label: 'Chemotherapy Management', icon: '💊', description: 'Ongoing chemo treatment and monitoring' },
    { id: 'surveillance',   label: 'Cancer Surveillance',     icon: '📊', description: 'Post-treatment monitoring' },
    { id: 'second_opinion', label: 'Second Opinion',          icon: '💬', description: 'Treatment plan review' },
    { id: 'blood_disorder', label: 'Blood Disorder',          icon: '🩸', description: 'Anemia, clotting, blood conditions' },
    { id: 'other_onc',      label: 'Other',                   icon: '💬', description: 'Something not listed above' },
  ],
  pulmonary: [
    { id: 'asthma_pulm',    label: 'Asthma',                   icon: '💨', description: 'Asthma management and control' },
    { id: 'copd',           label: 'COPD',                     icon: '🫁', description: 'Chronic obstructive pulmonary disease' },
    { id: 'sleep_apnea',    label: 'Sleep Apnea',              icon: '😴', description: 'Sleep-disordered breathing' },
    { id: 'chronic_cough',  label: 'Chronic Cough',            icon: '🤧', description: 'Persistent cough evaluation' },
    { id: 'shortness_pulm', label: 'Shortness of Breath',      icon: '💨', description: 'Breathing difficulty evaluation' },
    { id: 'lung_nodule',    label: 'Lung Nodule Follow-up',    icon: '🔍', description: 'Lung nodule monitoring' },
    { id: 'other_pulm',     label: 'Other',                    icon: '💬', description: 'Something not listed above' },
  ],
  geriatrics: [
    { id: 'memory_geri',     label: 'Memory / Dementia',          icon: '🧠', description: 'Cognitive decline and dementia care' },
    { id: 'falls',           label: 'Falls / Balance',            icon: '⚠️', description: 'Fall prevention and balance assessment' },
    { id: 'polypharmacy',    label: 'Medication Review',          icon: '💊', description: 'Multiple medication management' },
    { id: 'functional',      label: 'Functional Assessment',      icon: '📊', description: 'Independence and daily function evaluation' },
    { id: 'chronic_geri',    label: 'Chronic Disease Management', icon: '📋', description: 'Multiple condition coordination' },
    { id: 'palliative_geri', label: 'Palliative / Comfort Care',  icon: '🕊️', description: 'Quality of life and comfort focus' },
    { id: 'other_geri',      label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  ophthalmology: [
    { id: 'eye_exam',     label: 'Comprehensive Eye Exam', icon: '👁️', description: 'Routine vision and eye health exam', inPersonOnly: true },
    { id: 'glaucoma',     label: 'Glaucoma',               icon: '🔍', description: 'Glaucoma screening and management' },
    { id: 'cataracts',    label: 'Cataracts',              icon: '👁️', description: 'Cataract evaluation and surgery' },
    { id: 'diabetic_eye', label: 'Diabetic Eye Disease',   icon: '🩸', description: 'Retinopathy and diabetic eye care' },
    { id: 'dry_eye',      label: 'Dry Eye',                icon: '💧', description: 'Dry eye syndrome treatment' },
    { id: 'vision_loss',  label: 'Vision Changes / Loss',  icon: '⚠️', description: 'Sudden or gradual vision changes' },
    { id: 'other_eye',    label: 'Other',                  icon: '💬', description: 'Something not listed above' },
  ],
  ent: [
    { id: 'hearing_loss',     label: 'Hearing Loss',              icon: '👂', description: 'Hearing evaluation and treatment' },
    { id: 'sinusitis',        label: 'Sinusitis / Sinus Problems', icon: '🤧', description: 'Sinus pain and congestion' },
    { id: 'tonsils',          label: 'Tonsils / Throat',          icon: '😮', description: 'Tonsillitis and throat conditions' },
    { id: 'ear_infection_ent',label: 'Ear Infection / Pain',      icon: '👂', description: 'Ear pain and infections' },
    { id: 'snoring',          label: 'Snoring / Sleep Apnea',     icon: '😴', description: 'Snoring and airway obstruction' },
    { id: 'dizziness_ent',    label: 'Dizziness / Vertigo',       icon: '😵', description: 'Inner ear and balance disorders' },
    { id: 'voice',            label: 'Voice / Hoarseness',        icon: '🗣️', description: 'Voice changes or loss' },
    { id: 'other_ent',        label: 'Other',                     icon: '💬', description: 'Something not listed above' },
  ],
  'physical therapy': [
    { id: 'back_pain_pt',    label: 'Back / Neck Pain',          icon: '🦴', description: 'Spinal rehabilitation', inPersonOnly: true },
    { id: 'post_surgery_pt', label: 'Post-Surgery Rehab',        icon: '🔄', description: 'Recovery after surgery', inPersonOnly: true },
    { id: 'sports_rehab',    label: 'Sports / Athletic Rehab',   icon: '🏃', description: 'Return to sport recovery', inPersonOnly: true },
    { id: 'balance_pt',      label: 'Balance / Fall Prevention', icon: '⚖️', description: 'Balance training and fall prevention', inPersonOnly: true },
    { id: 'joint_pain_pt',   label: 'Joint Pain / Arthritis',    icon: '🖐️', description: 'Joint mobility and strengthening', inPersonOnly: true },
    { id: 'other_pt',        label: 'Other',                     icon: '💬', description: 'Something not listed above' },
  ],
  surgery: [
    { id: 'pre_op',      label: 'Pre-Operative Consultation', icon: '📋', description: 'Surgical planning and evaluation' },
    { id: 'post_op',     label: 'Post-Operative Follow-up',   icon: '🔄', description: 'Recovery and wound check', inPersonOnly: true },
    { id: 'hernia',      label: 'Hernia',                     icon: '⚠️', description: 'Hernia evaluation and repair' },
    { id: 'gallbladder', label: 'Gallbladder / Appendix',     icon: '🫀', description: 'Gallstones and abdominal surgery' },
    { id: 'wound',       label: 'Wound / Abscess',            icon: '🩹', description: 'Wound care and infection', inPersonOnly: true },
    { id: 'other_surg',  label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  'infectious disease': [
    { id: 'hiv',              label: 'HIV / AIDS Management',      icon: '🛡️', description: 'HIV treatment and prevention' },
    { id: 'hepatitis_id',     label: 'Hepatitis B / C',            icon: '🫀', description: 'Viral hepatitis management' },
    { id: 'travel_vaccine',   label: 'Travel Medicine / Vaccines', icon: '✈️', description: 'Pre-travel vaccines and advice' },
    { id: 'recurrent_infect', label: 'Recurrent Infections',       icon: '🔄', description: 'Chronic or recurring infections' },
    { id: 'fever_id',         label: 'Fever of Unknown Origin',    icon: '🌡️', description: 'Unexplained fever evaluation' },
    { id: 'other_id',         label: 'Other',                      icon: '💬', description: 'Something not listed above' },
  ],
  nutrition: [
    { id: 'weight_mgmt',     label: 'Weight Management',   icon: '⚖️', description: 'Healthy weight goals and planning' },
    { id: 'diabetes_diet',   label: 'Diabetes Nutrition',  icon: '🩸', description: 'Meal planning for blood sugar control' },
    { id: 'heart_diet',      label: 'Heart-Healthy Diet',  icon: '🫀', description: 'Cholesterol and cardiovascular nutrition' },
    { id: 'eating_disorder', label: 'Disordered Eating',   icon: '🍽️', description: 'Recovery-focused nutrition support' },
    { id: 'sports_nutrition',label: 'Sports Nutrition',    icon: '🏃', description: 'Performance and recovery nutrition' },
    { id: 'other_nutrition', label: 'Other',               icon: '💬', description: 'Something not listed above' },
  ],
  palliative: [
    { id: 'pain_mgmt_pal',   label: 'Pain Management',           icon: '🕊️', description: 'Comfort-focused pain control' },
    { id: 'goals_of_care',   label: 'Goals of Care Discussion',  icon: '💬', description: 'Treatment goals and advance planning' },
    { id: 'symptom_mgmt',    label: 'Symptom Management',        icon: '🌿', description: 'Managing symptoms of serious illness' },
    { id: 'hospice_consult', label: 'Hospice Consultation',      icon: '🏠', description: 'Hospice eligibility and planning' },
    { id: 'other_pal',       label: 'Other',                     icon: '💬', description: 'Something not listed above' },
  ],
};

function getSpecialtyServices(specialty: string) {
  if (!specialty) return null;
  const s = specialty.toLowerCase();
  for (const key of Object.keys(SPECIALTY_SERVICES)) {
    if (s.includes(key)) return SPECIALTY_SERVICES[key];
  }
  if (s.includes('cardiac') || s.includes('cardiovascular') || s.includes('electrophysiol')) return SPECIALTY_SERVICES['cardiology'];
  if (s.includes('ob') || s.includes('gynecol') || s.includes('obstetric') || s.includes('maternal') || s.includes('reproductive') || s.includes("women's health") || s.includes('gynecologic')) return SPECIALTY_SERVICES['obgyn'];
  if (s.includes('psychiatry') || s.includes('psychiatr') || s.includes('behavioral') || s.includes('counselor') || s.includes('counseling') || s.includes('social worker') || s.includes('alcohol') || s.includes('drug counselor')) return SPECIALTY_SERVICES['mental health'];
  if (s.includes('neonat')) return SPECIALTY_SERVICES['pediatric'];
  if (s.includes('endocrin') || s.includes('diabetes')) return SPECIALTY_SERVICES['endocrinology'];
  if (s.includes('neurol') || s.includes('neurosurg') || s.includes('neuro-oncol')) return SPECIALTY_SERVICES['neurology'];
  if (s.includes('nephrol') || s.includes('kidney')) return SPECIALTY_SERVICES['nephrology'];
  if (s.includes('oncol') || s.includes('hematol') || s.includes('cancer')) return SPECIALTY_SERVICES['oncology'];
  if (s.includes('pulmon') || s.includes('respiratory') || s.includes('critical care')) return SPECIALTY_SERVICES['pulmonary'];
  if (s.includes('geriatr')) return SPECIALTY_SERVICES['geriatrics'];
  if (s.includes('ophthal')) return SPECIALTY_SERVICES['ophthalmology'];
  if (s.includes('otolar') || s.includes('ear, nose') || s.includes('ear nose')) return SPECIALTY_SERVICES['ent'];
  if (s.includes('physical therap') || s.includes('physical therapist') || s.includes('occupational therap')) return SPECIALTY_SERVICES['physical therapy'];
  if (s.includes('surgery') || s.includes('surgical') || s.includes('surgeon') || s.includes('plastic') || s.includes('reconstructive') || s.includes('trauma surg')) return SPECIALTY_SERVICES['surgery'];
  if (s.includes('infectious') || s.includes('infection')) return SPECIALTY_SERVICES['infectious disease'];
  if (s.includes('nutrition') || s.includes('dietit')) return SPECIALTY_SERVICES['nutrition'];
  if (s.includes('palliativ') || s.includes('hospice')) return SPECIALTY_SERVICES['palliative'];
  if (s.includes('gastro') || s.includes('gastrointestinal') || s.includes('colorectal')) return SPECIALTY_SERVICES['gastroenterology'];
  return null;
}

interface VisitType {
  id: string; label: string; icon: string; description: string;
  disabled?: boolean; disabledReason?: string;
}

const DEFAULT_VISIT_TYPES: VisitType[] = [
  { id: 'new_patient',     label: 'New Patient Visit',          icon: '👤', description: 'First visit with this provider' },
  { id: 'follow_up',       label: 'Follow-up Visit',            icon: '🔄', description: 'Returning for ongoing care' },
  { id: 'annual_physical', label: 'Annual Physical / Wellness', icon: '🩺', description: 'Routine wellness check' },
  { id: 'telehealth',      label: 'Telehealth / Virtual',       icon: '💻', description: 'Video or phone consultation' },
  { id: 'lab_work',        label: 'Lab Work / Blood Draw',      icon: '🧪', description: 'In-person only' },
  { id: 'imaging',         label: 'Imaging (X-ray, MRI, etc.)', icon: '🔬', description: 'In-person only' },
  { id: 'urgent',          label: 'Urgent / Same-day',          icon: '🚨', description: 'Immediate care needed' },
  { id: 'other',           label: 'Other',                      icon: '💬', description: 'Something not listed above' },
];

interface PatientOption {
  id: string; name: string; subtitle: string; isMinor: boolean; phone?: string;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function generateSlotsForRange(open: string, close: string): string[] {
  const slots: string[] = [];
  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  for (let m = openMins; m < closeMins; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`);
  }
  return slots;
}

// ─── Visit Type Selector ──────────────────────────────────────────────────────
const VisitTypeSelector = ({
  visitTypes, selectedType, onSelect, providerIsTelehealthOnly, colors,
}: {
  visitTypes: VisitType[];
  selectedType: string;
  onSelect: (id: string) => void;
  providerIsTelehealthOnly: boolean;
  colors: any;
}) => (
  <View style={styles.visitTypeGrid}>
    {visitTypes.map((type) => {
      const isSelected = selectedType === type.id;
      const isTypeLevelDisabled  = type.disabled === true;
      const isTelehealthDisabled = providerIsTelehealthOnly && TELEHEALTH_INCOMPATIBLE.has(type.id);
      const isDisabled = isTypeLevelDisabled || isTelehealthDisabled;
      const descriptionText = isTypeLevelDisabled
        ? (type.disabledReason ?? 'Not available')
        : isTelehealthDisabled ? 'Not available for virtual care'
        : type.description;
      return (
        <TouchableOpacity
          key={type.id}
          style={[styles.visitTypeCard, {
            backgroundColor: isDisabled ? colors.background
              : isSelected ? colors.primary + '15' : colors.background,
            borderColor: isDisabled ? colors.border
              : isSelected ? colors.primary : colors.border,
            borderWidth: isSelected && !isDisabled ? 2 : 1,
            opacity: isDisabled ? 0.4 : 1,
          }]}
          onPress={() => !isDisabled && onSelect(type.id)}
          activeOpacity={isDisabled ? 1 : 0.7}
          disabled={isDisabled}
        >
          <Text style={styles.visitTypeIcon}>{type.icon}</Text>
          <Text style={[styles.visitTypeLabel, {
            color: isDisabled ? colors.subtext : isSelected ? colors.primary : colors.text,
          }]}>
            {type.label}
          </Text>
          <Text style={[styles.visitTypeDesc, { color: colors.subtext }]} numberOfLines={2}>
            {descriptionText}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Specialty Service Selector ───────────────────────────────────────────────
const SpecialtyServiceSelector = ({
  services, selectedService, onSelect, providerIsTelehealthOnly, colors,
}: {
  services: ReturnType<typeof getSpecialtyServices>;
  selectedService: string;
  onSelect: (id: string) => void;
  providerIsTelehealthOnly: boolean;
  colors: any;
}) => {
  if (!services) return null;
  return (
    <View style={styles.specialtyGrid}>
      {services.map((service) => {
        const isSelected = selectedService === service.id;
        const isDisabled = providerIsTelehealthOnly && !!service.inPersonOnly;
        return (
          <TouchableOpacity
            key={service.id}
            style={[styles.specialtyCard, {
              backgroundColor: isDisabled ? colors.background
                : isSelected ? colors.primary + '15' : colors.background,
              borderColor: isDisabled ? colors.border
                : isSelected ? colors.primary : colors.border,
              borderWidth: isSelected && !isDisabled ? 2 : 1,
              opacity: isDisabled ? 0.4 : 1,
            }]}
            onPress={() => !isDisabled && onSelect(service.id)}
            activeOpacity={isDisabled ? 1 : 0.7}
            disabled={isDisabled}
          >
            <Text style={styles.specialtyIcon}>{service.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.specialtyLabel, {
                color: isDisabled ? colors.subtext : isSelected ? colors.primary : colors.text,
              }]}>
                {service.label}
              </Text>
              <Text style={[styles.specialtyDesc, { color: colors.subtext }]} numberOfLines={2}>
                {isDisabled ? 'In-person only' : service.description}
              </Text>
            </View>
            {isSelected && !isDisabled && (
              <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { isGuest, isFullAccount } = useAuth();

  const [provider, setProvider]         = useState<any>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  const [patientOptions, setPatientOptions]       = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [guardianName, setGuardianName]           = useState('');
  const [guardianPhone, setGuardianPhone]         = useState('');
  const [profilePrefilled, setProfilePrefilled]   = useState(false);

  const [selectedVisitType, setSelectedVisitType]           = useState('');
  const [selectedSpecialtyService, setSelectedSpecialtyService] = useState('');
  const [reasonForVisit, setReasonForVisit]                 = useState('');
  const [visitTypes, setVisitTypes]                         = useState<VisitType[]>(DEFAULT_VISIT_TYPES);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [timeSlots, setTimeSlots]       = useState<string[]>([]);
  const [takenSlots, setTakenSlots]     = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayIsClosed, setDayIsClosed]   = useState(false);
  const [closedDayName, setClosedDayName] = useState('');

  const [patientName, setPatientName]   = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => { if (isGuest) setShowUpgradePrompt(true); }, [isGuest]);

  useEffect(() => {
    loadProvider();
    loadPatientOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPatientOptions = async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
      setPatientOptions([{ id: 'self', name: 'Me', subtitle: 'Account holder', isMinor: false }]);
      setSelectedPatientId('self');
      return;
    }
    let selfName = 'Me'; let selfPhone = '';
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
        if (name) selfName = name;
        else if (data.displayName) selfName = data.displayName.trim();
        else if (user.email) selfName = user.email.split('@')[0];
        selfPhone = data.phone || '';
        setGuardianName(selfName); setGuardianPhone(selfPhone);
        if (selfPhone) setProfilePrefilled(true);
      }
    } catch { if (user.email) selfName = user.email.split('@')[0]; }

    const options: PatientOption[] = [{
      id: 'self', name: selfName, subtitle: 'Account holder', isMinor: false, phone: selfPhone,
    }];
    setPatientName(selfName); setPatientPhone(selfPhone); setSelectedPatientId('self');

    try {
      const depsSnap = await getDocs(collection(db, 'users', user.uid, 'dependents'));
      depsSnap.forEach((d) => {
        const dep = d.data();
        const age = calculateAge(dep.dateOfBirth);
        options.push({
          id: d.id, name: `${dep.firstName} ${dep.lastName}`,
          subtitle: `${dep.relationship} · ${age} years old`,
          isMinor: age < 18, phone: dep.phone || '',
        });
      });
    } catch { /* non-critical */ }
    setPatientOptions(options);
  };

  const handlePatientSelect = (option: PatientOption) => {
    setSelectedPatientId(option.id);
    setPatientName(option.name);
    setPatientPhone(option.phone || '');
    setProfilePrefilled(option.id === 'self' && !!option.phone);
  };

  // ── Build visit types — Meet & Greet always shown ─────────────────────────
  useEffect(() => {
    if (!provider) return;
    const offered = provider.interviewConsult?.offered === true;
    const meetGreet: VisitType = {
      id: 'meet_greet',
      label: offered
        ? `Meet & Greet — $${provider.interviewConsult.price}`
        : 'Meet & Greet',
      icon: '🤝',
      description: offered
        ? `${provider.interviewConsult.duration} min intro consultation`
        : 'Not offered by this provider',
      disabled: !offered,
      disabledReason: 'This provider has not enabled Meet & Greet consultations yet',
    };
    setVisitTypes([meetGreet, ...DEFAULT_VISIT_TYPES]);
  }, [provider]);

  useEffect(() => { setSelectedSpecialtyService(''); }, [selectedVisitType]);

  useEffect(() => {
    if (!selectedDate) return;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayName = DAY_NAMES[localDate.getDay()];
    const readableDayName = localDate.toLocaleDateString('en-US', { weekday: 'long' });
    const hours = provider?.hours;
    if (hours?.[dayName]) {
      const dh = hours[dayName];
      if (dh.closed) { setTimeSlots([]); setDayIsClosed(true); setClosedDayName(readableDayName); setSelectedTime(''); return; }
      if (dh.open && dh.close) { setTimeSlots(generateSlotsForRange(dh.open, dh.close)); setDayIsClosed(false); setClosedDayName(''); setSelectedTime(''); return; }
    }
    setTimeSlots(generateSlotsForRange('09:00', '17:00'));
    setDayIsClosed(false); setClosedDayName(''); setSelectedTime('');
  }, [selectedDate, provider]);

  useEffect(() => {
    if (!selectedDate || !id) { setTakenSlots(new Set()); return; }
    const fetchTakenSlots = async () => {
      setLoadingSlots(true);
      try {
        const slotDoc = await getDoc(doc(db, 'availability', id as string, 'slots', selectedDate));
        if (slotDoc.exists()) {
          const data = slotDoc.data();
          setTakenSlots(new Set<string>(Object.entries(data).filter(([, v]) => v === true).map(([k]) => k)));
        } else { setTakenSlots(new Set()); }
      } catch { setTakenSlots(new Set()); }
      finally { setLoadingSlots(false); }
    };
    fetchTakenSlots();
  }, [selectedDate, id]);

  const loadProvider = async () => {
    if (!id) return;
    try {
      const providerDoc = await getDoc(doc(db, 'providers', id));
      if (providerDoc.exists()) setProvider({ id: providerDoc.id, ...providerDoc.data() });
    } catch (error) {
      if (__DEV__) console.error('Error loading provider:', error);
      Alert.alert('Error', 'Failed to load provider details');
    } finally { setLoadingProvider(false); }
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
  const maxDateString = maxDate.toISOString().split('T')[0];

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const getVisitTypeLabel  = (typeId: string) => visitTypes.find((t) => t.id === typeId)?.label ?? typeId;
  const getSpecialtyServiceLabel = (serviceId: string) => {
    const services = getSpecialtyServices(provider?.specialty || '');
    return services?.find((s) => s.id === serviceId)?.label ?? serviceId;
  };

  const selectedPatient = patientOptions.find((p) => p.id === selectedPatientId);
  const providerIsTelehealthOnly = provider?.telehealthOnly === true;
  const isTelehealthIncompatible = TELEHEALTH_INCOMPATIBLE.has(selectedVisitType);
  const isUrgentCare = selectedVisitType === 'urgent';

  const specialtyServices = provider ? getSpecialtyServices(provider.specialty || '') : null;
  const showSpecialtyStep  = specialtyServices && selectedVisitType &&
    !['lab_work', 'imaging', 'meet_greet'].includes(selectedVisitType);
  const specialtyComplete  = !showSpecialtyStep || !!selectedSpecialtyService;

  // ── handleBooking with rate limit + email verification ────────────────────
  const handleBooking = async () => {
    if (isGuest || !isFullAccount) { setShowUpgradePrompt(true); return; }
    if (!selectedVisitType) { Alert.alert('Visit Type Required', 'Please select the type of visit.'); return; }
    if (showSpecialtyStep && !selectedSpecialtyService) {
      Alert.alert('Required', 'Please select the specific service you need.'); return;
    }
    if (!reasonForVisit.trim()) { Alert.alert('Reason Required', 'Please describe the reason for your visit.'); return; }

    const sanitizedData = {
      patientName: sanitizeText(patientName),
      patientPhone: sanitizePhone(patientPhone),
      date: selectedDate, time: selectedTime, notes: sanitizeText(notes),
    };

    const validation = validateBooking(sanitizedData);
    if (!validation.valid) {
      Alert.alert('Validation Error', Object.values(validation.errors)[0] as string); return;
    }

    const user = auth.currentUser;
    if (!user) { Alert.alert('Error', 'You must be signed in to book.'); return; }

    // ── Rate limit check ────────────────────────────────────────────────────
    const rateCheck = await checkBookingRateLimit(user.uid);
    if (!rateCheck.allowed) {
      Alert.alert('Too Many Requests', rateCheck.reason ?? 'Please wait before making another booking.');
      return;
    }

    // ── Email verification check (soft during beta) ─────────────────────────
    const verificationCheck = await checkEmailVerification();
    if (!verificationCheck.isVerified) {
      if (!verificationCheck.canProceed) {
        showVerificationPrompt();
        return;
      }
      // Soft mode: warn but let through
      showVerificationPrompt();
    }

    setLoading(true);
    try {
      const isMinorBooking = selectedPatient?.isMinor ?? false;

      const bookingData: Record<string, any> = {
        userId: user.uid,
        providerId: id,
        providerName: provider.name,
        providerSpecialty: provider.specialty,
        bookingFor: selectedPatientId === 'self' ? 'self' : 'dependent',
        dependentId: selectedPatientId !== 'self' ? selectedPatientId : null,
        isMinorPatient: isMinorBooking,
        visitType: selectedVisitType,
        visitTypeLabel: getVisitTypeLabel(selectedVisitType),
        ...(selectedSpecialtyService ? {
          serviceCategory: selectedSpecialtyService,
          serviceCategoryLabel: getSpecialtyServiceLabel(selectedSpecialtyService),
        } : {}),
        reasonForVisit: sanitizeText(reasonForVisit),
        date: sanitizedData.date, time: sanitizedData.time,
        patientName: sanitizedData.patientName, patientPhone: sanitizedData.patientPhone,
        notes: sanitizedData.notes,
        status: 'pending', createdAt: serverTimestamp(),
      };

      if (isMinorBooking) {
        bookingData.guardianName = guardianName;
        bookingData.guardianPhone = guardianPhone;
      }

      const slotRef = doc(db, 'availability', id as string, 'slots', sanitizedData.date);
      let bookingRef: any = null;

      await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(slotRef);
        const slotData = slotDoc.exists() ? slotDoc.data() : {};
        if (slotData[sanitizedData.time] === true) throw new Error('SLOT_TAKEN');
        bookingRef = doc(collection(db, 'bookings'));
        transaction.set(bookingRef, bookingData);
        transaction.set(slotRef, { ...slotData, [sanitizedData.time]: true });
      });

      // Record booking in rate limiter after successful creation
      await recordBookingCreation(user.uid);
      logBookingCreated(user.uid, bookingRef.id, id as string, selectedVisitType);
      logAnalyticsEvent('booking_created', {
        specialty: provider.specialty || '',
        visitType: selectedVisitType,
        bookingFor: selectedPatientId === 'self' ? 'self' : 'dependent',
        isMinor: selectedPatient?.isMinor ?? false,
      });


      if (__DEV__) console.log('✅ Booking created:', bookingRef.id);
      await sendBookingConfirmationSMS(
        sanitizedData.patientPhone, provider.name,
        formatDate(sanitizedData.date), sanitizedData.time, bookingRef.id
      );

      Alert.alert(
        'Booking Requested!',
        `Your ${getVisitTypeLabel(selectedVisitType)} request for ${sanitizedData.patientName} on ${formatDate(sanitizedData.date)} at ${sanitizedData.time} has been submitted.`,
        [{ text: 'OK', onPress: () => router.push(`/booking/confirmation?bookingId=${bookingRef.id}` as any) }]
      );
    } catch (error: any) {
      if (__DEV__) console.error('❌ Booking error:', error);
      if (error.message === 'SLOT_TAKEN') {
        try {
          const slotDoc = await getDoc(doc(db, 'availability', id as string, 'slots', selectedDate));
          if (slotDoc.exists()) {
            const data = slotDoc.data();
            setTakenSlots(new Set(Object.entries(data).filter(([, v]) => v === true).map(([k]) => k)));
          }
        } catch { /* non-critical */ }
        setSelectedTime('');
        Alert.alert('Slot No Longer Available', 'Someone just booked that time. Please select a different time.');
      } else {
        logError(error, 'Booking');
        Alert.alert('Error', 'Failed to create booking. Please try again.');
      }
    } finally { setLoading(false); }
  };

  if (loadingProvider) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading provider...</Text>
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Provider not found</Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Book Appointment</Text>
        </View>
        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required to Book</Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to book appointments with {provider.name}.
          </Text>
          <TouchableOpacity style={[styles.createAccountButton, { backgroundColor: colors.primary }]} onPress={() => setShowUpgradePrompt(true)}>
            <Text style={styles.createAccountButtonText}>Create Free Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backToProviderButton} onPress={() => router.back()}>
            <Text style={[styles.backToProviderText, { color: colors.subtext }]}>Go back to provider</Text>
          </TouchableOpacity>
        </View>
        <GuestUpgradePrompt visible={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} reason="book appointments" />
      </View>
    );
  }

  const canBook = selectedPatientId && selectedVisitType && specialtyComplete &&
    reasonForVisit.trim() && selectedDate && selectedTime;
  const dateStep = showSpecialtyStep ? 5 : 4;
  const timeStep = showSpecialtyStep ? 6 : 5;
  const infoStep = showSpecialtyStep ? 7 : 6;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Book Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Provider card */}
        <View style={[styles.providerCard, { backgroundColor: colors.card }]}>
          <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {provider.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'PR'}
            </Text>
          </View>
          <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
          <Text style={[styles.providerSpecialty, { color: colors.primary }]}>{provider.specialty}</Text>
          {providerIsTelehealthOnly && (
            <View style={[styles.telehealthBadge, { backgroundColor: '#3B82F615' }]}>
              <Text style={[styles.telehealthBadgeText, { color: '#3B82F6' }]}>💻 Virtual Care Only</Text>
            </View>
          )}
        </View>

        {/* Step 1 — Who is this for? */}
        {patientOptions.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>1</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Who is this for?</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>Select the patient for this appointment</Text>
            <View style={styles.patientOptions}>
              {patientOptions.map((option) => {
                const isSelected = selectedPatientId === option.id;
                return (
                  <TouchableOpacity key={option.id}
                    style={[styles.patientCard, {
                      backgroundColor: isSelected ? colors.primary + '15' : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    }]}
                    onPress={() => handlePatientSelect(option)} activeOpacity={0.7}
                  >
                    <View style={[styles.patientAvatar, { backgroundColor: isSelected ? colors.primary : colors.border }]}>
                      <Text style={styles.patientAvatarText}>{option.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.patientInfo}>
                      <Text style={[styles.patientName, { color: isSelected ? colors.primary : colors.text }]}>
                        {option.name}{option.id === 'self' ? ' (Me)' : ''}
                      </Text>
                      <Text style={[styles.patientSubtitle, { color: colors.subtext }]}>{option.subtitle}</Text>
                      {option.isMinor && (
                        <View style={[styles.minorTag, { backgroundColor: colors.warning + '20' }]}>
                          <Text style={[styles.minorTagText, { color: colors.warning }]}>Minor · Guardian info will be included</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            {patientOptions.length === 1 && (
              <TouchableOpacity style={[styles.addFamilyPrompt, { borderColor: colors.border }]} onPress={() => router.push('/profile/family' as any)}>
                <Text style={[styles.addFamilyText, { color: colors.primary }]}>+ Book for a family member</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2 — Visit Type */}
        {selectedPatientId && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>2</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Type of Visit</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>Select what best describes this appointment</Text>
            <VisitTypeSelector
              visitTypes={visitTypes} selectedType={selectedVisitType}
              onSelect={setSelectedVisitType} providerIsTelehealthOnly={providerIsTelehealthOnly} colors={colors}
            />
            {isTelehealthIncompatible && (
              <View style={[styles.warningBanner, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                <Text style={[styles.warningBannerText, { color: '#EF4444' }]}>
                  🚫 This service requires an in-person visit. Lab work and imaging cannot be done via virtual care.
                </Text>
              </View>
            )}
            {isUrgentCare && (
              <View style={[styles.warningBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                <Text style={[styles.warningBannerText, { color: '#F59E0B' }]}>
                  ℹ️ Urgent care may be available virtually for prescription needs and minor symptoms. Physical injuries require in-person care.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Step 3 — Specialty-specific service */}
        {showSpecialtyStep && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>3</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>What specifically?</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>
              Select the condition or service that best matches. This helps the provider prepare for your visit.
            </Text>
            <SpecialtyServiceSelector
              services={specialtyServices} selectedService={selectedSpecialtyService}
              onSelect={setSelectedSpecialtyService} providerIsTelehealthOnly={providerIsTelehealthOnly} colors={colors}
            />
          </View>
        )}

        {/* Step 4 — Reason */}
        {selectedVisitType && specialtyComplete && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepBadgeText}>{showSpecialtyStep ? 4 : 3}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Reason for Visit</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>Add any details the provider should know (max 300 characters)</Text>
            <TextInput
              style={[styles.reasonInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={selectedSpecialtyService
                ? `Any additional details about your ${getSpecialtyServiceLabel(selectedSpecialtyService).toLowerCase()}...`
                : 'e.g. Symptoms, duration, specific concerns...'}
              placeholderTextColor={colors.subtext}
              value={reasonForVisit}
              onChangeText={(text) => setReasonForVisit(text.slice(0, 300))}
              multiline numberOfLines={3} textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.subtext }]}>{reasonForVisit.length}/300</Text>
          </View>
        )}

        {/* Step — Date */}
        {selectedVisitType && specialtyComplete && reasonForVisit.trim() && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>{dateStep}</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Date</Text>
            </View>
            <Calendar
              minDate={today} maxDate={maxDateString}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={{ [selectedDate]: { selected: true, selectedColor: colors.primary } }}
              theme={{ backgroundColor: colors.card, calendarBackground: colors.card, textSectionTitleColor: colors.text, selectedDayBackgroundColor: colors.primary, selectedDayTextColor: '#ffffff', todayTextColor: colors.primary, dayTextColor: colors.text, textDisabledColor: colors.subtext, monthTextColor: colors.text, arrowColor: colors.primary }}
            />
            {selectedDate && (
              <View style={styles.selectedDateDisplay}>
                <Text style={[styles.selectedDateLabel, { color: colors.subtext }]}>Selected:</Text>
                <Text style={[styles.selectedDateValue, { color: colors.text }]}>{formatDate(selectedDate)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Step — Time */}
        {selectedDate && selectedVisitType && specialtyComplete && reasonForVisit.trim() && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>{timeStep}</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Time</Text>
            </View>
            {loadingSlots && (
              <View style={styles.slotsLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.slotsLoadingText, { color: colors.subtext }]}>Checking availability...</Text>
              </View>
            )}
            {dayIsClosed ? (
              <View style={[styles.closedNotice, { backgroundColor: colors.background }]}>
                <Text style={[styles.closedNoticeText, { color: colors.subtext }]}>
                  🚫 Not available on {closedDayName}s. Please select a different date.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.timeSlots}>
                  {timeSlots.map((time) => {
                    const isSelected = selectedTime === time;
                    const isTaken = takenSlots.has(time);
                    return (
                      <TouchableOpacity key={time}
                        style={[styles.timeSlot, {
                          backgroundColor: isTaken ? colors.background : isSelected ? colors.primary : colors.background,
                          borderColor: isTaken ? colors.border : isSelected ? colors.primary : colors.border,
                          opacity: isTaken ? 0.45 : 1,
                        }]}
                        onPress={() => !isTaken && setSelectedTime(time)}
                        disabled={isTaken} activeOpacity={isTaken ? 1 : 0.7}
                      >
                        <Text style={[styles.timeText, { color: isTaken ? colors.subtext : isSelected ? '#fff' : colors.text }]}>{time}</Text>
                        {isTaken && <Text style={[styles.takenLabel, { color: colors.subtext }]}>Taken</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {takenSlots.size > 0 && <Text style={[styles.takenNote, { color: colors.subtext }]}>Greyed-out slots are already booked</Text>}
              </>
            )}
          </View>
        )}

        {/* Step — Patient Info */}
        {selectedDate && selectedTime && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}><Text style={styles.stepBadgeText}>{infoStep}</Text></View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {selectedPatient?.isMinor ? 'Patient & Guardian Info' : 'Your Information'}
              </Text>
            </View>
            {profilePrefilled && (
              <View style={[styles.prefilledBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Text style={[styles.prefilledText, { color: colors.primary }]}>✓ Pre-filled from your profile — edit if needed</Text>
              </View>
            )}
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder="Patient Full Name *" placeholderTextColor={colors.subtext} value={patientName} onChangeText={setPatientName} />
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder="Contact Phone Number *" placeholderTextColor={colors.subtext} value={patientPhone} onChangeText={setPatientPhone} keyboardType="phone-pad" />
            {selectedPatient?.isMinor && (
              <>
                <View style={[styles.guardianDivider, { borderColor: colors.border }]}>
                  <Text style={[styles.guardianLabel, { color: colors.subtext }]}>Guardian / Parent Information</Text>
                </View>
                <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder="Guardian Full Name *" placeholderTextColor={colors.subtext} value={guardianName} onChangeText={setGuardianName} />
                <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder="Guardian Phone Number *" placeholderTextColor={colors.subtext} value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" />
              </>
            )}
            <TextInput style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} placeholder="Additional Notes (Optional)" placeholderTextColor={colors.subtext} value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" />
          </View>
        )}

        {/* Summary */}
        {canBook && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking Summary</Text>
            {[
              ['Provider', provider.name],
              ['Patient', `${patientName}${selectedPatient?.isMinor ? ' (Minor)' : ''}`],
              ['Visit Type', getVisitTypeLabel(selectedVisitType)],
              ...(selectedSpecialtyService ? [['Service', getSpecialtyServiceLabel(selectedSpecialtyService)]] : []),
              ['Reason', reasonForVisit],
              ['Date', formatDate(selectedDate)],
              ['Time', selectedTime],
            ].map(([label, value]) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.subtext }]}>{label}:</Text>
                <Text style={[styles.summaryValue, {
                  color: ['Visit Type','Service'].includes(label as string) ? colors.primary : colors.text,
                }]} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {canBook && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleBooking} disabled={loading}
          >
            <Text style={styles.bookButtonText}>{loading ? 'Booking...' : 'Request Appointment'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorText: { fontSize: 18, marginBottom: 20 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  providerCard: { margin: 16, padding: 20, borderRadius: 16, alignItems: 'center' },
  providerAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  providerName: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  providerSpecialty: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  telehealthBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  telehealthBadgeText: { fontSize: 12, fontWeight: '600' },
  section: { margin: 16, padding: 20, borderRadius: 16 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stepBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  patientOptions: { gap: 10 },
  patientCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1 },
  patientAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  patientAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  patientSubtitle: { fontSize: 12 },
  minorTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  minorTagText: { fontSize: 11, fontWeight: '600' },
  checkmark: { fontSize: 20, fontWeight: 'bold', marginLeft: 8 },
  addFamilyPrompt: { marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center' },
  addFamilyText: { fontSize: 14, fontWeight: '600' },
  visitTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  visitTypeCard: { width: '47%', padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'flex-start' },
  visitTypeIcon: { fontSize: 22, marginBottom: 6 },
  visitTypeLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4, lineHeight: 18 },
  visitTypeDesc: { fontSize: 11, lineHeight: 16 },
  warningBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
  warningBannerText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  specialtyGrid: { gap: 8 },
  specialtyCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  specialtyIcon: { fontSize: 22, marginTop: 2 },
  specialtyLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3, lineHeight: 18 },
  specialtyDesc: { fontSize: 12, lineHeight: 16 },
  reasonInput: { padding: 14, borderRadius: 12, borderWidth: 1.5, fontSize: 15, minHeight: 90, marginBottom: 6 },
  charCount: { fontSize: 11, textAlign: 'right' },
  selectedDateDisplay: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  selectedDateLabel: { fontSize: 12, marginBottom: 4 },
  selectedDateValue: { fontSize: 16, fontWeight: '600' },
  closedNotice: { padding: 16, borderRadius: 10 },
  closedNoticeText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  slotsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  slotsLoadingText: { fontSize: 13 },
  timeSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSlot: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, minWidth: 80, alignItems: 'center' },
  timeText: { fontSize: 15, fontWeight: '600' },
  takenLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  takenNote: { fontSize: 11, marginTop: 10, textAlign: 'center' },
  prefilledBanner: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 14 },
  prefilledText: { fontSize: 13, fontWeight: '500' },
  guardianDivider: { borderTopWidth: 1, paddingTop: 12, marginBottom: 12, marginTop: 4 },
  guardianLabel: { fontSize: 12, fontWeight: '600' },
  input: { padding: 15, borderRadius: 12, borderWidth: 2, fontSize: 16, marginBottom: 12 },
  textArea: { padding: 15, borderRadius: 12, borderWidth: 2, fontSize: 16, minHeight: 100 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },
  summaryLabel: { fontSize: 16 },
  summaryValue: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  bookButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  bookButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, marginTop: 20 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, marginBottom: 16, width: '100%', alignItems: 'center' },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backToProviderButton: { paddingVertical: 12 },
  backToProviderText: { fontSize: 15 },
});
