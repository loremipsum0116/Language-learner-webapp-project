// src/theme/index.ts
// 테마 시스템 통합 및 내보내기

import { lightColors, darkColors, Colors, palette } from './colors';
import { typography, TypographyVariant } from './typography';
import { spacing, verticalSpacing, container, patterns } from './spacing';
import { lightVariants, darkVariants, ThemeMode } from './variants';

// Theme interface
export interface Theme {
  mode: ThemeMode;
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  variants: typeof lightVariants;
  isDark: boolean;
}

// Light theme
export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  typography,
  spacing,
  variants: lightVariants,
  isDark: false,
};

// Dark theme
export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  spacing,
  variants: darkVariants,
  isDark: true,
};

// Default theme
export const defaultTheme = lightTheme;

// Theme utilities
export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export const toggleTheme = (currentMode: ThemeMode): ThemeMode => {
  return currentMode === 'light' ? 'dark' : 'light';
};

// Re-export everything for convenience
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './variants';

// Common theme objects
export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export default defaultTheme;