export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const THEMES: { [key: string]: Theme } = {
  // DARK/MEDIUM THEMES
  maternal: {
    id: 'maternal',
    name: 'Maternal Pink',
    description: 'Warm and nurturing',
    colors: {
      primary: '#f093fb',
      secondary: '#f5576c',
      background: '#1a1a2e',
      card: '#16213e',
      text: '#eaeaea',
      subtext: '#a0a0a0',
      border: '#2a2a3e',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
  },
  
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Calm and professional',
    colors: {
      primary: '#4facfe',
      secondary: '#00f2fe',
      background: '#0f2027',
      card: '#203a43',
      text: '#eaeaea',
      subtext: '#a0a0a0',
      border: '#2c5364',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#43e8d8',
    },
  },

  lavender: {
    id: 'lavender',
    name: 'Soft Lavender',
    description: 'Elegant and calming',
    colors: {
      primary: '#a29bfe',
      secondary: '#6c5ce7',
      background: '#1e1e30',
      card: '#2d2d44',
      text: '#eaeaea',
      subtext: '#a0a0a0',
      border: '#3a3a52',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#fd79a8',
    },
  },

  // LIGHT/BRIGHT THEMES
  peach: {
    id: 'peach',
    name: 'Peach Cream',
    description: 'Soft and warm',
    colors: {
      primary: '#ff6b9d',
      secondary: '#ffa06b',
      background: '#fff5f0',
      card: '#ffffff',
      text: '#2d2d2d',
      subtext: '#666666',
      border: '#f0e0d6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#ff8fa3',
    },
  },

  mint: {
    id: 'mint',
    name: 'Mint Fresh',
    description: 'Clean and refreshing',
    colors: {
      primary: '#00d2a0',
      secondary: '#5ce1a5',
      background: '#f0fdf9',
      card: '#ffffff',
      text: '#1a1a1a',
      subtext: '#666666',
      border: '#d1f4e8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#00c9a7',
    },
  },
};

export const DEFAULT_THEME = 'maternal';

export type ThemeId = keyof typeof THEMES;