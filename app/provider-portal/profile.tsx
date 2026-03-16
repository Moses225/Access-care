import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../firebase';
import { useProviderAuth } from '../../context/ProviderAuthContext';

// ─── Light theme ──────────────────────────────────────────────────────────────
const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  inputBg: '#F8FAFC', textPrimary: '#0F172A', textSub: '#64748B',
  textMuted: '#94A3B8', accent: '#14B8A6', accentBg: '#14B8A610',
  accentBorder: '#14B8A640', overlay: '#00000066',
};

// ─── Full specialty list ──────────────────────────────────────────────────────
const SPECIALTIES = [
  'Addiction Medicine','Allergy & Immunology','Anesthesiology',
  'Behavioral Health','Cardiology','Chiropractic','Colorectal Surgery',
  'Dental / General Dentistry','Dermatology','Emergency Medicine',
  'Endocrinology','ENT / Otolaryngology','Family Medicine',
  'Gastroenterology','General Surgery','Geriatrics',
  'Hematology','Home Health','Infectious Disease','Internal Medicine',
  'Nephrology','Neurology','Neurosurgery','Nutrition / Dietetics',
  'OB/GYN','Occupational Therapy','Oncology','Ophthalmology',
  'Optometry','Oral Surgery','Orthodontics','Orthopedic Surgery',
  'Orthopedics','Pain Management','Palliative Care','Pediatrics',
  'Physical Medicine & Rehabilitation','Physical Therapy',
  'Plastic Surgery','Podiatry','Primary Care','Psychiatry',
  'Psychology / Therapy','Pulmonology','Radiology','Rheumatology',
  'Sleep Medicine','Speech Therapy','Sports Medicine','Urgent Care',
  'Urology','Vascular Surgery','Wound Care',
].sort();

const COMMUNICATION_STYLE_OPTIONS = [
  { id: 'Direct & Clinical',         desc: 'Straightforward, efficient visits' },
  { id: 'Warm & Conversational',     desc: 'Friendly, takes time to listen' },
  { id: 'Great with Kids',           desc: 'Experienced with pediatric patients' },
  { id: 'Patient with First-timers', desc: 'Comfortable with anxious patients' },
  { id: 'Evidence-based',            desc: 'Relies on current medical research' },
  { id: 'Holistic Approach',         desc: 'Considers whole-person wellness' },
  { id: 'Preventive Focus',          desc: 'Emphasizes prevention over treatment' },
  { id: 'Listens Carefully',         desc: 'Thorough, unhurried appointments' },
  { id: 'Bilingual (Spanish)',        desc: 'Se habla español' },
  { id: 'Bilingual (Other)',          desc: 'Speaks another language' },
];

const WHO_I_SEE_OPTIONS = [
  { id: 'Adults only',        desc: '18 and older' },
  { id: 'Pediatric patients', desc: 'Children and teens' },
  { id: 'All ages',           desc: 'Infants through elderly' },
  { id: 'Geriatric focus',    desc: 'Specializes in older adults' },
  { id: "Women's health",     desc: "Focus on women's health needs" },
];

const VISIT_APPROACH_OPTIONS = [
  { id: 'Thorough/detailed visits',      desc: 'Takes time, covers everything' },
  { id: 'Efficient/to the point',        desc: 'Respects your time, stays on topic' },
  { id: 'Collaborative decision-making', desc: 'Involves patients in care decisions' },
  { id: 'Education-focused',             desc: 'Explains conditions and options clearly' },
];

