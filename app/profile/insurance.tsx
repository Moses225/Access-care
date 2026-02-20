import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function InsuranceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [provider, setProvider] = useState('');
  const [policy, setPolicy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const fetchInsurance = async () => {
      const ref = doc(db, 'insurance', uid);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProvider(data.provider || '');
        setPolicy(data.policy || '');
      }
    };

    fetchInsurance();
  }, []);

  const saveInsurance = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if (!provider || !policy) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await setDoc(doc(db, 'insurance', uid), { provider, policy });
      Alert.alert('Success', 'Insurance information saved successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save insurance information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Insurance Information</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.text }]}>Insurance Provider</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Blue Cross Blue Shield"
          placeholderTextColor={colors.subtext}
          value={provider}
          onChangeText={setProvider}
        />
        
        <Text style={[styles.label, { color: colors.text }]}>Policy Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., ABC123456789"
          placeholderTextColor={colors.subtext}
          value={policy}
          onChangeText={setPolicy}
        />
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
          onPress={saveInsurance}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : 'Save Insurance Info'}
          </Text>
        </TouchableOpacity>
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
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});