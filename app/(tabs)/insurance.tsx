import { logInsuranceUpdated } from '../../utils/auditLog';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert, FlatList, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { db } from '../../firebase';

// ─── Coverage types ───────────────────────────────────────────────────────────
const COVERAGE_TYPES = [
  { id: 'medical', label: 'Medical', icon: '🏥', color: '#14B8A6' },
  { id: 'dental',  label: 'Dental',  icon: '🦷', color: '#3B82F6' },
  { id: 'vision',  label: 'Vision',  icon: '👁️', color: '#8B5CF6' },
];

// ─── Plan lists ───────────────────────────────────────────────────────────────
const FEATURED_MEDICAL = [
  'SoonerCare (Medicaid)',
  'CommunityCare',
  'BlueCross BlueShield of Oklahoma',
  'Aetna Better Health of Oklahoma',
  'Humana Healthy Horizons Oklahoma',
  'Molina Healthcare of Oklahoma',
  'Ambetter from Superior HealthPlan',
];

const ALL_MEDICAL = [
  'Aetna','Aetna Better Health','Aetna Better Health of Oklahoma',
  'Allwell from Oklahoma Complete Health','Ambetter from Superior HealthPlan',
  'AmeriHealth Caritas','Anthem','Anthem Blue Cross','Anthem Blue Cross Blue Shield',
  'Arkansas Blue Cross Blue Shield','Avmed',
  'Banner Health','Blue Care Network','Blue Cross Blue Shield',
  'Blue Cross Blue Shield of Oklahoma','BlueCross BlueShield of Oklahoma',
  'Bright Health','Buckeye Health Plan',
  'Caresource','Centene','Cigna','CommunityCare',
  'Coordinated Care','Coventry Health Care',
  'Geisinger Health Plan','GlobalHealth Oklahoma',
  'Harvard Pilgrim Health Care','Health Net','HealthPartners','Highmark',
  'Horizon Blue Cross Blue Shield','Humana','Humana Healthy Horizons Oklahoma',
  'Independence Blue Cross',
  'Kaiser Permanente',
  'Magellan Health','Medica','Medical Mutual of Ohio','Molina Healthcare',
  'Molina Healthcare of Oklahoma','Multiplan','MVP Health Care',
  'Oklahoma Complete Health','Oscar Health',
  'Premera Blue Cross','Priority Health',
  'QualChoice Health Insurance',
  'Regence BlueShield',
  'SelectHealth','Simply Healthcare','SoonerCare (Medicaid)',
  'Sunshine Health','Superior HealthPlan',
  'Tricare','Tufts Health Plan',
  'UMR','United Healthcare','United Healthcare Community Plan',
  'UPMC Health Plan',
  'VA Community Care','WellCare','WellCare of Oklahoma',
].sort();

const FEATURED_DENTAL = [
  'SoonerCare Dental',
  'Delta Dental',
  'Cigna Dental',
  'Aetna Dental',
  'MetLife Dental',
  'Guardian Dental',
  'Humana Dental',
];

const ALL_DENTAL = [
  'Aetna Dental','Allstate Benefits Dental','Ameritas',
  'Assurant Dental','Beam Dental','Blue Cross Blue Shield Dental',
  'Careington Dental','Cigna Dental','Delta Dental','Denali Dental',
  'Dental Select','DentaQuest','Envolve Dental',
  'Guardian Dental','Humana Dental','Liberty Dental',
  'Lincoln Financial Dental','MetLife Dental','Mutual of Omaha Dental',
  'Premier Dental','Principal Dental','Renaissance Dental',
  'Spirit Dental','SoonerCare Dental','Sun Life Dental',
  'Unum Dental','United Concordia','UnitedHealthcare Dental',
].sort();

const FEATURED_VISION = [
  'SoonerCare Vision',
  'VSP Vision Care',
  'EyeMed',
  'Davis Vision',
  'Superior Vision',
  'Spectera',
];

const ALL_VISION = [
  'Aetna Vision','Avesis Vision','Blue Cross Blue Shield Vision',
  'Cigna Vision','Davis Vision','EyeMed',
  'Guardian Vision','Humana Vision','MESVision',
  'NVA Vision','Opticare Vision','Spectera',
  'SoonerCare Vision','Superior Vision','Unum Vision',
  'United Healthcare Vision','UnitedHealthcare Vision',
  'VSP Vision Care',
].sort();

