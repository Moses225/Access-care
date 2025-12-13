import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function HelpScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  const submitRequest = async () => {
    if (!message) return Alert.alert('Error', 'Please enter a message');
    
    await addDoc(collection(db, 'supportRequests'), {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      message,
      createdAt: new Date(),
      status: 'pending'
    });
    
    setMessage('');
    Alert.alert('Submitted', 'Your support request has been sent. We will respond within 24 hours.', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>We're here to help!</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submit a Request</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe your issue..."
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Button title="Submit Request" onPress={submitRequest} color="#667eea" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <FAQItem 
          question="How do I book an appointment?" 
          answer="Search for a provider, click 'View Details', then 'Book Appointment'." 
        />
        <FAQItem 
          question="How do I update my insurance info?" 
          answer="Go to Profile > Insurance Information and enter your details." 
        />
        <FAQItem 
          question="When will my lab results be ready?" 
          answer="Lab results typically take 2-5 business days. Check with your provider for specifics." 
        />
        <FAQItem 
          question="How do I reset my password?" 
          answer="Currently, contact support to reset your password. We're working on self-service password reset." 
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <Text style={styles.contactText}>📧 Email: support@accesscare.com</Text>
        <Text style={styles.contactText}>📞 Phone: 1-800-ACCESS-CARE</Text>
        <Text style={styles.contactText}>⏰ Hours: Mon-Fri 8am-6pm CST</Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.faqItem}>
      <Text style={styles.faqQuestion}>Q: {question}</Text>
      <Text style={styles.faqAnswer}>A: {answer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginHorizontal: 20, color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginHorizontal: 20, marginBottom: 20 },
  section: { marginHorizontal: 20, marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  input: { 
    borderWidth: 2, 
    borderColor: '#e0e0e0', 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 15, 
    minHeight: 120, 
    fontSize: 16,
    color: '#333'
  },
  faqItem: { 
    backgroundColor: '#f0f0ff', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10 
  },
  faqQuestion: { fontSize: 15, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  faqAnswer: { fontSize: 14, color: '#666' },
  contactText: { fontSize: 15, color: '#333', marginBottom: 8 },
  bottomPadding: { height: 40 },
});