import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';

// ── Time options ──────────────────────────────────────────────────────────────
const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00',
];

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'MONDAY', tuesday: 'TUESDAY', wednesday: 'WEDNESDAY',
  thursday: 'THURSDAY', friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY',
};

const DEFAULT_DAY: DayHours = { open: '09:00', close: '17:00', closed: false };
const DEFAULT_WEEKEND: DayHours = { open: '09:00', close: '13:00', closed: true };

function defaultWeekHours(): WeekHours {
  const h: WeekHours = {};
  DAYS.forEach(d => {
    h[d] = (d === 'saturday' || d === 'sunday') ? { ...DEFAULT_WEEKEND } : { ...DEFAULT_DAY };
  });
  return h;
}

// ── Time Picker Modal ─────────────────────────────────────────────────────────
function TimePickerModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <View style={tp.sheet}>
          <View style={tp.sheetHeader}>
            <Text style={tp.sheetTitle}>Select Time</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Text style={tp.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {TIME_OPTIONS.map(t => (
              <TouchableOpacity
                key={t}
                style={[tp.timeOption, current === t && tp.timeOptionSelected]}
                onPress={() => { onSelect(t); onClose(); }}
                accessibilityRole="button"
              >
                <Text style={[tp.timeOptionText, current === t && tp.timeOptionTextSelected]}>
                  {formatTime(t)}
                </Text>
                {current === t && <Text style={tp.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Day Hours Row ─────────────────────────────────────────────────────────────
function DayHoursRow({
  day, hours, onChange,
}: {
  day: string;
  hours: DayHours;
  onChange: (h: DayHours) => void;
}) {
  const [pickerTarget, setPickerTarget] = useState<'open' | 'close' | null>(null);

  return (
    <View style={dh.row}>
      <View style={dh.dayHeader}>
        <Text style={dh.dayLabel}>{DAY_LABELS[day]}</Text>
        <View style={dh.closedToggle}>
          <Text style={dh.closedLabel}>{hours.closed ? 'Closed' : 'Open'}</Text>
          <Switch
            value={!hours.closed}
            onValueChange={v => onChange({ ...hours, closed: !v })}
            trackColor={{ false: '#334155', true: '#14B8A6' }}
            thumbColor="#F8FAFC"
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>

      {!hours.closed && (
        <View style={dh.timeRow}>
          <TouchableOpacity
            style={dh.timeButton}
            onPress={() => setPickerTarget('open')}
            accessibilityRole="button"
          >
            <Text style={dh.timeLabel}>OPENS</Text>
            <Text style={dh.timeValue}>{formatTime(hours.open)}</Text>
          </TouchableOpacity>

          <Text style={dh.timeSeparator}>→</Text>

          <TouchableOpacity
            style={dh.timeButton}
            onPress={() => setPickerTarget('close')}
            accessibilityRole="button"
          >
            <Text style={dh.timeLabel}>CLOSES</Text>
            <Text style={dh.timeValue}>{formatTime(hours.close)}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TimePickerModal
        visible={pickerTarget === 'open'}
        current={hours.open}
        onSelect={t => onChange({ ...hours, open: t })}
        onClose={() => setPickerTarget(null)}
      />
      <TimePickerModal
        visible={pickerTarget === 'close'}
        current={hours.close}
        onSelect={t => onChange({ ...hours, close: t })}
        onClose={() => setPickerTarget(null)}
      />
    </View>
  );
}

// ── Provider data type ────────────────────────────────────────────────────────
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
  hours: WeekHours;
  telehealth: boolean;
  inPerson: boolean;
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProviderProfileScreen() {
  const router = useRouter();
  const { providerProfile, isProvider, initializing, refreshProfile } = useProviderAuth();
  const [data, setData] = useState<ProviderData>({
    name: '', specialty: '', phone: '', address: '', city: '',
    bio: '', education: '', languages: '',
    acceptingPatients: true,
    hours: defaultWeekHours(),
    telehealth: false, inPerson: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'hours' | 'about'>('info');

  useEffect(() => {
    if (!initializing && !isProvider) router.replace('/provider-portal/login');
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

        // Migrate legacy flat string hours to nested format
        const loadedHours: WeekHours = defaultWeekHours();
        if (d.hours && typeof d.hours === 'object') {
          DAYS.forEach(day => {
            if (d.hours[day]) loadedHours[day] = d.hours[day];
          });
        } else {
          // Legacy migration: parse "9:00 AM - 5:00 PM" strings
          const legacyMap: Record<string, string> = {
            monday: d.mondayHours, tuesday: d.tuesdayHours,
            wednesday: d.wednesdayHours, thursday: d.thursdayHours,
            friday: d.fridayHours,
          };
          Object.entries(legacyMap).forEach(([day, val]) => {
            if (!val) return;
            if (val.toLowerCase() === 'closed') {
              loadedHours[day] = { open: '09:00', close: '17:00', closed: true };
            }
            // Otherwise keep default — legacy format isn't worth parsing
          });
        }

        setData({
          name: d.name || '',
          specialty: d.specialty || '',
          phone: d.phone || '',
          address: d.address || '',
          city: d.city || '',
          bio: d.bio || '',
          education: d.education || '',
          languages: d.languages || '',
          acceptingPatients: d.acceptingPatients ?? d.acceptingNewPatients ?? true,
          hours: loadedHours,
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
        name: data.name,
        specialty: data.specialty,
        phone: data.phone,
        address: data.address,
        city: data.city,
        bio: data.bio,
        education: data.education,
        languages: data.languages,
        acceptingPatients: data.acceptingPatients,
        acceptingNewPatients: data.acceptingPatients, // keep both fields in sync
        hours: data.hours,                            // nested format booking screen reads
        telehealth: data.telehealth,
        inPerson: data.inPerson,
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

  const updateDayHours = (day: string, hours: DayHours) =>
    setData(prev => ({ ...prev, hours: { ...prev.hours, [day]: hours } }));

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Text style={styles.headerSubtitle}>Changes go live immediately</Text>
      </View>

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
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Tap the open/close times to change them. Toggle the switch to mark a day as closed.
              </Text>
            </View>
            {DAYS.map(day => (
              <DayHoursRow
                key={day}
                day={day}
                hours={data.hours[day]}
                onChange={h => updateDayHours(day, h)}
              />
            ))}
          </>
        )}

        {activeSection === 'about' && (
          <>
            <Text style={styles.fieldLabel}>BIOGRAPHY</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.bio}
              onChangeText={v => update('bio', v)}
              placeholder="Tell patients about yourself..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>EDUCATION & TRAINING</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={data.education}
              onChangeText={v => update('education', v)}
              placeholder="MD, University of Oklahoma, 2005..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                💡 Profiles with a biography receive significantly more bookings.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator color="#0F172A" size="small" />
            : <Text style={styles.saveButtonText}>Save Changes →</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
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

// ── Day hours sub-styles ──────────────────────────────────────────────────────
const dh = StyleSheet.create({
  row: {
    backgroundColor: '#1E293B', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155',
    padding: 16, marginBottom: 12,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  closedToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closedLabel: { color: '#94A3B8', fontSize: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeButton: {
    flex: 1, backgroundColor: '#0F172A', borderRadius: 8,
    borderWidth: 1, borderColor: '#334155', padding: 12, alignItems: 'center',
  },
  timeLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  timeValue: { color: '#14B8A6', fontSize: 15, fontWeight: '600' },
  timeSeparator: { color: '#334155', fontSize: 16 },
});

// ── Time picker sub-styles ────────────────────────────────────────────────────
const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '60%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  sheetClose: { color: '#475569', fontSize: 20, padding: 4 },
  timeOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#0F172A',
  },
  timeOptionSelected: { backgroundColor: '#14B8A610' },
  timeOptionText: { color: '#94A3B8', fontSize: 16 },
  timeOptionTextSelected: { color: '#14B8A6', fontWeight: '700' },
  checkmark: { color: '#14B8A6', fontSize: 16, fontWeight: '700' },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 64, paddingBottom: 16, paddingHorizontal: 20, gap: 4 },
  backText: { color: '#14B8A6', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  headerTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700' },
  headerSubtitle: { color: '#475569', fontSize: 13 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingHorizontal: 20 },
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
    backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    padding: 16, marginBottom: 12,
  },
  toggleLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  toggleSub: { color: '#64748B', fontSize: 12 },
  infoBox: {
    backgroundColor: '#14B8A610', borderWidth: 1, borderColor: '#14B8A630',
    borderRadius: 10, padding: 16, marginBottom: 16,
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
