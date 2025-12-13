import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>About AccessCare</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.text}>
          AccessCare bridges the healthcare gap by connecting patients with quality providers, 
          regardless of location. Whether you live in a remote rural area or a bustling city, 
          AccessCare ensures you have access to comprehensive healthcare services.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Breaking Down Barriers</Text>
        <Text style={styles.text}>
          We believe geography should never limit access to quality healthcare. AccessCare 
          connects patients in underserved communities with providers across all specialties—from 
          primary care to rare disease specialists.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Offer</Text>
        <BulletPoint text="Connect with 23+ healthcare providers across 3 service categories" />
        <BulletPoint text="Find the nearest care center, no matter where you are" />
        <BulletPoint text="Direct Q&A with healthcare professionals 24/7" />
        <BulletPoint text="Seamless appointment booking and navigation" />
        <BulletPoint text="Access to rare and specialized services" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Network</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Core Services:</Text> OB/GYN, Midwives, Hospitals, Family Medicine, Pediatrics{'\n\n'}
          <Text style={styles.bold}>Extended Services:</Text> Maternal-Fetal Medicine, Mental Health, Nutrition, Physical Therapy{'\n\n'}
          <Text style={styles.bold}>Rare & Specialized:</Text> Genetic Counseling, Neonatology, Reproductive Endocrinology, Palliative Care
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@accesscare.com')}>
          <Text style={styles.link}>📧 support@accesscare.com</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('tel:1-800-227-2273')}>
          <Text style={styles.link}>📞 1-800-ACCESS-CARE (1-800-227-2273)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.link}>HIPAA Notice</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.copyright}>© 2025 AccessCare. All rights reserved.</Text>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function BulletPoint({ text }: { text: string }) {
  return (
    <View style={styles.bulletPoint}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backButton: { padding: 20, paddingTop: 60 },
  backButtonText: { fontSize: 16, color: '#667eea', fontWeight: '600' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#667eea', paddingHorizontal: 20, marginBottom: 30 },
  section: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  text: { fontSize: 16, color: '#666', lineHeight: 24 },
  bold: { fontWeight: 'bold', color: '#333' },
  bulletPoint: { flexDirection: 'row', marginBottom: 10 },
  bullet: { fontSize: 16, color: '#667eea', marginRight: 10 },
  bulletText: { fontSize: 16, color: '#666', flex: 1 },
  link: { fontSize: 16, color: '#667eea', marginBottom: 12, fontWeight: '500' },
  version: { textAlign: 'center', color: '#999', fontSize: 14, marginBottom: 5 },
  copyright: { textAlign: 'center', color: '#999', fontSize: 12, marginBottom: 20 },
  bottomPadding: { height: 40 },
});