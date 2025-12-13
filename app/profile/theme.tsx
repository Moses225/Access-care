import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeScreen() {
  const { theme, setTheme, colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>

      <TouchableOpacity
        style={[styles.option, theme === 'light' && styles.optionActive, { borderColor: colors.border }]}
        onPress={() => setTheme('light')}
      >
        <Text style={[styles.optionText, { color: colors.text }]}>☀️ Light Mode</Text>
        {theme === 'light' && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, theme === 'dark' && styles.optionActive, { borderColor: colors.border }]}
        onPress={() => setTheme('dark')}
      >
        <Text style={[styles.optionText, { color: colors.text }]}>🌙 Dark Mode</Text>
        {theme === 'dark' && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, theme === 'system' && styles.optionActive, { borderColor: colors.border }]}
        onPress={() => setTheme('system')}
      >
        <Text style={[styles.optionText, { color: colors.text }]}>⚙️ System Default</Text>
        {theme === 'system' && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 15,
  },
  optionActive: { borderColor: '#667eea' },
  optionText: { fontSize: 16, fontWeight: '500' },
  check: { fontSize: 20, color: '#667eea' },
});