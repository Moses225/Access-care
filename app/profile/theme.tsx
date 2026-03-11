import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeScreen() {
  const router = useRouter();
  const { currentTheme, themes, colors, setTheme } = useTheme();

  const handleThemeSelect = async (themeId: string) => {
    try {
      if (__DEV__) console.log('👆 User selected theme:', themeId);

      if (themeId === currentTheme.id) {
        if (__DEV__) console.log('ℹ️ Same theme selected, ignoring');
        return;
      }

      await setTheme(themeId);

      Alert.alert(
        'Theme Updated! 🎨',
        'Your theme has been changed successfully.',
        [{ text: 'OK' }]
      );

      if (__DEV__) console.log('✅ Theme selection complete');

    } catch (error) {
      if (__DEV__) console.error('❌ Error changing theme:', error);
      Alert.alert(
        'Error',
        'Failed to change theme. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Choose Your Theme
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Personalize your app experience
          </Text>
        </View>

        {/* Theme Options */}
        <View style={styles.themesContainer}>
          {themes.map((theme) => {
            const isSelected = theme.id === currentTheme.id;

            return (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 3 : 1,
                  },
                ]}
                onPress={() => handleThemeSelect(theme.id)}
                activeOpacity={0.7}
              >
                {/* Theme Name */}
                <View style={styles.themeHeader}>
                  <Text style={[styles.themeName, { color: colors.text }]}>
                    {theme.name}
                  </Text>

                  {/* Selected Badge */}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.selectedBadgeText}>✓ Active</Text>
                    </View>
                  )}
                </View>

                {/* Color Preview */}
                <View style={styles.colorPreview}>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorBox, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.colorLabel}>Primary</Text>
                    </View>
                    <View style={[styles.colorBox, { backgroundColor: theme.colors.secondary }]}>
                      <Text style={styles.colorLabel}>Secondary</Text>
                    </View>
                  </View>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorBox, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.colorLabel, { color: theme.colors.text }]}>
                        Background
                      </Text>
                    </View>
                    <View style={[styles.colorBox, { backgroundColor: theme.colors.card }]}>
                      <Text style={[styles.colorLabel, { color: theme.colors.text }]}>
                        Card
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Tap to Apply */}
                {!isSelected && (
                  <Text style={[styles.tapText, { color: colors.subtext }]}>
                    Tap to apply
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoIcon, { color: colors.primary }]}>💡</Text>
          <Text style={[styles.infoText, { color: colors.subtext }]}>
            Your theme preference will be saved and applied across the entire app.
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
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  themesContainer: {
    padding: 16,
    gap: 16,
  },
  themeCard: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  themeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  themeName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  colorPreview: {
    gap: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorBox: {
    flex: 1,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tapText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
