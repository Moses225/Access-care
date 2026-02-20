import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>About AccessCare</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mission */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Why AccessCare Exists
          </Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            Finding a doctor shouldn't take hours of calling offices, searching websites, and hoping they accept your insurance.
          </Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            AccessCare was created to remove those barriers.
          </Text>
        </View>

        {/* What We Do */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What We Do
          </Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We bring together real, verified healthcare providers and make it easy to:
          </Text>
          
          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Find care near you
            </Text>
          </View>
          
          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Filter by the insurance you use
            </Text>
          </View>
          
          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Request appointments quickly
            </Text>
          </View>
          
          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Access essential services for you and your family
            </Text>
          </View>
        </View>

        {/* Our Commitment */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Our Commitment
          </Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We are especially committed to supporting SoonerCare and Medicaid members, new and expecting mothers, and families who have historically faced the biggest challenges accessing care.
          </Text>
        </View>

        {/* Our Belief */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.quote, { color: colors.primary }]}>
            Healthcare access is not a luxury — it's a necessity.
          </Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            AccessCare is here to make it simple, transparent, and human.
          </Text>
        </View>

        {/* Version Info */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.versionLabel, { color: colors.subtext }]}>Version</Text>
          <Text style={[styles.versionValue, { color: colors.text }]}>
            AccessCare v1.0.0 Beta
          </Text>
          
          <Text style={[styles.versionLabel, { color: colors.subtext }]}>
            © 2026 AccessCare. All rights reserved.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 20,
    marginRight: 12,
    fontWeight: 'bold',
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  quote: {
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'italic',
    lineHeight: 28,
    marginBottom: 16,
    textAlign: 'center',
  },
  versionLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
});