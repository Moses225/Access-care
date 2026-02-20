import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemeSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemeSelector({ visible, onClose }: ThemeSelectorProps) {
  const { currentTheme, themeId, setTheme, availableThemes, colors } = useTheme();

  const handleSelectTheme = (newThemeId: string) => {
    setTheme(newThemeId);
    setTimeout(() => onClose(), 300); // Small delay for visual feedback
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Choose Your Theme
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Theme Options */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.values(availableThemes).map((theme) => {
              const isSelected = theme.id === themeId;
              
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 3 : 1,
                    },
                  ]}
                  onPress={() => handleSelectTheme(theme.id)}
                  activeOpacity={0.7}
                >
                  {/* Color Preview */}
                  <View style={styles.colorPreview}>
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: theme.colors.secondary },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: theme.colors.accent },
                      ]}
                    />
                  </View>

                  {/* Theme Info */}
                  <View style={styles.themeInfo}>
                    <Text style={[styles.themeName, { color: colors.text }]}>
                      {theme.name}
                    </Text>
                    <Text style={[styles.themeDescription, { color: colors.subtext }]}>
                      {theme.description}
                    </Text>
                  </View>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <View
                      style={[
                        styles.selectedBadge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.selectedText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  colorPreview: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 16,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 14,
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});