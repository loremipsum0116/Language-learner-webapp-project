// src/theme/typography.ts
// 타이포그래피 시스템 정의

import { Platform } from 'react-native';
import { fontScale } from '../utils/responsive';

// Font families
export const fontFamily = {
  // System fonts
  system: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  
  // Korean support
  korean: Platform.select({
    ios: 'Apple SD Gothic Neo',
    android: 'NotoSansCJK',
    default: 'System',
  }),
  
  // Monospace
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Courier New',
  }),
  
  // Optional custom fonts (add when needed)
  primary: Platform.select({
    ios: 'SF Pro Display',
    android: 'Roboto',
    default: 'System',
  }),
  
  secondary: Platform.select({
    ios: 'SF Pro Text',
    android: 'Roboto',
    default: 'System',
  }),
} as const;

// Font weights
export const fontWeight = {
  thin: '100',
  extraLight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
  black: '900',
} as const;

// Line heights (relative to font size)
export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1,
} as const;

// Typography scale interface
export interface TypographyVariant {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
  fontFamily: string;
  letterSpacing?: number;
}

// Typography variants
export const typography = {
  // Display styles (for hero sections, landing pages)
  display1: {
    fontSize: fontScale(36),
    lineHeight: fontScale(44),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.tight,
  } as TypographyVariant,

  display2: {
    fontSize: fontScale(32),
    lineHeight: fontScale(40),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.tight,
  } as TypographyVariant,

  display3: {
    fontSize: fontScale(28),
    lineHeight: fontScale(36),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Heading styles
  h1: {
    fontSize: fontScale(24),
    lineHeight: fontScale(32),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  h2: {
    fontSize: fontScale(20),
    lineHeight: fontScale(28),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  h3: {
    fontSize: fontScale(18),
    lineHeight: fontScale(24),
    fontWeight: fontWeight.semiBold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  h4: {
    fontSize: fontScale(16),
    lineHeight: fontScale(22),
    fontWeight: fontWeight.semiBold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  h5: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.semiBold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  h6: {
    fontSize: fontScale(12),
    lineHeight: fontScale(18),
    fontWeight: fontWeight.semiBold,
    fontFamily: fontFamily.primary,
    letterSpacing: letterSpacing.wide,
  } as TypographyVariant,

  // Body text styles
  body1: {
    fontSize: fontScale(16),
    lineHeight: fontScale(24),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  body2: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  body3: {
    fontSize: fontScale(12),
    lineHeight: fontScale(18),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Subtitle styles
  subtitle1: {
    fontSize: fontScale(16),
    lineHeight: fontScale(22),
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  subtitle2: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Caption and overline
  caption: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.wide,
  } as TypographyVariant,

  overline: {
    fontSize: fontScale(10),
    lineHeight: fontScale(16),
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.widest,
  } as TypographyVariant,

  // Button text
  button: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.semiBold,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.wide,
  } as TypographyVariant,

  // Label text
  label: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Input text
  input: {
    fontSize: fontScale(16),
    lineHeight: fontScale(22),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Special typography for language learning app
  vocab: {
    fontSize: fontScale(20),
    lineHeight: fontScale(28),
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.system,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  pronunciation: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.mono,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  korean: {
    fontSize: fontScale(16),
    lineHeight: fontScale(24),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.korean,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  score: {
    fontSize: fontScale(24),
    lineHeight: fontScale(32),
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    letterSpacing: letterSpacing.normal,
  } as TypographyVariant,

  // Size variants
  xs: {
    fontSize: fontScale(10),
    lineHeight: fontScale(14),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,

  sm: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,

  md: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,

  lg: {
    fontSize: fontScale(16),
    lineHeight: fontScale(24),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,

  xl: {
    fontSize: fontScale(18),
    lineHeight: fontScale(26),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,

  xxl: {
    fontSize: fontScale(20),
    lineHeight: fontScale(28),
    fontWeight: fontWeight.normal,
    fontFamily: fontFamily.secondary,
  } as TypographyVariant,
} as const;

// Text style presets
export const textStyles = {
  // Default text style
  default: typography.body1,

  // Emphasis variants
  emphasis: {
    ...typography.body1,
    fontWeight: fontWeight.semiBold,
  },

  strong: {
    ...typography.body1,
    fontWeight: fontWeight.bold,
  },

  // Link style
  link: {
    ...typography.body1,
    // Color will be added via theme
  },

  // Error/success text
  error: {
    ...typography.body2,
    fontWeight: fontWeight.medium,
  },

  success: {
    ...typography.body2,
    fontWeight: fontWeight.medium,
  },

  // Placeholder text
  placeholder: {
    ...typography.body1,
    fontWeight: fontWeight.normal,
  },

  // Code text
  code: {
    ...typography.body2,
    fontFamily: fontFamily.mono,
  },
} as const;

// Helper functions
export const createTextStyle = (
  variant: keyof typeof typography,
  overrides?: Partial<TypographyVariant>
): TypographyVariant => ({
  ...typography[variant],
  ...overrides,
});

export const getTextStyle = (variant: keyof typeof typography) => typography[variant];

// Platform-specific adjustments
export const platformTypography = {
  // iOS specific adjustments
  ios: {
    // Add iOS-specific font adjustments if needed
  },
  
  // Android specific adjustments
  android: {
    // Add Android-specific font adjustments if needed
    // Android typically needs slightly larger fonts for readability
  },
};

// Font loading utilities (for custom fonts)
export const loadFonts = async () => {
  // This function would load custom fonts
  // Implementation depends on your font loading strategy
  // (react-native-vector-icons, expo-font, etc.)
  console.log('Loading custom fonts...');
};

// Export default typography object
export default typography;