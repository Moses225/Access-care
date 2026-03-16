import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { db } from '../../firebase';

// ─── Insurance carrier database ───────────────────────────────────────────────
const FEATURED_CARRIERS = [
  'SoonerCare (Medicaid)',
  'CommunityCare',
  'BlueCross BlueShield of Oklahoma',
  'Aetna Better Health of Oklahoma',
  'Humana Healthy Horizons Oklahoma',
  'Molina Healthcare of Oklahoma',
  'Ambetter from Superior HealthPlan',
];

const ALL_CARRIERS = [
  'Aetna', 'Aetna Better Health', 'Aetna Better Health of Oklahoma',
  'Allwell from Oklahoma Complete Health', 'Ambetter from Superior HealthPlan',
  'AmeriHealth Caritas', 'Anthem', 'Anthem Blue Cross', 'Anthem Blue Cross Blue Shield',
  'Arkansas Blue Cross Blue Shield', 'Avmed',
  'Banner Health', 'Beacon Health Options', 'Blue Care Network',
  'Blue Cross Blue Shield', 'Blue Cross Blue Shield of Alabama',
  'Blue Cross Blue Shield of Arizona', 'Blue Cross Blue Shield of Florida',
  'Blue Cross Blue Shield of Georgia', 'Blue Cross Blue Shield of Illinois',
  'Blue Cross Blue Shield of Kansas', 'Blue Cross Blue Shield of Michigan',
  'Blue Cross Blue Shield of Minnesota', 'Blue Cross Blue Shield of Missouri',
  'Blue Cross Blue Shield of Montana', 'Blue Cross Blue Shield of Nebraska',
  'Blue Cross Blue Shield of New Mexico', 'Blue Cross Blue Shield of North Carolina',
  'Blue Cross Blue Shield of North Dakota', 'Blue Cross Blue Shield of Oklahoma',
  'Blue Cross Blue Shield of Rhode Island', 'Blue Cross Blue Shield of South Carolina',
  'Blue Cross Blue Shield of Tennessee', 'Blue Cross Blue Shield of Texas',
  'Blue Cross Blue Shield of Wyoming', 'Blue Shield of California',
  'Bright Health', 'Buckeye Health Plan',
  'Caresource', 'Centene', 'Cigna', 'Cigna HealthSpring',
  'CommunityCare', 'Community Health Plan of Washington',
  'Coordinated Care', 'Coventry Health Care', 'CVS Health Aetna',
  'Dean Health Plan', 'Delta Dental',
  'Elevation Health', 'Emblem Health', 'Empire BlueCross BlueShield',
  'Envolve', 'EverNorth',
  'Fallon Health', 'Florida Blue', 'Friday Health Plans',
  'Geisinger Health Plan', 'GlobalHealth Oklahoma',
  'Harvard Pilgrim Health Care', 'Health Alliance',
  'Health First', 'Health Net', 'HealthMarkets',
  'HealthPartners', 'HealthPlus', 'Highmark',
  'Highmark Blue Cross Blue Shield', 'HMO Illinois',
  'Horizon Blue Cross Blue Shield', 'Humana',
  'Humana Gold Plus', 'Humana Healthy Horizons Oklahoma',
  'Independence Blue Cross', 'Indiana University Health Plans',
  'Kaiser Permanente', 'Keystone Health Plan',
  'Liberty Mutual Health', 'Lifewise Health Plan',
  'Magellan Health', 'MassHealth', 'MDwise',
  'Medica', 'Medical Mutual of Ohio', 'MedStar Health',
  'Meritain Health', 'MetroPlus Health', 'Moda Health',
  'Molina Healthcare', 'Molina Healthcare of Oklahoma',
  'Multiplan', 'MVP Health Care',
  'Neighborhood Health Plan', 'New Mexico True', 'NovaSys Health',
  'Oklahoma Complete Health', 'OmniCare', 'Oscar Health', 'Oxford Health Plans',
  'Paramount', 'Parkland Community Health Plan',
  'Physicians Health Plan', 'Premera Blue Cross',
  'Presbyterian Health Plan', 'Priority Health',
  'QualChoice Health Insurance',
  'Regence BlueShield', 'Rocky Mountain Health Plans',
  'Scott & White Health Plan', 'SelectHealth',
  'Sentara Health Plans', 'Sharp Health Plan',
  'Simply Healthcare', 'SoonerCare (Medicaid)',
  'Staywell', 'Sunshine Health', 'Superior HealthPlan',
  'Tufts Health Plan', 'TriWest Healthcare Alliance', 'Tricare',
  'UMR', 'Unicare', 'United American Insurance',
  'United Healthcare', 'United Healthcare Community Plan',
  'United Healthcare Medicare Solutions', 'UnitedHealthOne',
  'University of Utah Health Plans', 'UPMC Health Plan',
  'VA Community Care', 'Valley Health Plan', 'Vantage Health Plan',
  'WebTPA', 'WellCare', 'WellCare Health Plans',
  'WellCare of Oklahoma', 'WPS Health Solutions',
  'Zelis',
].sort();

