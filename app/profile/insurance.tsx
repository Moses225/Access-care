import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function InsuranceScreen() {
  const router = useRouter();
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
    <View style={styles.container}>
      <Text style={styles.label}>Insurance Provider</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Blue Cross Blue Shield"
        placeholderTextColor="#999"
        value={provider}
        onChangeText={setProvider}
      />
      
      <Text style={styles.label}>Policy Number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., ABC123456789"
        placeholderTextColor="#999"
        value={policy}
        onChangeText={setPolicy}
      />
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={saveInsurance}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Insurance Info'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  button: {
    backgroundColor: '#667eea',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});