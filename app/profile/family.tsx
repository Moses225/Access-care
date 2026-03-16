import { Stack, useRouter } from 'expo-router';
import {
  addDoc, collection, deleteDoc,
  doc, getDocs, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dependent {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  relationship: string;
  phone?: string;
  biologicalSex?: string;
  genderIdentity?: string;
}

const RELATIONSHIPS = [
  'Child', 'Spouse / Partner', 'Parent',
  'Grandparent', 'Sibling', 'Other',
];

const BIOLOGICAL_SEX_OPTIONS = ['Male', 'Female', 'Intersex', 'Prefer not to say'];

const GENDER_IDENTITY_OPTIONS = [
  'Man', 'Woman', 'Non-binary',
  'Transgender Man', 'Transgender Woman',
  'Prefer not to say', 'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDOBDisplay(dob: string): string {
  if (!dob) return '';
  const [year, month, day] = dob.split('-');
  return `${month}/${day}/${year}`;
}

function cleanForFirestore(data: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

// ─── DOB Calendar Picker ──────────────────────────────────────────────────────
const DOBCalendarField = ({
  value, onChange, colors,
}: {
  value: string;
  onChange: (ymd: string) => void;
  colors: any;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [currentYear, setCurrentYear] = useState(
    value ? parseInt(value.split('-')[0]) : 2000
  );
  const [currentMonth, setCurrentMonth] = useState(
    value ? parseInt(value.split('-')[1]) : 1
  );

  const today = new Date();
  const maxYear = today.getFullYear();
  const minYear = maxYear - 120;
  const calendarCurrent = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const maxDateStr = today.toISOString().split('T')[0];
  const minDateObj = new Date(); minDateObj.setFullYear(minYear);
  const minDateStr = minDateObj.toISOString().split('T')[0];
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        style={[styles.dobField, {
          backgroundColor: colors.background,
          borderColor: expanded ? colors.primary : colors.border,
          borderWidth: expanded ? 2 : 1.5,
        }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.dobFieldLeft}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>📅</Text>
          <Text style={[styles.dobFieldText, { color: value ? colors.text : colors.subtext }]}>
            {value ? `${formatDOBDisplay(value)}  ·  Age ${calculateAge(value)}` : 'Select Date of Birth *'}
          </Text>
        </View>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {expanded ? '▲ Hide' : '▼ Choose'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.calendarContainer, { borderColor: colors.primary }]}>
          <View style={[styles.yearSelectorContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.yearSelectorLabel, { color: colors.subtext }]}>Jump to year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
              {years.map((year) => {
                const isSelected = year === currentYear;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearChip, {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                    onPress={() => { setCurrentYear(year); setCurrentMonth(1); }}
                  >
                    <Text style={[styles.yearChipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <Calendar
            key={calendarCurrent}
            current={calendarCurrent}
            maxDate={maxDateStr}
            minDate={minDateStr}
            onDayPress={(day: any) => { onChange(day.dateString); setExpanded(false); }}
            onMonthChange={(month: any) => { setCurrentYear(month.year); setCurrentMonth(month.month); }}
            markedDates={value ? { [value]: { selected: true, selectedColor: colors.primary } } : {}}
            theme={{
              backgroundColor: colors.card, calendarBackground: colors.card,
              textSectionTitleColor: colors.text, selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#ffffff', todayTextColor: colors.primary,
              dayTextColor: colors.text, textDisabledColor: colors.subtext,
              monthTextColor: colors.text, arrowColor: colors.primary,
              textDayFontSize: 14, textMonthFontSize: 15, textDayHeaderFontSize: 12,
            }}
          />
          <TouchableOpacity
            style={[styles.calendarCancelBtn, { borderColor: colors.border }]}
            onPress={() => setExpanded(false)}
          >
            <Text style={[styles.calendarCancelText, { color: colors.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
const DependentModal = ({
  visible, onClose, onSave, initial, colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Dependent, 'id'>) => Promise<void>;
  initial?: Dependent | null;
  colors: any;
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [biologicalSex, setBiologicalSex] = useState('');
  const [genderIdentity, setGenderIdentity] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setFirstName(initial?.firstName ?? '');
      setLastName(initial?.lastName ?? '');
      setDob(initial?.dateOfBirth ?? '');
      setRelationship(initial?.relationship ?? '');
      setPhone(initial?.phone ?? '');
      setBiologicalSex(initial?.biologicalSex ?? '');
      setGenderIdentity(initial?.genderIdentity ?? '');
    }
  }, [visible, initial]);

  const handleSave = async () => {
    if (!firstName.trim()) { Alert.alert('Required', 'Please enter a first name.'); return; }
    if (!lastName.trim()) { Alert.alert('Required', 'Please enter a last name.'); return; }
    if (!dob) { Alert.alert('Required', 'Please select a date of birth.'); return; }
    if (!relationship) { Alert.alert('Required', 'Please select a relationship.'); return; }

    setSaving(true);
    try {
      const data: Omit<Dependent, 'id'> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dob,
        relationship,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(biologicalSex ? { biologicalSex } : {}),
        ...(genderIdentity ? { genderIdentity } : {}),
      };
      await onSave(data);
      onClose();
    } catch (error: any) {
      if (__DEV__) console.error('Save dependent error:', error);
      if (error?.code === 'permission-denied') {
        Alert.alert('Permission Error', 'Could not save. Please make sure you are signed in and try again.');
      } else {
        Alert.alert('Error', 'Could not save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
        pointerEvents="box-none"
      >
        <TouchableWithoutFeedback>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {initial ? 'Edit Family Member' : 'Add Family Member'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.subtext }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Name */}
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.nameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="First Name *" placeholderTextColor={colors.subtext}
                  value={firstName} onChangeText={setFirstName}
                  autoCapitalize="words" autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, styles.nameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Last Name *" placeholderTextColor={colors.subtext}
                  value={lastName} onChangeText={setLastName}
                  autoCapitalize="words" autoCorrect={false}
                />
              </View>

              {/* DOB */}
              <DOBCalendarField value={dob} onChange={setDob} colors={colors} />

              {/* Phone */}
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Phone Number (Optional)" placeholderTextColor={colors.subtext}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad"
              />

              {/* Relationship */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Relationship *</Text>
              <View style={styles.chipGrid}>
                {RELATIONSHIPS.map((rel) => {
                  const isSelected = relationship === rel;
                  return (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.chip, {
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }]}
                      onPress={() => setRelationship(rel)}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>{rel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Biological sex */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Biological Sex
                <Text style={[styles.optionalLabel, { color: colors.subtext }]}> (optional)</Text>
              </Text>
              <View style={styles.chipGrid}>
                {BIOLOGICAL_SEX_OPTIONS.map((opt) => {
                  const isSelected = biologicalSex === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, {
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }]}
                      onPress={() => setBiologicalSex(isSelected ? '' : opt)}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Gender identity */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Gender Identity
                <Text style={[styles.optionalLabel, { color: colors.subtext }]}> (optional)</Text>
              </Text>
              <View style={styles.chipGrid}>
                {GENDER_IDENTITY_OPTIONS.map((opt) => {
                  const isSelected = genderIdentity === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, {
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }]}
                      onPress={() => setGenderIdentity(isSelected ? '' : opt)}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} disabled={saving}>
                  <Text style={[styles.cancelBtnText, { color: colors.subtext }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSave} disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Dependent Card ────────────────────────────────────────────────────────────
const DependentCard = ({
  dependent, onEdit, onDelete, colors,
}: {
  dependent: Dependent; onEdit: () => void; onDelete: () => void; colors: any;
}) => {
  const age = calculateAge(dependent.dateOfBirth);
  const isMinor = age < 18;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        <View style={[styles.cardAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.cardAvatarText}>
            {dependent.firstName.charAt(0)}{dependent.lastName.charAt(0)}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.text }]}>
            {dependent.firstName} {dependent.lastName}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.subtext }]}>
            {dependent.relationship} · {age} years old
          </Text>
          <Text style={[styles.cardMeta, { color: colors.subtext }]}>
            DOB: {formatDOBDisplay(dependent.dateOfBirth)}
          </Text>
          {dependent.phone && (
            <Text style={[styles.cardMeta, { color: colors.subtext }]}>📞 {dependent.phone}</Text>
          )}
          {dependent.biologicalSex && (
            <Text style={[styles.cardMeta, { color: colors.subtext }]}>⚕️ {dependent.biologicalSex}</Text>
          )}
          {isMinor && (
            <View style={[styles.minorBadge, { backgroundColor: '#3B82F6' + '20' }]}>
              <Text style={[styles.minorBadgeText, { color: '#3B82F6' }]}>Minor</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.cardActionBtn, { backgroundColor: colors.primary + '15' }]} onPress={onEdit}>
          <Text style={[styles.cardActionText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cardActionBtn, { backgroundColor: colors.error + '15' }]} onPress={onDelete}>
          <Text style={[styles.cardActionText, { color: colors.error }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function FamilyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);

  const loadDependents = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'dependents'));
      const list: Dependent[] = [];
      snapshot.forEach((d) => { list.push({ id: d.id, ...d.data() } as Dependent); });
      list.sort((a, b) => new Date(b.dateOfBirth).getTime() - new Date(a.dateOfBirth).getTime());
      setDependents(list);
    } catch (error: any) {
      if (__DEV__) console.error('Error loading dependents:', error);
      if (error?.code !== 'permission-denied') Alert.alert('Error', 'Could not load family members. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDependents(); }, [loadDependents]));

  const handleAdd = async (data: Omit<Dependent, 'id'>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const cleanData = cleanForFirestore({ ...data, createdAt: serverTimestamp() });
    await addDoc(collection(db, 'users', user.uid, 'dependents'), cleanData);
    await loadDependents();
  };

  const handleEdit = async (data: Omit<Dependent, 'id'>) => {
    if (!editingDependent) return;
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const cleanData = cleanForFirestore({ ...data, updatedAt: serverTimestamp() });
    await updateDoc(doc(db, 'users', user.uid, 'dependents', editingDependent.id), cleanData);
    await loadDependents();
  };

  const handleDelete = (dependent: Dependent) => {
    Alert.alert(
      'Remove Family Member',
      `Remove ${dependent.firstName} ${dependent.lastName} from your family account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;
              await deleteDoc(doc(db, 'users', user.uid, 'dependents', dependent.id));
              await loadDependents();
            } catch { Alert.alert('Error', 'Could not remove. Please try again.'); }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>My Family</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Add family members to book appointments on their behalf
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                👨‍👩‍👧 Family members appear as booking options when scheduling appointments. Minors are automatically flagged and guardian info is attached to their bookings.
              </Text>
            </View>

            {dependents.length > 0 ? (
              dependents.map((dep) => (
                <DependentCard
                  key={dep.id} dependent={dep}
                  onEdit={() => { setEditingDependent(dep); setModalVisible(true); }}
                  onDelete={() => handleDelete(dep)} colors={colors}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👨‍👩‍👧</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Family Members Yet</Text>
                <Text style={[styles.emptyText, { color: colors.subtext }]}>
                  Add children, elderly parents, or other family members to book appointments on their behalf.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => { setEditingDependent(null); setModalVisible(true); }}
              accessibilityRole="button"
            >
              <Text style={styles.addButtonText}>+ Add Family Member</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        <DependentModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={editingDependent ? handleEdit : handleAdd}
          initial={editingDependent}
          colors={colors}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  listContent: { padding: 16 },
  infoBanner: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16 },
  infoBannerText: { fontSize: 13, lineHeight: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardMeta: { fontSize: 13, marginBottom: 2 },
  minorBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  minorBadgeText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  cardActionText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  addButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Modal
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '95%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameInput: { flex: 1 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  optionalLabel: { fontSize: 12, fontWeight: '400' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // DOB calendar
  dobField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 4 },
  dobFieldLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dobFieldText: { fontSize: 15, flex: 1 },
  calendarContainer: { borderWidth: 2, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  yearSelectorContainer: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  yearSelectorLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  yearScroll: { gap: 8, paddingRight: 8 },
  yearChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  yearChipText: { fontSize: 13, fontWeight: '600' },
  calendarCancelBtn: { margin: 12, marginTop: 4, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  calendarCancelText: { fontSize: 14, fontWeight: '600' },
});
