import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function DataDisclaimer() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.icon, { color: colors.subtext }]}>ℹ️</Text>
      <Text style={[styles.text, { color: colors.subtext }]}>
        Provider information is from public sources. Always call to verify insurance 
        acceptance and availability before visiting.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});