const PAYMENT_OPTIONS = [
  { id: 'out_of_pocket', label: 'Out of Pocket',       icon: '💵', description: 'Pay directly for care' },
  { id: 'sliding_scale', label: 'Sliding Scale Fee',   icon: '📊', description: 'Fee based on income level' },
  { id: 'health_sharing',label: 'Health Sharing Plan', icon: '🤝', description: 'Member-based cost sharing' },
  { id: 'charity_care',  label: 'Charity Care',        icon: '🏥', description: 'Free or reduced cost program' },
];

// ─── Generic plan search modal ────────────────────────────────────────────────
const PlanSearchModal = ({
  visible, title, onClose, onSelect, plans, colors,
}: {
  visible: boolean; title: string; onClose: () => void;
  onSelect: (p: string) => void; plans: string[]; colors: any;
}) => {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? plans.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : plans;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={() => { onClose(); setSearch(''); }}>
              <Text style={[styles.modalClose, { color: colors.subtext }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search..." placeholderTextColor={colors.subtext}
              value={search} onChangeText={setSearch} autoFocus autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: colors.subtext, fontSize: 16, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.resultCount, { color: colors.subtext }]}>
            {filtered.length} carrier{filtered.length !== 1 ? 's' : ''}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.planRow, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[styles.planRowText, { color: colors.text }]}>{item}</Text>
                <Text style={{ color: colors.subtext }}>›</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Coverage summary card ────────────────────────────────────────────────────
