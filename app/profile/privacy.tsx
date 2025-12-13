import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function PrivacyScreen() {
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
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Share Data with Providers</Text>
        <Switch
          value={shareData}
          onValueChange={(val) => {
            setShareData(val);
            updatePrivacy('shareData', val);
          }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Enable Two-Factor Authentication</Text>
        <Switch
          value={twoFactorAuth}
          onValueChange={(val) => {
            setTwoFactorAuth(val);
            updatePrivacy('twoFactorAuth', val);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 16, color: '#333' },
});