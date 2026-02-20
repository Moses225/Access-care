import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeIn.delay(100)}>
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder || "Search..."}
          placeholderTextColor={colors.subtext}
          value={value}
          onChangeText={onChangeText}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
            <Text style={[styles.clearIcon, { color: colors.subtext }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 2,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});