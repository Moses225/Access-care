import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { db } from '../../firebase';

const INSURANCE_TYPES = [
  { id: 'medical', label: 'Medical', icon: '🏥' },
  { id: 'dental', label: 'Dental', icon: '🦷' },
  { id: 'vision', label: 'Vision', icon: '👁️' },
];

const PLANS_BY_TYPE: Record<string, string[]> = {
  medical: [
    'SoonerCare (Medicaid)',
    'BlueCross BlueShield',
    'Aetna',
    'United Healthcare',
    'Humana',
    'Cigna',
    'CommunityCare',
    'Other',
  ],
  dental: [
    'SoonerCare Dental',
    'Delta Dental',
    'Cigna Dental',
    'Aetna Dental',
    'MetLife Dental',
    'Other',
  ],
  vision: [
    'SoonerCare Vision',
    'VSP Vision',
    'EyeMed',
    'Davis Vision',
    'Superior Vision',
    'Other',
  ],
};

type InsuranceData = {
  medical?: string;
  dental?: string;
  vision?: string;
};

export default function InsuranceHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isGuest } = useAuth();

  const [activeType, setActiveType] = useState<'medical' | 'dental' | 'vision'>('medical');
  const [selections, setSelections] = useState<InsuranceData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (!isGuest && user) loadInsurance();
    else setLoading(false);
  }, [isGuest, user]);

  const loadInsurance = async () => {
    try {
      const snap = await getDoc(doc(db, 'insurance', user!.uid));
      if (snap.exists()) {
        const data = snap.data();
        setSelections({
          medical: data.medical || '',
          dental: data.dental || '',
          vision: data.vision || '',
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading insurance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (plan: string) => {
    setSelections(prev => ({ ...prev, [activeType]: plan }));
  };

  const handleSave = async () => {
    if (isGuest) { setShowUpgradePrompt(true); return; }
    try {
      setSaving(true);
      await setDoc(doc(db, 'insurance', user!.uid), {
        ...selections,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Saved', 'Your insurance information has been updated.');
    } catch (error) {
      if (__DEV__) console.error('Error saving insurance:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentPlans = PLANS_BY_TYPE[activeType];
  const currentSelection = selections[activeType] || '';
  const savedCount = Object.values(selections).filter(Boolean).length;

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Insurance Hub</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Manage your coverage
          </Text>
        </View>

        {/* Type tabs still visible for preview */}
        <View style={[styles.typeTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {INSURANCE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeTab,
                activeType === type.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveType(type.id as any)}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text style={[
                styles.typeLabel,
                { color: activeType === type.id ? colors.primary : colors.subtext },
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required</Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to save your medical, dental, and vision insurance details.
          </Text>
          <TouchableOpacity
            style={[styles.createAccountButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePrompt(true)}
            accessibilityRole="button"
          >
            <Text style={styles.createAccountButtonText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>

        <GuestUpgradePrompt
          visible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          reason="save your insurance information"
        />
      </View>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Insurance Hub</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {savedCount > 0
            ? `${savedCount} of 3 plan${savedCount !== 1 ? 's' : ''} saved`
            : 'Add your coverage details'}
        </Text>
      </View>

      {/* Coverage summary chips */}
      {savedCount > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: colors.card }]}>
          {INSURANCE_TYPES.map((type) => {
            const val = selections[type.id as keyof InsuranceData];
            if (!val) return null;
            return (
              <View key={type.id} style={[styles.summaryChip, { backgroundColor: colors.primary + '20' }]}>
                <Text style={styles.summaryChipIcon}>{type.icon}</Text>
                <Text style={[styles.summaryChipText, { color: colors.primary }]} numberOfLines={1}>
                  {val}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Type selector tabs */}
      <View style={[styles.typeTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {INSURANCE_TYPES.map((type) => {
          const isActive = activeType === type.id;
          const hasValue = !!selections[type.id as keyof InsuranceData];
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeTab,
                isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveType(type.id as any)}
              accessibilityRole="button"
              accessibilityLabel={`${type.label} insurance`}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text style={[styles.typeLabel, { color: isActive ? colors.primary : colors.subtext }]}>
                {type.label}
              </Text>
              {hasValue && <View style={[styles.savedDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.plansContainer}>
        <Text style={[styles.plansHeading, { color: colors.text }]}>
          Select your {INSURANCE_TYPES.find(t => t.id === activeType)?.label} plan
        </Text>

        {currentPlans.map((plan) => {
          const isSelected = currentSelection === plan;
          return (
            <TouchableOpacity
              key={plan}
              style={[
                styles.planRow,
                {
                  backgroundColor: colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => handleSelect(plan)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${plan}`}
            >
              <Text style={[styles.planRowText, { color: colors.text }]}>{plan}</Text>
              {isSelected && (
                <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save insurance information"
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Insurance Info'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  summaryBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, maxWidth: 200,
  },
  summaryChipIcon: { fontSize: 14 },
  summaryChipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  typeTabs: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  typeTab: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, position: 'relative',
  },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 13, fontWeight: '600' },
  savedDot: {
    position: 'absolute', top: 8, right: 16,
    width: 8, height: 8, borderRadius: 4,
  },
  plansContainer: { padding: 20 },
  plansHeading: { fontSize: 17, fontWeight: '600', marginBottom: 16 },
  planRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 12, marginBottom: 10,
  },
  planRowText: { fontSize: 16 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, borderTopWidth: 1,
  },
  saveButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  // Guest wall
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: {
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12,
    width: '100%', alignItems: 'center',
  },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
