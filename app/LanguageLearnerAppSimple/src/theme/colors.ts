// src/theme/colors.ts
// 색상 시스템 정의

export interface ColorPalette {
  primary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  secondary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  success: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  warning: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  error: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  info: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

export interface Colors {
  // Brand Colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  // Status Colors
  success: string;
  successLight: string;
  successDark: string;
  warning: string;
  warningLight: string;
  warningDark: string;
  error: string;
  errorLight: string;
  errorDark: string;
  info: string;
  infoLight: string;
  infoDark: string;

  // Background Colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceSecondary: string;
  overlay: string;

  // Text Colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textDisabled: string;

  // Border Colors
  border: string;
  borderLight: string;
  borderDark: string;
  divider: string;

  // Interactive Colors
  interactive: string;
  interactiveHover: string;
  interactiveActive: string;
  interactiveDisabled: string;

  // Semantic Colors
  link: string;
  linkHover: string;
  shadow: string;

  // Special Colors (for language learning app)
  correct: string;
  incorrect: string;
  mastery: string;
  streak: string;
  level: {
    A1: string;
    A2: string;
    B1: string;
    B2: string;
    C1: string;
    C2: string;
  };
}

// Color Palettes
export const palette: ColorPalette = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fecaca',
    200: '#fca5a5',
    300: '#f87171',
    400: '#f56565',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
};

// Light Theme Colors
export const lightColors: Colors = {
  // Brand Colors
  primary: palette.primary[600],
  primaryLight: palette.primary[400],
  primaryDark: palette.primary[700],
  secondary: palette.secondary[600],
  secondaryLight: palette.secondary[400],
  secondaryDark: palette.secondary[700],

  // Status Colors
  success: palette.success[600],
  successLight: palette.success[100],
  successDark: palette.success[700],
  warning: palette.warning[500],
  warningLight: palette.warning[100],
  warningDark: palette.warning[700],
  error: palette.error[500],
  errorLight: palette.error[100],
  errorDark: palette.error[700],
  info: palette.info[500],
  infoLight: palette.info[100],
  infoDark: palette.info[700],

  // Background Colors
  background: '#ffffff',
  backgroundSecondary: palette.gray[50],
  backgroundTertiary: palette.gray[100],
  surface: '#ffffff',
  surfaceSecondary: palette.gray[50],
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Text Colors
  text: palette.gray[900],
  textSecondary: palette.gray[600],
  textTertiary: palette.gray[400],
  textInverse: '#ffffff',
  textDisabled: palette.gray[400],

  // Border Colors
  border: palette.gray[200],
  borderLight: palette.gray[100],
  borderDark: palette.gray[300],
  divider: palette.gray[200],

  // Interactive Colors
  interactive: palette.primary[600],
  interactiveHover: palette.primary[700],
  interactiveActive: palette.primary[800],
  interactiveDisabled: palette.gray[300],

  // Semantic Colors
  link: palette.primary[600],
  linkHover: palette.primary[700],
  shadow: 'rgba(0, 0, 0, 0.1)',

  // Special Colors (Language Learning)
  correct: palette.success[500],
  incorrect: palette.error[500],
  mastery: '#8b5cf6', // Purple
  streak: '#f59e0b', // Amber
  level: {
    A1: palette.error[500], // Red
    A2: palette.warning[500], // Orange
    B1: palette.success[500], // Green
    B2: palette.info[500], // Blue
    C1: palette.primary[600], // Blue
    C2: palette.gray[800], // Dark
  },
};

// Dark Theme Colors
export const darkColors: Colors = {
  // Brand Colors
  primary: palette.primary[400],
  primaryLight: palette.primary[300],
  primaryDark: palette.primary[500],
  secondary: palette.secondary[400],
  secondaryLight: palette.secondary[300],
  secondaryDark: palette.secondary[500],

  // Status Colors
  success: palette.success[400],
  successLight: palette.success[900],
  successDark: palette.success[300],
  warning: palette.warning[400],
  warningLight: palette.warning[900],
  warningDark: palette.warning[300],
  error: palette.error[400],
  errorLight: palette.error[900],
  errorDark: palette.error[300],
  info: palette.info[400],
  infoLight: palette.info[900],
  infoDark: palette.info[300],

  // Background Colors
  background: '#000000',
  backgroundSecondary: palette.gray[900],
  backgroundTertiary: palette.gray[800],
  surface: palette.gray[900],
  surfaceSecondary: palette.gray[800],
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Text Colors
  text: '#ffffff',
  textSecondary: palette.gray[300],
  textTertiary: palette.gray[500],
  textInverse: palette.gray[900],
  textDisabled: palette.gray[600],

  // Border Colors
  border: palette.gray[700],
  borderLight: palette.gray[800],
  borderDark: palette.gray[600],
  divider: palette.gray[700],

  // Interactive Colors
  interactive: palette.primary[400],
  interactiveHover: palette.primary[300],
  interactiveActive: palette.primary[200],
  interactiveDisabled: palette.gray[700],

  // Semantic Colors
  link: palette.primary[400],
  linkHover: palette.primary[300],
  shadow: 'rgba(0, 0, 0, 0.3)',

  // Special Colors (Language Learning)
  correct: palette.success[400],
  incorrect: palette.error[400],
  mastery: '#a78bfa', // Light Purple
  streak: '#fbbf24', // Light Amber
  level: {
    A1: palette.error[400], // Light Red
    A2: palette.warning[400], // Light Orange
    B1: palette.success[400], // Light Green
    B2: palette.info[400], // Light Blue
    C1: palette.primary[400], // Light Blue
    C2: palette.gray[300], // Light Gray
  },
};

// Default export
export const colors = lightColors;

// Helper functions
export const getColorWithOpacity = (color: string, opacity: number): string => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/g, `${opacity})`);
  }
  return color;
};

export const getCefrColor = (level: string, theme: 'light' | 'dark' = 'light'): string => {
  const colors = theme === 'light' ? lightColors : darkColors;
  return colors.level[level as keyof typeof colors.level] || colors.textSecondary;
};

export const getStatusColor = (
  status: 'success' | 'warning' | 'error' | 'info',
  theme: 'light' | 'dark' = 'light'
): string => {
  const colors = theme === 'light' ? lightColors : darkColors;
  return colors[status];
};