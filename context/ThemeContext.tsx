import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

// ============================================
// THEME DEFINITIONS
// ============================================
export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
}

// Available themes
export const themes: Theme[] = [
  {
    id: 'default',
    name: 'Default Blue',
    colors: {
      primary: '#2E75B6',
      secondary: '#4A90E2',
      background: '#F5F7FA',
      card: '#FFFFFF',
      text: '#1A1A1A',
      subtext: '#666666',
      border: '#E0E0E0',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },
  {
    id: 'green',
    name: 'Nature Green',
    colors: {
      primary: '#27AE60',
      secondary: '#2ECC71',
      background: '#F0F8F4',
      card: '#FFFFFF',
      text: '#1A1A1A',
      subtext: '#666666',
      border: '#E0E0E0',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    colors: {
      primary: '#8E44AD',
      secondary: '#9B59B6',
      background: '#F8F5FA',
      card: '#FFFFFF',
      text: '#1A1A1A',
      subtext: '#666666',
      border: '#E0E0E0',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    colors: {
      primary: '#E67E22',
      secondary: '#F39C12',
      background: '#FFF8F0',
      card: '#FFFFFF',
      text: '#1A1A1A',
      subtext: '#666666',
      border: '#E0E0E0',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    colors: {
      primary: '#3498DB',
      secondary: '#2980B9',
      background: '#1A1A1A',
      card: '#2C2C2C',
      text: '#FFFFFF',
      subtext: '#AAAAAA',
      border: '#444444',
      error: '#E74C3C',
      success: '#27AE60',
      warning: '#F39C12',
    },
  },
];

// ============================================
// THEME CONTEXT
// ============================================
interface ThemeContextType {
  currentTheme: Theme;
  themes: Theme[];
  colors: Theme['colors'];
  setTheme: (themeId: string) => Promise<void>; // ← CRITICAL: Must have this function!
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================
// THEME PROVIDER
// ============================================
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]); // Default theme
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedThemeId = await AsyncStorage.getItem('selectedTheme');
      console.log('📱 Loaded saved theme ID:', savedThemeId);

      if (savedThemeId) {
        const theme = themes.find(t => t.id === savedThemeId);
        if (theme) {
          console.log('✅ Applying saved theme:', theme.name);
          setCurrentTheme(theme);
        } else {
          console.log('⚠️ Saved theme not found, using default');
        }
      } else {
        console.log('ℹ️ No saved theme, using default');
      }
    } catch (error) {
      console.error('❌ Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // SET THEME FUNCTION (CRITICAL!)
  // ============================================
  const setTheme = async (themeId: string) => {
    try {
      console.log('🎨 Setting theme to:', themeId);

      // Find the theme
      const theme = themes.find(t => t.id === themeId);

      if (!theme) {
        console.error('❌ Theme not found:', themeId);
        throw new Error('Theme not found');
      }

      // Update state
      setCurrentTheme(theme);
      console.log('✅ Theme updated in state:', theme.name);

      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem('selectedTheme', themeId);
      console.log('💾 Theme saved to AsyncStorage');

    } catch (error) {
      console.error('❌ Error setting theme:', error);
      throw error;
    }
  };

  // Don't render until theme is loaded
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themes,
        colors: currentTheme.colors,
        setTheme, // ← CRITICAL: Export this function!
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================
// USE THEME HOOK
// ============================================
export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