const CoverageCard = ({
  type, plan, paymentOption, colors, onEdit,
}: {
  type: typeof COVERAGE_TYPES[0];
  plan: string; paymentOption?: string; colors: any; onEdit: () => void;
}) => {
  const paymentLabel = PAYMENT_OPTIONS.find(p => p.id === paymentOption)?.label;
  const displayText = plan || (paymentOption ? paymentLabel : null);
  if (!displayText) return null;

  return (
    <View style={[styles.coverageCard, {
      backgroundColor: colors.card,
      borderColor: type.color + '40',
      borderLeftColor: type.color,
    }]}>
      <View style={[styles.coverageCardIcon, { backgroundColor: type.color + '15' }]}>
        <Text style={styles.coverageCardIconText}>{type.icon}</Text>
      </View>
      <View style={styles.coverageCardInfo}>
        <Text style={[styles.coverageCardType, { color: type.color }]}>{type.label}</Text>
        <Text style={[styles.coverageCardPlan, { color: colors.text }]} numberOfLines={1}>
          {displayText}
        </Text>
        {type.id === 'medical' && !plan && paymentOption && (
          <Text style={[styles.coverageCardNote, { color: colors.subtext }]}>No insurance</Text>
        )}
      </View>
      {/* Explicit Edit button — more tappable than relying on full-card press */}
      <TouchableOpacity
        style={[styles.editButton, { backgroundColor: type.color + '15' }]}
        onPress={onEdit}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.editButtonText, { color: type.color }]}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoverageScreen() {
  const { colors } = useTheme();
  const { user, isGuest, isFullAccount } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [activeType, setActiveType] = useState<'medical' | 'dental' | 'vision'>('medical');

  // Medical
  const [insuranceType, setInsuranceType] = useState<'insured' | 'uninsured' | ''>('');
  const [medicalPlan, setMedicalPlan]     = useState('');
  const [policyNumber, setPolicyNumber]   = useState('');
  const [paymentOption, setPaymentOption] = useState('');

  // Dental / Vision
  const [dentalPlan, setDentalPlan] = useState('');
  const [visionPlan, setVisionPlan] = useState('');

  const [saving, setSaving] = useState(false);

  // Search modal state — one modal component, driven by which type is searching
  const [searchTarget, setSearchTarget] = useState<'medical' | 'dental' | 'vision' | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // ── Load on focus ─────────────────────────────────────────────────────────
  const loadCoverage = useCallback(async () => {
    if (!isFullAccount || !user) return;
    try {
      const snap = await getDoc(doc(db, 'insurance', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setInsuranceType(data.insuranceType || (data.medical ? 'insured' : ''));
        setMedicalPlan(data.provider || data.medical || '');
        setPolicyNumber(data.policy || '');
        setPaymentOption(data.paymentOption || '');
        setDentalPlan(data.dental || '');
        setVisionPlan(data.vision || '');
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading coverage:', error);
    }
  }, [isFullAccount, user]);

  useFocusEffect(useCallback(() => { loadCoverage(); }, [loadCoverage]));

  // Switch tab AND scroll down to the editor section
  const handleEdit = (typeId: 'medical' | 'dental' | 'vision') => {
    setActiveType(typeId);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 400, animated: true });
    }, 100);
  };

  const handleSave = async () => {
    if (isGuest) { setShowUpgradePrompt(true); return; }
    try {
      setSaving(true);
      await setDoc(doc(db, 'insurance', user!.uid), {
        insuranceType,
        provider: insuranceType === 'insured'   ? medicalPlan  : '',
        medical:  insuranceType === 'insured'   ? medicalPlan  : '',
        policy:   insuranceType === 'insured'   ? policyNumber : '',
        paymentOption: insuranceType === 'uninsured' ? paymentOption : '',
        dental: dentalPlan,
        vision: visionPlan,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Saved ✓', 'Your coverage details have been updated.');
      logInsuranceUpdated(user!.uid);
    } catch (error) {
      if (__DEV__) console.error('Error saving coverage:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const savedCount = [
    (insuranceType === 'insured' && medicalPlan) || (insuranceType === 'uninsured' && paymentOption),
    dentalPlan,
    visionPlan,
  ].filter(Boolean).length;

  // ── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>My Coverage</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>Manage your insurance</Text>
        </View>
        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required</Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to save your medical, dental, and vision coverage details.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePrompt(true)}
          >
            <Text style={styles.primaryButtonText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>
        <GuestUpgradePrompt visible={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} reason="save your insurance information" />
      </View>
    );
  }

  // ── Helpers for dental/vision "Other" expansion ───────────────────────────
  const dentalIsOther  = dentalPlan && !FEATURED_DENTAL.includes(dentalPlan);
  const visionIsOther  = visionPlan && !FEATURED_VISION.includes(visionPlan);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Coverage</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {savedCount > 0
            ? `${savedCount} of 3 plan${savedCount !== 1 ? 's' : ''} saved`
            : 'Add your coverage details'}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Coverage summary cards ───────────────────────────────── */}
        {savedCount > 0 && (
          <View style={styles.summarySection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Your Plans</Text>
            {COVERAGE_TYPES.map((type) => {
              const plan = type.id === 'medical' ? medicalPlan
                : type.id === 'dental' ? dentalPlan : visionPlan;
              const po = type.id === 'medical' ? paymentOption : '';
              return (
                <CoverageCard
                  key={type.id}
                  type={type}
                  plan={plan}
                  paymentOption={po}
                  colors={colors}
                  onEdit={() => handleEdit(type.id as any)}
                />
              );
            })}
          </View>
        )}

        {/* ── Find in-network CTA ──────────────────────────────────── */}
        {savedCount > 0 && (
          <TouchableOpacity
            style={[styles.findNetworkButton, {
              backgroundColor: colors.primary + '15',
              borderColor: colors.primary + '40',
            }]}
            onPress={() => router.push('/(tabs)/' as any)}
          >
            <Text style={styles.findNetworkIcon}>🔍</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.findNetworkTitle, { color: colors.primary }]}>
                Find In-Network Providers
              </Text>
              <Text style={[styles.findNetworkSub, { color: colors.subtext }]}>
                Browse providers that accept your saved plan
              </Text>
            </View>
            <Text style={[styles.findNetworkArrow, { color: colors.primary }]}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Coming soon card ─────────────────────────────────────── */}
        <View style={[styles.comingSoonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.comingSoonTitle, { color: colors.text }]}>🚀 Coming Soon</Text>
          <Text style={[styles.comingSoonText, { color: colors.subtext }]}>
            In-network vs out-of-network badges, estimated cost by plan, and benefit summaries are on the roadmap.
          </Text>
        </View>

        {/* ── Type tabs ────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          {savedCount > 0 ? 'Update Coverage' : 'Add Your Coverage'}
        </Text>

        <View style={[styles.typeTabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {COVERAGE_TYPES.map((type) => {
            const isActive = activeType === type.id;
            const plan = type.id === 'medical' ? medicalPlan
              : type.id === 'dental' ? dentalPlan : visionPlan;
            const hasMedical = type.id === 'medical' && (medicalPlan || paymentOption);
            const hasPlan = hasMedical || !!plan;
            return (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeTab, isActive && {
                  borderBottomColor: type.color, borderBottomWidth: 2,
                }]}
                onPress={() => setActiveType(type.id as any)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={[styles.typeLabel, { color: isActive ? type.color : colors.subtext }]}>
                  {type.label}
                </Text>
                {hasPlan && <View style={[styles.savedDot, { backgroundColor: type.color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Medical tab ──────────────────────────────────────────── */}
        {activeType === 'medical' && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHeading, { color: colors.text }]}>
              Do you have medical insurance?
            </Text>

            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeCard, {
                  backgroundColor: insuranceType === 'insured' ? colors.primary + '15' : colors.card,
                  borderColor:     insuranceType === 'insured' ? colors.primary : colors.border,
                  borderWidth:     insuranceType === 'insured' ? 2 : 1,
                }]}
                onPress={() => { setInsuranceType('insured'); setPaymentOption(''); }}
              >
                <Text style={styles.typeCardIcon}>🏥</Text>
                <Text style={[styles.typeCardLabel, {
                  color: insuranceType === 'insured' ? colors.primary : colors.text,
                }]}>
                  Yes, I have insurance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeCard, {
                  backgroundColor: insuranceType === 'uninsured' ? colors.primary + '15' : colors.card,
                  borderColor:     insuranceType === 'uninsured' ? colors.primary : colors.border,
                  borderWidth:     insuranceType === 'uninsured' ? 2 : 1,
                }]}
                onPress={() => { setInsuranceType('uninsured'); setMedicalPlan(''); setPolicyNumber(''); }}
              >
                <Text style={styles.typeCardIcon}>💵</Text>
                <Text style={[styles.typeCardLabel, {
                  color: insuranceType === 'uninsured' ? colors.primary : colors.text,
                }]}>
                  No insurance
                </Text>
              </TouchableOpacity>
            </View>

            {insuranceType === 'insured' && (
              <>
                <Text style={[styles.planHeading, { color: colors.text }]}>Common Oklahoma Plans</Text>
                <View style={styles.chipsGrid}>
                  {FEATURED_MEDICAL.map((plan) => {
                    const isSelected = medicalPlan === plan;
                    return (
                      <TouchableOpacity
                        key={plan}
                        style={[styles.planChip, {
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderColor:     isSelected ? colors.primary : colors.border,
                        }]}
                        onPress={() => setMedicalPlan(isSelected ? '' : plan)}
                      >
                        <Text style={[styles.planChipText, { color: isSelected ? '#fff' : colors.text }]}>
                          {plan}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.planHeading, { color: colors.text }]}>Other Carrier</Text>
                <TouchableOpacity
                  style={[styles.searchField, {
                    backgroundColor: colors.card,
                    borderColor: medicalPlan && !FEATURED_MEDICAL.includes(medicalPlan)
                      ? colors.primary : colors.border,
                    borderWidth: medicalPlan && !FEATURED_MEDICAL.includes(medicalPlan) ? 2 : 1,
                  }]}
                  onPress={() => setSearchTarget('medical')}
                >
                  <Text style={{ fontSize: 18 }}>🔍</Text>
                  <Text style={[styles.searchFieldText, {
                    color: medicalPlan && !FEATURED_MEDICAL.includes(medicalPlan)
                      ? colors.primary : colors.subtext,
                  }]}>
                    {medicalPlan && !FEATURED_MEDICAL.includes(medicalPlan)
                      ? medicalPlan : 'Search 200+ carriers...'}
                  </Text>
                  {medicalPlan && !FEATURED_MEDICAL.includes(medicalPlan) && (
                    <TouchableOpacity onPress={() => setMedicalPlan('')}>
                      <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {medicalPlan && (
                  <View style={[styles.selectedBanner, {
                    backgroundColor: colors.success + '15', borderColor: colors.success,
                  }]}>
                    <Text style={[styles.selectedBannerText, { color: colors.success }]}>
                      ✓ Selected: {medicalPlan}
                    </Text>
                    <TouchableOpacity onPress={() => setMedicalPlan('')}>
                      <Text style={{ color: colors.subtext, fontSize: 13 }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.planHeading, { color: colors.text }]}>
                  Member / Policy Number
                  <Text style={{ fontWeight: '400', color: colors.subtext }}> (optional)</Text>
                </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: colors.card, color: colors.text, borderColor: colors.border,
                  }]}
                  placeholder="Your member or policy number"
                  placeholderTextColor={colors.subtext}
                  value={policyNumber}
                  onChangeText={setPolicyNumber}
                />
              </>
            )}

            {insuranceType === 'uninsured' && (
              <>
                <Text style={[styles.planHeading, { color: colors.text }]}>
                  How do you plan to pay for care?
                </Text>
                <View style={styles.paymentOptions}>
                  {PAYMENT_OPTIONS.map((option) => {
                    const isSelected = paymentOption === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.paymentCard, {
                          backgroundColor: isSelected ? colors.primary + '15' : colors.card,
                          borderColor:     isSelected ? colors.primary : colors.border,
                          borderWidth:     isSelected ? 2 : 1,
                        }]}
                        onPress={() => setPaymentOption(option.id)}
                      >
                        <Text style={styles.paymentIcon}>{option.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.paymentLabel, {
                            color: isSelected ? colors.primary : colors.text,
                          }]}>
                            {option.label}
                          </Text>
                          <Text style={[styles.paymentDesc, { color: colors.subtext }]}>
                            {option.description}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoNoteText, { color: colors.subtext }]}>
                    ℹ️ Many Oklahoma providers accept uninsured patients and offer payment plans.
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Dental tab ───────────────────────────────────────────── */}
        {activeType === 'dental' && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHeading, { color: colors.text }]}>
              Select your dental plan
            </Text>

            <Text style={[styles.planHeading, { color: colors.text }]}>Common Plans</Text>
            <View style={styles.chipsGrid}>
              {FEATURED_DENTAL.map((plan) => {
                const isSelected = dentalPlan === plan;
                return (
                  <TouchableOpacity
                    key={plan}
                    style={[styles.planChip, {
                      backgroundColor: isSelected ? '#3B82F6' : colors.card,
                      borderColor:     isSelected ? '#3B82F6' : colors.border,
                    }]}
                    onPress={() => setDentalPlan(isSelected ? '' : plan)}
                  >
                    <Text style={[styles.planChipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {plan}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Other dental carrier — search */}
            <Text style={[styles.planHeading, { color: colors.text }]}>Other Carrier</Text>
            <TouchableOpacity
              style={[styles.searchField, {
                backgroundColor: colors.card,
                borderColor: dentalIsOther ? '#3B82F6' : colors.border,
                borderWidth: dentalIsOther ? 2 : 1,
              }]}
              onPress={() => setSearchTarget('dental')}
            >
              <Text style={{ fontSize: 18 }}>🔍</Text>
              <Text style={[styles.searchFieldText, {
                color: dentalIsOther ? '#3B82F6' : colors.subtext,
              }]}>
                {dentalIsOther ? dentalPlan : 'Search dental carriers...'}
              </Text>
              {dentalIsOther && (
                <TouchableOpacity onPress={() => setDentalPlan('')}>
                  <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {dentalPlan && (
              <View style={[styles.selectedBanner, {
                backgroundColor: '#3B82F615', borderColor: '#3B82F6',
              }]}>
                <Text style={[styles.selectedBannerText, { color: '#3B82F6' }]}>
                  ✓ Selected: {dentalPlan}
                </Text>
                <TouchableOpacity onPress={() => setDentalPlan('')}>
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoNoteText, { color: colors.subtext }]}>
                ℹ️ Dental provider search coming soon. Your plan is saved to your profile.
              </Text>
            </View>
          </View>
        )}

        {/* ── Vision tab ───────────────────────────────────────────── */}
        {activeType === 'vision' && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHeading, { color: colors.text }]}>
              Select your vision plan
            </Text>

            <Text style={[styles.planHeading, { color: colors.text }]}>Common Plans</Text>
            <View style={styles.chipsGrid}>
              {FEATURED_VISION.map((plan) => {
                const isSelected = visionPlan === plan;
                return (
                  <TouchableOpacity
                    key={plan}
                    style={[styles.planChip, {
                      backgroundColor: isSelected ? '#8B5CF6' : colors.card,
                      borderColor:     isSelected ? '#8B5CF6' : colors.border,
                    }]}
                    onPress={() => setVisionPlan(isSelected ? '' : plan)}
                  >
                    <Text style={[styles.planChipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {plan}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Other vision carrier — search */}
            <Text style={[styles.planHeading, { color: colors.text }]}>Other Carrier</Text>
            <TouchableOpacity
              style={[styles.searchField, {
                backgroundColor: colors.card,
                borderColor: visionIsOther ? '#8B5CF6' : colors.border,
                borderWidth: visionIsOther ? 2 : 1,
              }]}
              onPress={() => setSearchTarget('vision')}
            >
              <Text style={{ fontSize: 18 }}>🔍</Text>
              <Text style={[styles.searchFieldText, {
                color: visionIsOther ? '#8B5CF6' : colors.subtext,
              }]}>
                {visionIsOther ? visionPlan : 'Search vision carriers...'}
              </Text>
              {visionIsOther && (
                <TouchableOpacity onPress={() => setVisionPlan('')}>
                  <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {visionPlan && (
              <View style={[styles.selectedBanner, {
                backgroundColor: '#8B5CF615', borderColor: '#8B5CF6',
              }]}>
                <Text style={[styles.selectedBannerText, { color: '#8B5CF6' }]}>
                  ✓ Selected: {visionPlan}
                </Text>
                <TouchableOpacity onPress={() => setVisionPlan('')}>
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoNoteText, { color: colors.subtext }]}>
                ℹ️ Vision provider search coming soon. Your plan is saved to your profile.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Coverage Info'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Single search modal — driven by searchTarget */}
      <PlanSearchModal
        visible={searchTarget === 'medical'}
        title="Search Medical Carriers"
        onClose={() => setSearchTarget(null)}
        onSelect={setMedicalPlan}
        plans={ALL_MEDICAL}
        colors={colors}
      />
      <PlanSearchModal
        visible={searchTarget === 'dental'}
        title="Search Dental Carriers"
        onClose={() => setSearchTarget(null)}
        onSelect={setDentalPlan}
        plans={ALL_DENTAL}
        colors={colors}
      />
      <PlanSearchModal
        visible={searchTarget === 'vision'}
        title="Search Vision Carriers"
        onClose={() => setSearchTarget(null)}
        onSelect={setVisionPlan}
        plans={ALL_VISION}
        colors={colors}
      />

      <GuestUpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        reason="save your insurance information"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Summary
  summarySection: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  coverageCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, marginBottom: 8,
  },
  coverageCardIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  coverageCardIconText: { fontSize: 20 },
  coverageCardInfo: { flex: 1 },
  coverageCardType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  coverageCardPlan: { fontSize: 15, fontWeight: '600' },
  coverageCardNote: { fontSize: 11, marginTop: 1 },
  // Explicit edit button — replaces the subtle "Edit ›" text
  editButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  editButtonText: { fontSize: 13, fontWeight: '700' },

  // Find in network
  findNetworkButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  findNetworkIcon: { fontSize: 24 },
  findNetworkTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  findNetworkSub: { fontSize: 12, lineHeight: 16 },
  findNetworkArrow: { fontSize: 20, fontWeight: '700' },

  // Coming soon
  comingSoonCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  comingSoonTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  comingSoonText: { fontSize: 13, lineHeight: 18 },

  // Tabs
  typeTabs: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  typeTab: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, position: 'relative' },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 13, fontWeight: '600' },
  savedDot: { position: 'absolute', top: 8, right: 16, width: 8, height: 8, borderRadius: 4 },

  // Tab content
  tabContent: { paddingTop: 16 },
  tabHeading: { fontSize: 16, fontWeight: '700', marginBottom: 16 },

  // Insurance type cards
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  typeCardIcon: { fontSize: 28 },
  typeCardLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Plan chips
  planHeading: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  planChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  planChipText: { fontSize: 13, fontWeight: '500' },

  // Search field
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 12,
  },
  searchFieldText: { flex: 1, fontSize: 15 },
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  selectedBannerText: { fontSize: 14, fontWeight: '600' },
  input: { padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, marginBottom: 16 },

  // Payment options
  paymentOptions: { gap: 10, marginBottom: 16 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 12 },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  paymentDesc: { fontSize: 12, lineHeight: 16 },
  checkmark: { fontSize: 18, fontWeight: 'bold' },

  // Info note
  infoNote: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoNoteText: { fontSize: 13, lineHeight: 18 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Search modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalClose: { fontSize: 18, padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  resultCount: { fontSize: 12, marginBottom: 8, paddingHorizontal: 2 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  planRowText: { fontSize: 15 },

  // Guest wall
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  primaryButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
