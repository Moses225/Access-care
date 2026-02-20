import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [shareData, setShareData] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const fetchPrivacy = async () => {
      const ref = doc(db, 'privacy', uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setShareData(data.shareData ?? false);
        setTwoFactorAuth(data.twoFactorAuth ?? false);
      }
    };
    fetchPrivacy();
  }, []);

  const updatePrivacy = async (field: string, value: boolean) => {
    if (!auth.currentUser?.uid) return;
    await setDoc(doc(db, 'privacy', auth.currentUser.uid), { [field]: value }, { merge: true });
    Alert.alert('Updated', 'Privacy settings saved.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Privacy & Security</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Share Data with Providers</Text>
          <Switch
            value={shareData}
            onValueChange={(val) => {
              setShareData(val);
              updatePrivacy('shareData', val);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={shareData ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Enable Two-Factor Authentication</Text>
          <Switch
            value={twoFactorAuth}
            onValueChange={(val) => {
              setTwoFactorAuth(val);
              updatePrivacy('twoFactorAuth', val);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={twoFactorAuth ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  label: { fontSize: 16, flex: 1, marginRight: 10 },
});