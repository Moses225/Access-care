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

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useTheme();

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
          <Text style={[styles.title, { color: colors.text }]}>About AccessCare</Text>
          
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Our Mission
            </Text>
            <Text style={[styles.sectionText, { color: colors.subtext }]}>
              Finding a doctor shouldn't take hours of calling offices, searching websites, and hoping they accept your insurance. AccessCare was created to remove those barriers.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What We Do
            </Text>
            <Text style={[styles.sectionText, { color: colors.subtext }]}>
              • Find care near you{'\n'}
              • Filter by insurance{'\n'}
              • Request appointments quickly{'\n'}
              • Access essential services for your family
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Our Commitment
            </Text>
            <Text style={[styles.sectionText, { color: colors.subtext }]}>
              We're especially focused on supporting SoonerCare and Medicaid members, expecting mothers, and families facing healthcare access challenges in Oklahoma.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Our Belief
            </Text>
            <Text style={[styles.sectionText, { color: colors.subtext }]}>
              Healthcare isn't a luxury—it's a necessity. Everyone deserves simple, transparent access to quality care.
            </Text>
          </View>

          <Text style={[styles.version, { color: colors.subtext }]}>
            Version 1.0.0
          </Text>
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
    marginBottom: 24,
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 40,
  },
});