const TIME_OPTIONS = [
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00',
];

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${ampm}`;
}

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS: Record<string,string> = {
  monday:'MONDAY', tuesday:'TUESDAY', wednesday:'WEDNESDAY',
  thursday:'THURSDAY', friday:'FRIDAY', saturday:'SATURDAY', sunday:'SUNDAY',
};
const DEFAULT_DAY: DayHours     = { open:'09:00', close:'17:00', closed:false };
const DEFAULT_WEEKEND: DayHours = { open:'09:00', close:'13:00', closed:true  };

function defaultWeekHours(): WeekHours {
  const h: WeekHours = {};
  DAYS.forEach(d => { h[d] = (d==='saturday'||d==='sunday') ? {...DEFAULT_WEEKEND} : {...DEFAULT_DAY}; });
  return h;
}

// ─── Specialty Picker Modal ───────────────────────────────────────────────────
const SpecialtyPicker = ({
  visible, current, onSelect, onClose, title,
}: {
  visible:boolean; current:string; onSelect:(s:string)=>void; onClose:()=>void; title:string;
}) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() =>
    SPECIALTIES.filter(s => s.toLowerCase().includes(search.toLowerCase())),
    [search]
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={() => { onClose(); setSearch(''); }}>
              <Text style={pm.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={pm.searchBar}>
            <Text style={pm.searchIcon}>🔍</Text>
            <TextInput
              style={pm.searchInput} placeholder="Search specialty..."
              placeholderTextColor={C.textMuted} value={search} onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pm.option, current === item && pm.optionSelected]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[pm.optionText, current === item && pm.optionTextSelected]}>{item}</Text>
                {current === item && <Text style={pm.check}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Time Picker Modal ────────────────────────────────────────────────────────
const TimePickerModal = ({
  visible, current, onSelect, onClose,
}: { visible:boolean; current:string; onSelect:(t:string)=>void; onClose:()=>void }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={tp.overlay}>
      <View style={tp.sheet}>
        <View style={tp.header}>
          <Text style={tp.title}>Select Time</Text>
          <TouchableOpacity onPress={onClose}><Text style={tp.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map(t => (
            <TouchableOpacity
              key={t} style={[tp.option, current===t && tp.optionSelected]}
              onPress={() => { onSelect(t); onClose(); }}
            >
              <Text style={[tp.optionText, current===t && tp.optionTextSelected]}>{formatTime(t)}</Text>
              {current===t && <Text style={tp.check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// ─── Wait Time Picker ─────────────────────────────────────────────────────────
const WaitTimePicker = ({
  visible, days, hours, onChange, onClose,
}: { visible:boolean; days:number; hours:number; onChange:(d:number,h:number)=>void; onClose:()=>void }) => {
  const [tempDays, setTempDays]   = useState(days);
  const [tempHours, setTempHours] = useState(hours);
  useEffect(() => { if (visible) { setTempDays(days); setTempHours(hours); } }, [visible, days, hours]);
  const DAY_OPTIONS  = Array.from({length:91}, (_,i)=>i);
  const HOUR_OPTIONS = Array.from({length:24}, (_,i)=>i);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dp.overlay}>
        <View style={dp.sheet}>
          <View style={dp.header}>
            <Text style={dp.title}>Typical Wait for Appointment</Text>
            <TouchableOpacity onPress={onClose}><Text style={dp.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <View style={dp.columns}>
            <View style={dp.col}>
              <Text style={dp.colLabel}>DAYS</Text>
              <ScrollView style={dp.scroll} showsVerticalScrollIndicator={false}>
                {DAY_OPTIONS.map(d => (
                  <TouchableOpacity key={d} style={[dp.option, tempDays===d && dp.optionSel]} onPress={() => setTempDays(d)}>
                    <Text style={[dp.optionText, tempDays===d && dp.optionTextSel]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={dp.separator}>:</Text>
            <View style={dp.col}>
              <Text style={dp.colLabel}>HOURS</Text>
              <ScrollView style={dp.scroll} showsVerticalScrollIndicator={false}>
                {HOUR_OPTIONS.map(h => (
                  <TouchableOpacity key={h} style={[dp.option, tempHours===h && dp.optionSel]} onPress={() => setTempHours(h)}>
                    <Text style={[dp.optionText, tempHours===h && dp.optionTextSel]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <TouchableOpacity style={dp.doneBtn} onPress={() => { onChange(tempDays, tempHours); onClose(); }}>
            <Text style={dp.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Visit Length Picker ──────────────────────────────────────────────────────
const VisitLengthPicker = ({
  visible, totalMinutes, onChange, onClose,
}: { visible:boolean; totalMinutes:number; onChange:(total:number)=>void; onClose:()=>void }) => {
  const [tempH, setTempH] = useState(Math.floor(totalMinutes/60));
  const [tempM, setTempM] = useState(totalMinutes%60);
  useEffect(() => { if (visible) { setTempH(Math.floor(totalMinutes/60)); setTempM(totalMinutes%60); } }, [visible, totalMinutes]);
  const HOUR_OPTIONS = Array.from({length:5}, (_,i)=>i);
  const MIN_OPTIONS  = [0,5,10,15,20,25,30,45];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dp.overlay}>
        <View style={dp.sheet}>
          <View style={dp.header}>
            <Text style={dp.title}>Average Visit Length</Text>
            <TouchableOpacity onPress={onClose}><Text style={dp.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <View style={dp.columns}>
            <View style={dp.col}>
              <Text style={dp.colLabel}>HOURS</Text>
              <ScrollView style={dp.scroll} showsVerticalScrollIndicator={false}>
                {HOUR_OPTIONS.map(h => (
                  <TouchableOpacity key={h} style={[dp.option, tempH===h && dp.optionSel]} onPress={() => setTempH(h)}>
                    <Text style={[dp.optionText, tempH===h && dp.optionTextSel]}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={dp.separator}>:</Text>
            <View style={dp.col}>
              <Text style={dp.colLabel}>MINUTES</Text>
              <ScrollView style={dp.scroll} showsVerticalScrollIndicator={false}>
                {MIN_OPTIONS.map(m => (
                  <TouchableOpacity key={m} style={[dp.option, tempM===m && dp.optionSel]} onPress={() => setTempM(m)}>
                    <Text style={[dp.optionText, tempM===m && dp.optionTextSel]}>{m}m</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <TouchableOpacity style={dp.doneBtn} onPress={() => { onChange(tempH*60+tempM); onClose(); }}>
            <Text style={dp.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Day Hours Row ────────────────────────────────────────────────────────────
function DayHoursRow({ day, hours, onChange }: {
  day:string; hours:DayHours; onChange:(h:DayHours)=>void;
}) {
  const [pickerTarget, setPickerTarget] = useState<'open'|'close'|null>(null);
  return (
    <View style={dh.row}>
      <View style={dh.dayHeader}>
        <Text style={dh.dayLabel}>{DAY_LABELS[day]}</Text>
        <View style={dh.closedToggle}>
          <Text style={dh.closedLabel}>{hours.closed ? 'Closed' : 'Open'}</Text>
          <Switch value={!hours.closed} onValueChange={v => onChange({...hours, closed:!v})} trackColor={{false:C.border, true:C.accent}} thumbColor="#FFFFFF" style={{transform:[{scaleX:0.8},{scaleY:0.8}]}} />
        </View>
      </View>
      {!hours.closed && (
        <View style={dh.timeRow}>
          <TouchableOpacity style={dh.timeButton} onPress={() => setPickerTarget('open')}>
            <Text style={dh.timeLabel}>OPENS</Text>
            <Text style={dh.timeValue}>{formatTime(hours.open)}</Text>
          </TouchableOpacity>
          <Text style={dh.timeSep}>→</Text>
          <TouchableOpacity style={dh.timeButton} onPress={() => setPickerTarget('close')}>
            <Text style={dh.timeLabel}>CLOSES</Text>
            <Text style={dh.timeValue}>{formatTime(hours.close)}</Text>
          </TouchableOpacity>
        </View>
      )}
      <TimePickerModal visible={pickerTarget==='open'}  current={hours.open}  onSelect={t=>onChange({...hours,open:t})}  onClose={()=>setPickerTarget(null)} />
      <TimePickerModal visible={pickerTarget==='close'} current={hours.close} onSelect={t=>onChange({...hours,close:t})} onClose={()=>setPickerTarget(null)} />
    </View>
  );
}

// ─── Chip Group ───────────────────────────────────────────────────────────────
function ChipGroup({ label, hint, options, selected, onToggle }: {
  label:string; hint?:string; options:{id:string;desc:string}[]; selected:string[]; onToggle:(id:string)=>void;
}) {
  return (
    <View style={{marginBottom:24}}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      <View style={chip.grid}>
        {options.map(opt => {
          const isSel = selected.includes(opt.id);
          return (
            <TouchableOpacity key={opt.id} style={[chip.card, isSel && chip.cardSel]} onPress={() => onToggle(opt.id)} activeOpacity={0.7}>
              <View style={chip.top}>
                <Text style={[chip.label, isSel && chip.labelSel]}>{opt.id}</Text>
                {isSel && <Text style={chip.check}>✓</Text>}
              </View>
              <Text style={chip.desc}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Provider data type ───────────────────────────────────────────────────────
type ProviderData = {
  name:string; specialty:string; secondarySpecialty:string;
  phone:string; address:string; city:string;
  bio:string; education:string; languages:string;
  acceptingPatients:boolean; hours:WeekHours;
  telehealth:boolean; inPerson:boolean; telehealthOnly:boolean;
  communicationStyles:string[]; whoISee:string[]; visitApproach:string[];
  typicalWaitDays:number; typicalWaitHours:number;
  avgVisitMinutes:number; officeNotes:string;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProviderProfileScreen() {
  const router = useRouter();
  const { providerProfile, isProvider, initializing, refreshProfile } = useProviderAuth();

  const [data, setData] = useState<ProviderData>({
    name:'', specialty:'', secondarySpecialty:'',
    phone:'', address:'', city:'', bio:'', education:'', languages:'',
    acceptingPatients:true, hours:defaultWeekHours(),
    telehealth:false, inPerson:true, telehealthOnly:false,
    communicationStyles:[], whoISee:[], visitApproach:[],
    typicalWaitDays:0, typicalWaitHours:0, avgVisitMinutes:30, officeNotes:'',
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [activeSection, setActiveSection] = useState<'info'|'hours'|'about'|'experience'>('info');

  // Specialty picker tracks which field is being edited: 'primary' | 'secondary' | null
  const [specialtyPickerTarget, setSpecialtyPickerTarget] = useState<'primary'|'secondary'|null>(null);
  const [showWaitPicker,  setShowWaitPicker]  = useState(false);
  const [showVisitPicker, setShowVisitPicker] = useState(false);

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
      if (!snap.exists()) return;
      const d = snap.data();

      const loadedHours: WeekHours = defaultWeekHours();
      if (d.hours && typeof d.hours === 'object') {
        DAYS.forEach(day => { if (d.hours[day]) loadedHours[day] = d.hours[day]; });
      }

      setData({
        name:      d.name      || '',
        specialty: d.specialty || '',
        secondarySpecialty: d.secondarySpecialty || '',
        phone:     d.phone     || '',
        address:   d.address   || '',
        city:      d.city      || '',
        bio:       d.bio       || '',
        education: d.education || '',
        languages: d.languages || '',
        acceptingPatients: d.acceptingPatients ?? d.acceptingNewPatients ?? true,
        hours: loadedHours,
        telehealth:     d.telehealth     ?? false,
        inPerson:       d.inPerson       ?? true,
        telehealthOnly: d.telehealthOnly ?? false,
        communicationStyles: Array.isArray(d.communicationStyles) ? d.communicationStyles : [],
        whoISee:       Array.isArray(d.whoISee)       ? d.whoISee       : [],
        visitApproach: Array.isArray(d.visitApproach) ? d.visitApproach : [],
        typicalWaitDays:  typeof d.typicalWaitDays  === 'number' ? d.typicalWaitDays  : 0,
        typicalWaitHours: typeof d.typicalWaitHours === 'number' ? d.typicalWaitHours : 0,
        avgVisitMinutes:  typeof d.avgVisitMinutes  === 'number' ? d.avgVisitMinutes  : 30,
        officeNotes: typeof d.officeNotes === 'string' ? d.officeNotes : '',
      });
    } catch (error) {
      if (__DEV__) console.error('Error loading provider:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data.name.trim()) { Alert.alert('Required', 'Provider name is required.'); return; }
    if (!data.specialty)   { Alert.alert('Required', 'Primary specialty is required.'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'providers', providerProfile!.providerId), {
        name: data.name, specialty: data.specialty,
        // secondarySpecialty — empty string means none set
        secondarySpecialty: data.secondarySpecialty || '',
        phone: data.phone, address: data.address, city: data.city,
        bio: data.bio, education: data.education, languages: data.languages,
        acceptingPatients: data.acceptingPatients,
        acceptingNewPatients: data.acceptingPatients,
        hours: data.hours,
        telehealth: data.telehealth, inPerson: data.inPerson, telehealthOnly: data.telehealthOnly,
        communicationStyles: data.communicationStyles,
        whoISee: data.whoISee, visitApproach: data.visitApproach,
        typicalWaitDays: data.typicalWaitDays, typicalWaitHours: data.typicalWaitHours,
        avgVisitMinutes: data.avgVisitMinutes, officeNotes: data.officeNotes,
        updatedAt: serverTimestamp(), lastUpdatedBy: 'provider',
      });
      await refreshProfile();
      Alert.alert('Saved ✓', 'Your profile is live. Patients will see these changes immediately.');
    } catch (error) {
      if (__DEV__) console.error('Error saving provider:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof ProviderData, value: any) =>
    setData(prev => ({...prev, [field]: value}));

  const toggleArray = (field: 'communicationStyles'|'whoISee'|'visitApproach', id:string) =>
    setData(prev => {
      const arr = prev[field] as string[];
      return {...prev, [field]: arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id]};
    });

  const waitDisplay = data.typicalWaitDays===0 && data.typicalWaitHours===0
    ? 'Not set'
    : data.typicalWaitDays>0 && data.typicalWaitHours>0
      ? `${data.typicalWaitDays}d ${data.typicalWaitHours}h`
      : data.typicalWaitDays>0 ? `${data.typicalWaitDays} day${data.typicalWaitDays!==1?'s':''}` : `${data.typicalWaitHours} hour${data.typicalWaitHours!==1?'s':''}`;

  const visitDisplay = data.avgVisitMinutes===0 ? 'Not set'
    : data.avgVisitMinutes<60 ? `${data.avgVisitMinutes} min`
    : data.avgVisitMinutes%60===0 ? `${data.avgVisitMinutes/60}h`
    : `${Math.floor(data.avgVisitMinutes/60)}h ${data.avgVisitMinutes%60}m`;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const tabs: {key:typeof activeSection; label:string}[] = [
    {key:'info', label:'Practice'}, {key:'hours', label:'Hours'},
    {key:'about', label:'About'}, {key:'experience', label:'Patient View'},
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS==='ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backText}>← Dashboard</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Text style={styles.headerSubtitle}>Changes go live immediately</Text>
      </View>

      <View style={styles.sectionTabs}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.sectionTab, activeSection===tab.key && styles.sectionTabActive]} onPress={() => setActiveSection(tab.key)}>
            <Text style={[styles.sectionTabText, activeSection===tab.key && styles.sectionTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Practice Info ──────────────────────────────────────────── */}
        {activeSection === 'info' && (
          <>
            <Field label="FULL NAME" value={data.name} onChange={v=>set('name',v)} placeholder="Dr. Jane Smith" />

            {/* Primary Specialty */}
            <Text style={styles.fieldLabel}>PRIMARY SPECIALTY</Text>
            <Text style={styles.fieldHint}>Drives the subspecialty step in patient booking and your main listing badge.</Text>
            <TouchableOpacity
              style={[styles.pickerField, data.specialty ? styles.pickerFieldFilled : {}]}
              onPress={() => setSpecialtyPickerTarget('primary')}
            >
              <Text style={[styles.pickerFieldText, !data.specialty && {color:C.textMuted}]}>
                {data.specialty || 'Select primary specialty...'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            {/* Secondary Specialty — optional, max 1 additional */}
            <Text style={styles.fieldLabel}>
              SECONDARY SPECIALTY
              <Text style={styles.fieldHintInline}> (optional)</Text>
            </Text>
            <Text style={styles.fieldHint}>
              For providers with dual training, e.g. Internal Medicine + Geriatrics. Shown as a secondary badge on your profile.
            </Text>
            <TouchableOpacity
              style={[styles.pickerField,
                data.secondarySpecialty ? styles.pickerFieldFilled : {},
                { marginBottom: 8 }
              ]}
              onPress={() => setSpecialtyPickerTarget('secondary')}
            >
              <Text style={[styles.pickerFieldText, !data.secondarySpecialty && {color:C.textMuted}]}>
                {data.secondarySpecialty || 'Select secondary specialty...'}
              </Text>
              {data.secondarySpecialty ? (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); set('secondarySpecialty', ''); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: C.textMuted, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.pickerChevron}>›</Text>
              )}
            </TouchableOpacity>
            <View style={{ marginBottom: 20 }} />

            <Field label="PHONE NUMBER" value={data.phone} onChange={v=>set('phone',v)} placeholder="(405) 555-0100" keyboardType="phone-pad" />
            <Field label="STREET ADDRESS" value={data.address} onChange={v=>set('address',v)} placeholder="123 Main St, Suite 200" />
            <Field label="CITY" value={data.city} onChange={v=>set('city',v)} placeholder="Oklahoma City" />

            <Text style={styles.fieldLabel}>LANGUAGES SPOKEN</Text>
            <TextInput style={[styles.input,{marginBottom:20}]} value={data.languages} onChangeText={v=>set('languages',v)} placeholder="English, Spanish..." placeholderTextColor={C.textMuted} />

            <Toggle label="In-Person Visits"    sub="Patients can book in-person appointments"          value={data.inPerson}       onChange={v=>set('inPerson',v)} />
            <Toggle label="Telehealth Available" sub="Virtual appointments alongside in-person"           value={data.telehealth}     onChange={v=>set('telehealth',v)} />
            <Toggle label="Virtual Care Only"    sub="No in-person visits — shows a dedicated badge"     value={data.telehealthOnly} color="#3B82F6"
              onChange={v => { set('telehealthOnly',v); if (v) { set('telehealth',true); set('inPerson',false); } }}
            />
            <Toggle label="Accepting New Patients" sub="Appear in patient searches"                      value={data.acceptingPatients} onChange={v=>set('acceptingPatients',v)} />
          </>
        )}

        {/* ── Hours ──────────────────────────────────────────────────── */}
        {activeSection === 'hours' && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>Tap the open/close times to change them. Toggle the switch to mark a day as closed.</Text>
            </View>
            {DAYS.map(day => (
              <DayHoursRow key={day} day={day} hours={data.hours[day]} onChange={h => setData(p=>({...p,hours:{...p.hours,[day]:h}}))} />
            ))}
          </>
        )}

        {/* ── About ──────────────────────────────────────────────────── */}
        {activeSection === 'about' && (
          <>
            <Text style={styles.fieldLabel}>BIOGRAPHY</Text>
            <TextInput style={[styles.input,styles.textArea,{marginBottom:20}]} value={data.bio} onChangeText={v=>set('bio',v)} placeholder="Tell patients about yourself, your approach to care, and what makes your practice unique..." placeholderTextColor={C.textMuted} multiline numberOfLines={6} textAlignVertical="top" />
            <Text style={styles.fieldLabel}>EDUCATION & TRAINING</Text>
            <TextInput style={[styles.input,styles.textArea,{marginBottom:20}]} value={data.education} onChangeText={v=>set('education',v)} placeholder="MD, University of Oklahoma, 2005..." placeholderTextColor={C.textMuted} multiline numberOfLines={5} textAlignVertical="top" />
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>💡 Profiles with a biography receive significantly more bookings.</Text>
            </View>
          </>
        )}

        {/* ── Patient View ─────────────────────────────────────────────── */}
        {activeSection === 'experience' && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>This information appears on your patient-facing profile. The more you fill in, the more bookings you receive.</Text>
            </View>

            <Text style={styles.fieldLabel}>MESSAGE TO PATIENTS</Text>
            <Text style={styles.fieldHint}>Shown as a pinned note on your profile — parking, what to bring, wait time warnings, etc.</Text>
            <TextInput style={[styles.input,styles.textArea,{marginBottom:6}]} value={data.officeNotes} onChangeText={v=>set('officeNotes',v)} placeholder="e.g. Please arrive 15 minutes early. Free parking in the rear lot." placeholderTextColor={C.textMuted} multiline numberOfLines={4} textAlignVertical="top" maxLength={300} />
            <Text style={styles.charCount}>{data.officeNotes.length}/300</Text>

            <View style={styles.divider} />

            <Text style={[styles.fieldLabel,{marginBottom:4}]}>WAIT TIMES</Text>
            <Text style={styles.fieldHint}>Tap to configure. Shown on your profile to set patient expectations.</Text>

            <TouchableOpacity style={styles.timeDisplayRow} onPress={() => setShowWaitPicker(true)}>
              <View>
                <Text style={styles.timeDisplayLabel}>Typical wait for appointment</Text>
                <Text style={[styles.timeDisplayValue, waitDisplay==='Not set' && {color:C.textMuted}]}>{waitDisplay}</Text>
              </View>
              <Text style={styles.timeDisplayEdit}>Edit →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.timeDisplayRow,{marginBottom:24}]} onPress={() => setShowVisitPicker(true)}>
              <View>
                <Text style={styles.timeDisplayLabel}>Average visit length</Text>
                <Text style={[styles.timeDisplayValue, visitDisplay==='Not set' && {color:C.textMuted}]}>{visitDisplay}</Text>
              </View>
              <Text style={styles.timeDisplayEdit}>Edit →</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <ChipGroup label="COMMUNICATION STYLE" hint="Select up to 3 tags that appear as colored chips on your profile."
              options={COMMUNICATION_STYLE_OPTIONS} selected={data.communicationStyles}
              onToggle={id => {
                if (!data.communicationStyles.includes(id) && data.communicationStyles.length >= 3) {
                  Alert.alert('Maximum 3', 'Select up to 3 communication style tags.'); return;
                }
                toggleArray('communicationStyles', id);
              }}
            />
            <View style={styles.divider} />
            <ChipGroup label="WHO I SEE" hint="What patient populations do you serve?" options={WHO_I_SEE_OPTIONS} selected={data.whoISee} onToggle={id => toggleArray('whoISee', id)} />
            <View style={styles.divider} />
            <ChipGroup label="VISIT APPROACH" hint="How would you describe your appointment style?" options={VISIT_APPROACH_OPTIONS} selected={data.visitApproach} onToggle={id => toggleArray('visitApproach', id)} />
          </>
        )}

        <View style={{height:100}} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>Save Changes →</Text>}
        </TouchableOpacity>
      </View>

      {/* Specialty pickers — primary and secondary share the same component */}
      <SpecialtyPicker
        visible={specialtyPickerTarget === 'primary'}
        current={data.specialty}
        title="Primary Specialty"
        onSelect={v => set('specialty', v)}
        onClose={() => setSpecialtyPickerTarget(null)}
      />
      <SpecialtyPicker
        visible={specialtyPickerTarget === 'secondary'}
        current={data.secondarySpecialty}
        title="Secondary Specialty (optional)"
        onSelect={v => {
          // Prevent selecting the same specialty twice
          if (v === data.specialty) {
            Alert.alert('Already selected', 'This is already your primary specialty. Choose a different one.');
            return;
          }
          set('secondarySpecialty', v);
        }}
        onClose={() => setSpecialtyPickerTarget(null)}
      />
      <WaitTimePicker
        visible={showWaitPicker} days={data.typicalWaitDays} hours={data.typicalWaitHours}
        onChange={(d,h) => { set('typicalWaitDays',d); set('typicalWaitHours',h); }}
        onClose={() => setShowWaitPicker(false)}
      />
      <VisitLengthPicker
        visible={showVisitPicker} totalMinutes={data.avgVisitMinutes}
        onChange={v => set('avgVisitMinutes',v)} onClose={() => setShowVisitPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string; keyboardType?:any;
}) {
  return (
    <View style={{marginBottom:20}}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.textMuted} keyboardType={keyboardType||'default'} />
    </View>
  );
}

function Toggle({ label, sub, value, onChange, color }: {
  label:string; sub:string; value:boolean; onChange:(v:boolean)=>void; color?:string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{flex:1}}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{false:C.border, true:color||C.accent}} thumbColor="#FFFFFF" />
    </View>
  );
}

// ─── Sub-styles ───────────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  overlay:  {flex:1, backgroundColor:C.overlay, justifyContent:'flex-end'},
  sheet:    {backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:'80%'},
  header:   {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12},
  title:    {color:C.textPrimary, fontSize:17, fontWeight:'700'},
  close:    {color:C.textSub, fontSize:20, padding:4},
  searchBar:{flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.inputBg, borderWidth:1, borderColor:C.border, borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8},
  searchIcon:{fontSize:16},
  searchInput:{flex:1, color:C.textPrimary, fontSize:15},
  option:   {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:C.border},
  optionSelected:{backgroundColor:C.accentBg},
  optionText:{color:C.textSub, fontSize:15},
  optionTextSelected:{color:C.accent, fontWeight:'700'},
  check:    {color:C.accent, fontSize:16, fontWeight:'700'},
});

const tp = StyleSheet.create({
  overlay:{flex:1, backgroundColor:C.overlay, justifyContent:'flex-end'},
  sheet:  {backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:'60%'},
  header: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16},
  title:  {color:C.textPrimary, fontSize:17, fontWeight:'700'},
  close:  {color:C.textSub, fontSize:20, padding:4},
  option: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:C.border},
  optionSelected:{backgroundColor:C.accentBg},
  optionText:{color:C.textSub, fontSize:16},
  optionTextSelected:{color:C.accent, fontWeight:'700'},
  check:  {color:C.accent, fontSize:16, fontWeight:'700'},
});

const dp = StyleSheet.create({
  overlay: {flex:1, backgroundColor:C.overlay, justifyContent:'flex-end'},
  sheet:   {backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, paddingBottom:34},
  header:  {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20},
  title:   {color:C.textPrimary, fontSize:16, fontWeight:'700', flex:1},
  closeBtn:{color:C.textSub, fontSize:20, padding:4},
  columns: {flexDirection:'row', alignItems:'center', gap:8, marginBottom:20},
  col:     {flex:1},
  colLabel:{color:C.textMuted, fontSize:10, fontWeight:'700', letterSpacing:1.5, textAlign:'center', marginBottom:8},
  scroll:  {maxHeight:200, backgroundColor:C.inputBg, borderRadius:10, borderWidth:1, borderColor:C.border},
  option:  {paddingVertical:12, alignItems:'center', borderBottomWidth:1, borderBottomColor:C.border},
  optionSel:{backgroundColor:C.accentBg},
  optionText:{color:C.textSub, fontSize:16},
  optionTextSel:{color:C.accent, fontWeight:'700'},
  separator:{color:C.border, fontSize:20, fontWeight:'300'},
  doneBtn: {backgroundColor:C.accent, padding:16, borderRadius:12, alignItems:'center'},
  doneBtnText:{color:'#FFFFFF', fontSize:16, fontWeight:'700'},
});

const dh = StyleSheet.create({
  row:         {backgroundColor:C.surface, borderRadius:12, borderWidth:1, borderColor:C.border, padding:16, marginBottom:12},
  dayHeader:   {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12},
  dayLabel:    {color:C.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5},
  closedToggle:{flexDirection:'row', alignItems:'center', gap:8},
  closedLabel: {color:C.textSub, fontSize:13},
  timeRow:     {flexDirection:'row', alignItems:'center', gap:12},
  timeButton:  {flex:1, backgroundColor:C.inputBg, borderRadius:8, borderWidth:1, borderColor:C.border, padding:12, alignItems:'center'},
  timeLabel:   {color:C.textMuted, fontSize:10, fontWeight:'700', letterSpacing:1, marginBottom:4},
  timeValue:   {color:C.accent, fontSize:15, fontWeight:'600'},
  timeSep:     {color:C.border, fontSize:16},
});

const chip = StyleSheet.create({
  grid:    {flexDirection:'row', flexWrap:'wrap', gap:10},
  card:    {backgroundColor:C.surface, borderRadius:10, borderWidth:1, borderColor:C.border, padding:12, width:'47%'},
  cardSel: {borderColor:C.accent, backgroundColor:C.accentBg},
  top:     {flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4},
  label:   {color:C.textSub, fontSize:13, fontWeight:'600', flex:1, lineHeight:18},
  labelSel:{color:C.accent},
  desc:    {color:C.textMuted, fontSize:11, lineHeight:16},
  check:   {color:C.accent, fontSize:13, fontWeight:'700', marginLeft:4},
});

const styles = StyleSheet.create({
  container: {flex:1, backgroundColor:C.bg},
  center:    {justifyContent:'center', alignItems:'center'},
  header:    {paddingTop:64, paddingBottom:16, paddingHorizontal:20, gap:4, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border},
  backText:  {color:C.accent, fontSize:14, fontWeight:'600', marginBottom:8},
  headerTitle:   {color:C.textPrimary, fontSize:26, fontWeight:'700'},
  headerSubtitle:{color:C.textSub, fontSize:13},
  sectionTabs:       {flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.border, paddingHorizontal:20, backgroundColor:C.surface},
  sectionTab:        {paddingVertical:14, paddingHorizontal:10, marginRight:2},
  sectionTabActive:  {borderBottomWidth:2, borderBottomColor:C.accent},
  sectionTabText:    {color:C.textSub, fontSize:13, fontWeight:'600'},
  sectionTabTextActive:{color:C.accent},
  scrollContent: {padding:20},
  fieldLabel:    {color:C.textSub, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:6},
  fieldHint:     {color:C.textMuted, fontSize:12, lineHeight:17, marginBottom:10},
  fieldHintInline:{color:C.textMuted, fontSize:11, fontWeight:'400', letterSpacing:0},
  charCount:     {color:C.textMuted, fontSize:11, textAlign:'right', marginTop:-4, marginBottom:16},
  input: {backgroundColor:C.inputBg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:16, color:C.textPrimary, fontSize:15},
  textArea: {minHeight:120, lineHeight:22},
  pickerField: {backgroundColor:C.inputBg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:16, marginBottom:20, flexDirection:'row', alignItems:'center', justifyContent:'space-between'},
  pickerFieldFilled: {borderColor:C.accent},
  pickerFieldText: {fontSize:15, color:C.textPrimary, flex:1},
  pickerChevron:   {color:C.textMuted, fontSize:20},
  toggleRow: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:C.surface, borderRadius:10, borderWidth:1, borderColor:C.border, padding:16, marginBottom:12},
  toggleLabel:{color:C.textPrimary, fontSize:15, fontWeight:'600', marginBottom:2},
  toggleSub:  {color:C.textSub, fontSize:12, lineHeight:16},
  infoBox: {backgroundColor:C.accentBg, borderWidth:1, borderColor:C.accentBorder, borderRadius:10, padding:16, marginBottom:16},
  infoBoxText:{color:C.accent, fontSize:13, lineHeight:20},
  divider:    {borderTopWidth:1, borderTopColor:C.border, marginVertical:20},
  timeDisplayRow: {backgroundColor:C.surface, borderRadius:12, borderWidth:1, borderColor:C.border, padding:16, marginBottom:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between'},
  timeDisplayLabel:{color:C.textSub, fontSize:12, fontWeight:'600', marginBottom:4},
  timeDisplayValue:{color:C.textPrimary, fontSize:20, fontWeight:'700'},
  timeDisplayEdit: {color:C.accent, fontSize:14, fontWeight:'600'},
  footer: {position:'absolute', bottom:0, left:0, right:0, padding:16, backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border},
  saveButton:        {backgroundColor:C.accent, padding:18, borderRadius:12, alignItems:'center'},
  saveButtonDisabled:{opacity:0.6},
  saveButtonText:    {color:'#FFFFFF', fontSize:16, fontWeight:'700'},
});