const PAYMENT_OPTIONS = [
  { id: 'out_of_pocket', label: 'Out of Pocket',      icon: '💵', description: 'I will pay directly for my care' },
  { id: 'sliding_scale', label: 'Sliding Scale Fee',  icon: '📊', description: 'Fee based on my income level' },
  { id: 'health_sharing',label: 'Health Sharing Plan',icon: '🤝', description: 'Member-based cost sharing program' },
  { id: 'charity_care',  label: 'Charity Care',       icon: '🏥', description: 'Free or reduced cost through provider program' },
];

// ─── Insurance Search Modal ───────────────────────────────────────────────────
const InsuranceSearchModal = ({
  visible, onClose, onSelect, colors,
}: {
  visible: boolean; onClose: () => void; onSelect: (c: string) => void; colors: any;
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_CARRIERS;
    const q = search.toLowerCase();
    return ALL_CARRIERS.filter((c) => c.toLowerCase().includes(q));
  }, [search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Search Insurance Carrier</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.subtext }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Type carrier name..."
              placeholderTextColor={colors.subtext}
              value={search}
              onChangeText={setSearch}
              autoFocus autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: colors.subtext, fontSize: 16, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.resultCount, { color: colors.subtext }]}>
            {filtered.length} carrier{filtered.length !== 1 ? 's' : ''} found
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            style={{ maxHeight: 400 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.carrierRow, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[styles.carrierRowText, { color: colors.text }]}>{item}</Text>
                <Text style={{ color: colors.subtext }}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: colors.subtext }]}>
                  No carriers found for &quot;{search}&quot;
                </Text>
                <TouchableOpacity
                  style={[styles.notListedBtn, { borderColor: colors.primary }]}
                  onPress={() => { onSelect(`Other: ${search}`); onClose(); setSearch(''); }}
                >
                  <Text style={[styles.notListedBtnText, { color: colors.primary }]}>
                    Use &quot;{search}&quot; anyway
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function InsuranceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isGuest, isFullAccount } = useAuth();

  const [insuranceType, setInsuranceType]   = useState<'insured' | 'uninsured' | ''>('');
  const [selectedPlan, setSelectedPlan]     = useState('');
  const [policyNumber, setPolicyNumber]     = useState('');
  const [paymentOption, setPaymentOption]   = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [loading, setLoading]               = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // ── Load insurance info — called on mount and on focus ─────────────────────
  // useFocusEffect ensures the visual pre-selection is restored when navigating
  // back to this screen from another screen.
  const loadInsuranceInfo = useCallback(async () => {
    if (!isFullAccount || !user) return;
    try {
      const insuranceDoc = await getDoc(doc(db, 'insurance', user.uid));
      if (insuranceDoc.exists()) {
        const data = insuranceDoc.data();
        setInsuranceType(data.insuranceType || '');
        setSelectedPlan(data.provider || '');
        setPolicyNumber(data.policy || '');
        setPaymentOption(data.paymentOption || '');
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading insurance:', error);
    }
  }, [isFullAccount, user]);

  // Reload every time the screen comes into focus so pre-selection is always current
  useFocusEffect(
    useCallback(() => {
      loadInsuranceInfo();
    }, [loadInsuranceInfo])
  );

  const handleSave = async () => {
    if (!insuranceType) {
      Alert.alert('Required', 'Please select whether you have insurance or not.');
      return;
    }
    if (insuranceType === 'insured' && !selectedPlan) {
      Alert.alert('Required', 'Please select your insurance carrier.');
      return;
    }
    if (insuranceType === 'uninsured' && !paymentOption) {
      Alert.alert('Required', 'Please select how you plan to pay for care.');
      return;
    }

    try {
      setLoading(true);
      if (!user) return;
      await setDoc(doc(db, 'insurance', user.uid), {
        insuranceType,
        provider:       insuranceType === 'insured'   ? selectedPlan   : '',
        policy:         insuranceType === 'insured'   ? policyNumber   : '',
        paymentOption:  insuranceType === 'uninsured' ? paymentOption  : '',
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Saved', 'Insurance information updated.');
    } catch (error) {
      if (__DEV__) console.error('Error saving insurance:', error);
      Alert.alert('Error', 'Failed to save insurance information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Insurance</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            {isGuest
              ? 'Select your plan to see accurate provider matches'
              : 'Save your insurance details for faster booking'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {isGuest && (
            <View style={[styles.guestBanner, {
              backgroundColor: colors.primary + '15', borderColor: colors.primary,
            }]}>
              <Text style={[styles.guestBannerText, { color: colors.primary }]}>
                You are browsing as a guest. Select your plan to filter providers — create a free account to save your details.
              </Text>
            </View>
          )}

          {/* Step 1 — Do you have insurance? */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Do you have health insurance?
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
              <Text style={styles.typeIcon}>🏥</Text>
              <Text style={[styles.typeLabel, {
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
              onPress={() => {
                setInsuranceType('uninsured');
                setSelectedPlan(''); setPolicyNumber('');
              }}
            >
              <Text style={styles.typeIcon}>💵</Text>
              <Text style={[styles.typeLabel, {
                color: insuranceType === 'uninsured' ? colors.primary : colors.text,
              }]}>
                No insurance
              </Text>
            </TouchableOpacity>
          </View>

          {/* Insured flow */}
          {insuranceType === 'insured' && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Common Oklahoma Plans
              </Text>
              <View style={styles.plansGrid}>
                {FEATURED_CARRIERS.map((plan) => {
                  const isSelected = selectedPlan === plan;
                  return (
                    <TouchableOpacity
                      key={plan}
                      style={[styles.planChip, {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor:     isSelected ? colors.primary : colors.border,
                      }]}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <Text style={[styles.planChipText, {
                        color: isSelected ? '#fff' : colors.text,
                      }]}>
                        {plan}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Other Insurance Carrier
              </Text>
              <TouchableOpacity
                style={[styles.searchField, {
                  backgroundColor: colors.card,
                  borderColor: selectedPlan && !FEATURED_CARRIERS.includes(selectedPlan)
                    ? colors.primary : colors.border,
                  borderWidth: selectedPlan && !FEATURED_CARRIERS.includes(selectedPlan) ? 2 : 1,
                }]}
                onPress={() => setShowSearchModal(true)}
              >
                <Text style={{ fontSize: 18 }}>🔍</Text>
                <Text style={[styles.searchFieldText, {
                  color: selectedPlan && !FEATURED_CARRIERS.includes(selectedPlan)
                    ? colors.primary : colors.subtext,
                }]}>
                  {selectedPlan && !FEATURED_CARRIERS.includes(selectedPlan)
                    ? selectedPlan
                    : 'Search 200+ carriers...'}
                </Text>
                {selectedPlan && !FEATURED_CARRIERS.includes(selectedPlan) && (
                  <TouchableOpacity onPress={() => setSelectedPlan('')}>
                    <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {selectedPlan && (
                <View style={[styles.selectedBanner, {
                  backgroundColor: colors.success + '15', borderColor: colors.success,
                }]}>
                  <Text style={[styles.selectedBannerText, { color: colors.success }]}>
                    ✓ Selected: {selectedPlan}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedPlan('')}>
                    <Text style={{ color: colors.subtext, fontSize: 13 }}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Member / Policy Number
                <Text style={[styles.optionalLabel, { color: colors.subtext }]}> (optional)</Text>
              </Text>

              {isGuest ? (
                <TouchableOpacity
                  style={[styles.lockedField, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowUpgradePrompt(true)}
                >
                  <Text style={[styles.lockedText, { color: colors.subtext }]}>
                    🔒  Create an account to add your member ID
                  </Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={[styles.input, {
                    backgroundColor: colors.card, color: colors.text, borderColor: colors.border,
                  }]}
                  placeholder="Your member or policy number"
                  placeholderTextColor={colors.subtext}
                  value={policyNumber}
                  onChangeText={setPolicyNumber}
                />
              )}

              <View style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.infoNoteText, { color: colors.subtext }]}>
                  ℹ️ Some providers only accept patients within specific networks. Providers that do not accept your insurance will be marked on their profile.
                </Text>
              </View>
            </>
          )}

          {/* Uninsured flow */}
          {insuranceType === 'uninsured' && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
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
                  ℹ️ Many Oklahoma providers accept uninsured patients and offer payment plans. Pricing options will be shown on each provider profile.
                </Text>
              </View>
            </>
          )}

          {insuranceType !== '' && (
            <TouchableOpacity
              style={[styles.saveButton, {
                backgroundColor: colors.primary, opacity: loading ? 0.7 : 1,
              }]}
              onPress={isGuest ? () => setShowUpgradePrompt(true) : handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : isGuest ? 'Create Account to Save' : 'Save Information'}
              </Text>
            </TouchableOpacity>
          )}

        </ScrollView>

        <InsuranceSearchModal
          visible={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSelect={(carrier) => setSelectedPlan(carrier)}
          colors={colors}
        />

        <GuestUpgradePrompt
          visible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          reason="save your insurance information"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  content: { padding: 20, paddingBottom: 60 },
  guestBanner: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 24 },
  guestBannerText: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  optionalLabel: { fontSize: 13, fontWeight: '400' },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  typeIcon: { fontSize: 28 },
  typeLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  plansGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  planChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  planChipText: { fontSize: 13, fontWeight: '500' },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 12,
  },
  searchFieldText: { flex: 1, fontSize: 15 },
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20,
  },
  selectedBannerText: { fontSize: 14, fontWeight: '600' },
  input: { padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, marginBottom: 16 },
  lockedField: { padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginBottom: 16 },
  lockedText: { fontSize: 15 },
  infoNote: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20 },
  infoNoteText: { fontSize: 13, lineHeight: 18 },
  paymentOptions: { gap: 10, marginBottom: 20 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 12 },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  paymentDesc: { fontSize: 12, lineHeight: 16 },
  checkmark: { fontSize: 18, fontWeight: 'bold' },
  saveButton: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalClose: { fontSize: 18, padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  resultCount: { fontSize: 12, marginBottom: 8, paddingHorizontal: 2 },
  carrierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  carrierRowText: { fontSize: 15 },
  noResults: { alignItems: 'center', paddingVertical: 32 },
  noResultsText: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  notListedBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  notListedBtnText: { fontSize: 14, fontWeight: '600' },
});
