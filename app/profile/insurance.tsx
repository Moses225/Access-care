import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function InsuranceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInsuranceInfo();
  }, []);

  const loadInsuranceInfo = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const insuranceDoc = await getDoc(doc(db, 'insurance', user.uid));
      if (insuranceDoc.exists()) {
        const data = insuranceDoc.data();
        setProvider(data.provider || '');
        setPolicyNumber(data.policy || '');
      }
    } catch (error) {
      console.error('Error loading insurance:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      await setDoc(doc(db, 'insurance', user.uid), {
        provider: provider,
        policy: policyNumber,
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Insurance information saved');
    } catch (error) {
      console.error('Error saving insurance:', error);
      Alert.alert('Error', 'Failed to save insurance information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Insurance Information</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Save your insurance details for faster booking
          </Text>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Insurance Provider</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., SoonerCare, Blue Cross"
              placeholderTextColor={colors.subtext}
              value={provider}
              onChangeText={setProvider}
            />

            <Text style={[styles.label, { color: colors.text }]}>Policy/Member Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Your policy number"
              placeholderTextColor={colors.subtext}
              value={policyNumber}
              onChangeText={setPolicyNumber}
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Information'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  saveButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});