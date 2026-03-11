import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { db } from '../../firebase';

const INSURANCE_PLANS = [
  'SoonerCare (Medicaid)',
  'BlueCross BlueShield',
  'Aetna',
  'United Healthcare',
  'Humana',
  'Cigna',
  'CommunityCare',
  'Other',
];

export default function InsuranceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isGuest, isFullAccount } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (isFullAccount) loadInsuranceInfo();
  }, [isFullAccount]);

  const loadInsuranceInfo = async () => {
    try {
      if (!user) return;
      const insuranceDoc = await getDoc(doc(db, 'insurance', user.uid));
      if (insuranceDoc.exists()) {
        const data = insuranceDoc.data();
        setSelectedPlan(data.provider || '');
        setPolicyNumber(data.policy || '');
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading insurance:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedPlan.trim()) {
      Alert.alert('Required', 'Please select an insurance plan.');
      return;
    }

    try {
      setLoading(true);
      if (!user) return;

      await setDoc(doc(db, 'insurance', user.uid), {
        provider: selectedPlan,
        policy: policyNumber,
        updatedAt: new Date(),
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
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Insurance</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            {isGuest
              ? 'Select your plan to see accurate provider matches'
              : 'Save your insurance details for faster booking'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>

          {/* Guest banner */}
          {isGuest && (
            <View style={[styles.guestBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
              <Text style={[styles.guestBannerText, { color: colors.primary }]}>
                You are browsing as a guest. Select your plan to filter providers — create a free account to save your details.
              </Text>
            </View>
          )}

          {/* Plan selector */}
          <Text style={[styles.label, { color: colors.text }]}>Insurance Plan</Text>
          <View style={styles.plansGrid}>
            {INSURANCE_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan;
              return (
                <TouchableOpacity
                  key={plan}
                  style={[
                    styles.planChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedPlan(plan)}
                  accessibilityLabel={`Select ${plan}`}
                  accessibilityRole="button"
                >
                  <Text style={[
                    styles.planChipText,
                    { color: isSelected ? '#fff' : colors.text },
                  ]}>
                    {plan}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Policy number — full accounts only */}
          <View style={styles.policySection}>
            <Text style={[styles.label, { color: colors.text }]}>
              Member / Policy Number
              {isGuest && (
                <Text style={[styles.optionalLabel, { color: colors.subtext }]}>
                  {' '}(account required)
                </Text>
              )}
            </Text>

            {isGuest ? (
              <TouchableOpacity
                style={[styles.lockedField, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowUpgradePrompt(true)}
                accessibilityLabel="Create account to add policy number"
                accessibilityRole="button"
              >
                <Text style={[styles.lockedText, { color: colors.subtext }]}>
                  🔒  Create an account to add your member ID
                </Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Your member or policy number (optional)"
                placeholderTextColor={colors.subtext}
                value={policyNumber}
                onChangeText={setPolicyNumber}
                accessibilityLabel="Policy number"
              />
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={isGuest ? () => setShowUpgradePrompt(true) : handleSave}
            disabled={loading}
            accessibilityLabel={isGuest ? 'Create account to save' : 'Save insurance information'}
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : isGuest ? 'Create Account to Save' : 'Save Information'}
            </Text>
          </TouchableOpacity>

        </ScrollView>

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
  guestBanner: {
    borderWidth: 1, borderRadius: 10,
    padding: 14, marginBottom: 24,
  },
  guestBannerText: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  optionalLabel: { fontSize: 14, fontWeight: '400' },
  plansGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  planChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5,
  },
  planChipText: { fontSize: 14, fontWeight: '500' },
  policySection: { marginBottom: 24 },
  input: {
    padding: 16, borderRadius: 12,
    fontSize: 16, borderWidth: 1,
  },
  lockedField: {
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed',
  },
  lockedText: { fontSize: 15 },
  saveButton: {
    padding: 18, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
