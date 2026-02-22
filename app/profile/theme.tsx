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

export default function ThemeScreen() {
  const router = useRouter();
  const { themeId, setTheme, colors } = useTheme();

  const themes = [
    { id: 'maternalPink', name: 'Maternal Pink', emoji: '🌸' },
    { id: 'oceanBlue', name: 'Ocean Blue', emoji: '🌊' },
    { id: 'softLavender', name: 'Soft Lavender', emoji: '💜' },
    { id: 'peachCream', name: 'Peach Cream', emoji: '🍑' },
    { id: 'mintFresh', name: 'Mint Fresh', emoji: '🌿' },
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
          <Text style={[styles.title, { color: colors.text }]}>Choose Theme</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Select your preferred color scheme
          </Text>

          {themes.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.themeCard,
                { 
                  backgroundColor: colors.card,
                  borderColor: themeId === t.id ? colors.primary : colors.border,
                  borderWidth: 2,
                }
              ]}
              onPress={() => setTheme(t.id)}
            >
              <Text style={styles.themeEmoji}>{t.emoji}</Text>
              <Text style={[styles.themeName, { color: colors.text }]}>
                {t.name}
              </Text>
              {themeId === t.id && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
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
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  themeEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  themeName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  checkmark: {
    fontSize: 24,
    color: '#2ECC71',
  },
});