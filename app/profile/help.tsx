import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function HelpScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const faqs = [
    {
      question: 'How do I book an appointment?',
      answer: 'Search for a provider, tap on their profile, and click "Book Appointment". Select your preferred date and time, then confirm.'
    },
    {
      question: 'What insurance do you accept?',
      answer: 'AccessCare focuses on SoonerCare and Medicaid providers. All providers shown accept these insurances. Some also accept additional plans.'
    },
    {
      question: 'How do I cancel an appointment?',
      answer: 'Go to the Appointments tab, find your appointment, and tap "Cancel Appointment".'
    },
    {
      question: 'Is my information secure?',
      answer: 'Yes! We use industry-standard encryption and never share your personal health information without your consent.'
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Help Center</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Frequently asked questions
          </Text>

          {faqs.map((faq, index) => (
            <View key={index} style={[styles.faqCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.question, { color: colors.text }]}>
                {faq.question}
              </Text>
              <Text style={[styles.answer, { color: colors.subtext }]}>
                {faq.answer}
              </Text>
            </View>
          ))}
        </ScrollView>
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
    marginBottom: 24,
  },
  faqCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  answer: {
    fontSize: 14,
    lineHeight: 20,
  },
});