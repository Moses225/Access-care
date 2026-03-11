import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';

type ProviderData = {
  name: string;
  specialty: string;
  phone: string;
  address: string;
  city: string;
  bio: string;
  education: string;
  languages: string;
  acceptingPatients: boolean;
  mondayHours: string;
  tuesdayHours: string;
  wednesdayHours: string;
  thursdayHours: string;
  fridayHours: string;
  telehealth: boolean;
  inPerson: boolean;
};

const EMPTY_PROVIDER: ProviderData = {
  name: '', specialty: '', phone: '', address: '', city: '',
  bio: '', education: '', languages: '',
  acceptingPatients: true,
  mondayHours: '9:00 AM - 5:00 PM',
  tuesdayHours: '9:00 AM - 5:00 PM',
  wednesdayHours: '9:00 AM - 5:00 PM',
  thursdayHours: '9:00 AM - 5:00 PM',
  fridayHours: '9:00 AM - 5:00 PM',
  telehealth: false, inPerson: true,
};

export default function ProviderProfileScreen() {
  const router = useRouter();
  const { providerProfile, isProvider, initializing, refreshProfile } = useProviderAuth();
  const [data, setData] = useState<ProviderData>(EMPTY_PROVIDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'hours' | 'about'>('info');

  useEffect(() => {
    if (!initializing && !isProvider) {
      router.replace('/provider-portal/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, initializing]);

  useEffect(() => {
    if (providerProfile?.providerId) loadProvider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerProfile?.providerId]);

  const loadProvider = async () => {
    try {
      const snap = await getDoc(doc(db, 'providers', providerProfile!.providerId));
      if (snap.exists()) {
        const d = snap.data();
        setData({
          name: d.name || '',
          specialty: d.specialty || '',
          phone: d.phone || '',
          address: d.address || '',
          city: d.city || '',
          bio: d.bio || '',
          education: d.education || '',
          languages: d.languages || '',
          acceptingPatients: d.acceptingPatients ?? true,
          mondayHours: d.mondayHours || '9:00 AM - 5:00 PM',
          tuesdayHours: d.tuesdayHours || '9:00 AM - 5:00 PM',
          wednesdayHours: d.wednesdayHours || '9:00 AM - 5:00 PM',
          thursdayHours: d.thursdayHours || '9:00 AM - 5:00 PM',
          fridayHours: d.fridayHours || '9:00 AM - 5:00 PM',
          telehealth: d.telehealth ?? false,
          inPerson: d.inPerson ?? true,
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading provider:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data.name.trim()) {
      Alert.alert('Required', 'Provider name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'providers', providerProfile!.providerId), {
        ...data,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: 'provider',
      });
      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated. Changes are live immediately.');
    } catch (error) {
      if (__DEV__) console.error('Error saving provider:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof ProviderData, value: any) =>
    setData(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#14B8A6" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Text style={styles.headerSubtitle}>Changes go live immediately</Text>
      </View>

      {/* Section tabs */}
      <View style={styles.sectionTabs}>
        {(['info', 'hours', 'about'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sectionTab, activeSection === s && styles.sectionTabActive]}
            onPress={() => setActiveSection(s)}
            accessibilityRole="button"
          >
            <Text style={[styles.sectionTabText, activeSection === s && styles.sectionTabTextActive]}>
              {s === 'info' ? 'Practice Info' : s === 'hours' ? 'Hours' : 'About You'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {activeSection === 'info' && (
          <>
            <Field label="FULL NAME" value={data.name} onChange={v => update('name', v)} placeholder="Dr. Jane Smith" />
            <Field label="SPECIALTY" value={data.specialty} onChange={v => update('specialty', v)} placeholder="Family Medicine" />
            <Field label="PHONE NUMBER" value={data.phone} onChange={v => update('phone', v)} placeholder="(405) 555-0100" keyboardType="phone-pad" />
            <Field label="STREET ADDRESS" value={data.address} onChange={v => update('address', v)} placeholder="123 Main St, Suite 200" />
            <Field label="CITY" value={data.city} onChange={v => update('city', v)} placeholder="Oklahoma City" />

            <Text style={styles.fieldLabel}>LANGUAGES SPOKEN</Text>
            <TextInput
              style={styles.input}
              value={data.languages}
              onChangeText={v => update('languages', v)}
              placeholder="English, Spanish..."
              placeholderTextColor="#475569"
            />

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>In-Person Visits</Text>
                <Text style={styles.toggleSub}>Patients can book in-person</Text>
              </View>
              <Switch
                value={data.inPerson}
                onValueChange={v => update('inPerson', v)}
                trackColor={{ false: '#334155', true: '#14B8A6' }}
                thumbColor="#F8FAFC"
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Telehealth Available</Text>
                <Text style={styles.toggleSub}>Virtual appointments offered</Text>
              </View>
              <Switch
                value={data.telehealth}
                onValueChange={v => update('telehealth', v)}
                trackColor={{ false: '#334155', true: '#14B8A6' }}
                thumbColor="#F8FAFC"
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Accepting New Patients</Text>
                <Text style={styles.toggleSub}>Show in patient searches</Text>
              </View>
              <Switch
                value={data.acceptingPatients}
                onValueChange={v => update('acceptingPatients', v)}
                trackColor={{ false: '#334155', true: '#14B8A6' }}
                thumbColor="#F8FAFC"
              />
            </View>
          </>
        )}

        {activeSection === 'hours' && (
          <>
            <Text style={styles.hoursNote}>
              Enter hours as &quot;9:00 AM - 5:00 PM&quot; or &quot;Closed&quot;
            </Text>
            {[
              { key: 'mondayHours', label: 'MONDAY' },
              { key: 'tuesdayHours', label: 'TUESDAY' },
              { key: 'wednesdayHours', label: 'WEDNESDAY' },
              { key: 'thursdayHours', label: 'THURSDAY' },
              { key: 'fridayHours', label: 'FRIDAY' },
            ].map(({ key, label }) => (
              <Field
                key={key}
                label={label}
                value={data[key as keyof ProviderData] as string}
                onChange={v => update(key as keyof ProviderData, v)}
                placeholder="9:00 AM - 5:00 PM"
              />
            ))}
            <View style={[styles.infoBox, { marginTop: 8 }]}>
              <Text style={styles.infoBoxText}>
                Weekend hours and public holidays — contact your AccessCare representative to configure these.
              </Text>
            </View>
          </>
        )}

        {activeSection === 'about' && (
          <>
            <Text style={styles.fieldLabel}>BIOGRAPHY</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.bio}
              onChangeText={v => update('bio', v)}
              placeholder="Tell patients about yourself — your approach to care, what makes your practice unique, and what patients can expect..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              accessibilityLabel="Provider biography"
            />

            <Text style={styles.fieldLabel}>EDUCATION & TRAINING</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.education}
              onChangeText={v => update('education', v)}
              placeholder="MD, University of Oklahoma College of Medicine, 2005&#10;Residency: Family Medicine, OU Medical Center..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              accessibilityLabel="Education and training"
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                💡 Profiles with a biography receive significantly more bookings. Patients want to know who they are seeing before they book.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
        >
          {saving ? (
            <ActivityIndicator color="#0F172A" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 64, paddingBottom: 16, paddingHorizontal: 20, gap: 4 },
  backText: { color: '#14B8A6', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  headerTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700' },
  headerSubtitle: { color: '#475569', fontSize: 13 },
  sectionTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
    paddingHorizontal: 20,
  },
  sectionTab: { paddingVertical: 14, paddingHorizontal: 12, marginRight: 4 },
  sectionTabActive: { borderBottomWidth: 2, borderBottomColor: '#14B8A6' },
  sectionTabText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  sectionTabTextActive: { color: '#14B8A6' },
  scrollContent: { padding: 20 },
  fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 16, color: '#F8FAFC', fontSize: 15,
  },
  textArea: { minHeight: 120, lineHeight: 22 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155',
    padding: 16, marginBottom: 12,
  },
  toggleLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  toggleSub: { color: '#64748B', fontSize: 12 },
  hoursNote: { color: '#64748B', fontSize: 13, marginBottom: 20, lineHeight: 18 },
  infoBox: {
    backgroundColor: '#14B8A610', borderWidth: 1, borderColor: '#14B8A630',
    borderRadius: 10, padding: 16,
  },
  infoBoxText: { color: '#14B8A6', fontSize: 13, lineHeight: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#0F172A',
    borderTopWidth: 1, borderTopColor: '#1E293B',
  },
  saveButton: { backgroundColor: '#14B8A6', padding: 18, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
});
