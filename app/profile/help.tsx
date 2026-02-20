import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

export default function HelpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Help & Support</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>We're here to help!</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Submit a Request</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Describe your issue..."
            placeholderTextColor={colors.subtext}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={submitRequest}
          >
            <Text style={styles.buttonText}>Submit Request</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
          <FAQItem 
            question="How do I book an appointment?" 
            answer="Search for a provider, click 'View Details', then 'Book Appointment'."
            colors={colors}
          />
          <FAQItem 
            question="How do I update my insurance info?" 
            answer="Go to Profile > Insurance Information and enter your details."
            colors={colors}
          />
          <FAQItem 
            question="When will my lab results be ready?" 
            answer="Lab results typically take 2-5 business days. Check with your provider for specifics."
            colors={colors}
          />
          <FAQItem 
            question="How do I reset my password?" 
            answer="Currently, contact support to reset your password. We're working on self-service password reset."
            colors={colors}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
          <Text style={[styles.contactText, { color: colors.text }]}>📧 Email: support@accesscare.com</Text>
          <Text style={[styles.contactText, { color: colors.text }]}>📞 Phone: 1-800-ACCESS-CARE</Text>
          <Text style={[styles.contactText, { color: colors.text }]}>⏰ Hours: Mon-Fri 8am-6pm CST</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

function FAQItem({ question, answer, colors }: { question: string; answer: string; colors: any }) {
  return (
    <View style={[styles.faqItem, { backgroundColor: colors.background }]}>
      <Text style={[styles.faqQuestion, { color: colors.text }]}>Q: {question}</Text>
      <Text style={[styles.faqAnswer, { color: colors.subtext }]}>A: {answer}</Text>
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
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 16, 
  },
  content: {
    flex: 1,
  },
  section: { 
    margin: 16, 
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15,
  },
  input: { 
    borderWidth: 2, 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 15, 
    minHeight: 120, 
    fontSize: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  faqItem: { 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10,
  },
  faqQuestion: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    marginBottom: 5,
  },
  faqAnswer: { 
    fontSize: 14,
  },
  contactText: { 
    fontSize: 15, 
    marginBottom: 8,
  },
  bottomPadding: { height: 40 },
});