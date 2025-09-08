// src/theme/variants.ts
// 컴포넌트 스타일 변형 정의

import { StyleSheet } from 'react-native';
import { colors, lightColors, darkColors } from './colors';
import { typography } from './typography';
import { spacing, button, input, card } from './spacing';
import { scale } from '../utils/responsive';

export type ThemeMode = 'light' | 'dark';
export type ComponentSize = 'small' | 'medium' | 'large';
export type ComponentVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'ghost' | 'outline';

// Button variants
export const createButtonVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseButton = {
    borderRadius: button.borderRadius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
  };

  const sizes = {
    small: {
      ...baseButton,
      height: button.height.small,
      paddingHorizontal: button.padding.small.horizontal,
      paddingVertical: button.padding.small.vertical,
    },
    medium: {
      ...baseButton,
      height: button.height.medium,
      paddingHorizontal: button.padding.medium.horizontal,
      paddingVertical: button.padding.medium.vertical,
    },
    large: {
      ...baseButton,
      height: button.height.large,
      paddingHorizontal: button.padding.large.horizontal,
      paddingVertical: button.padding.large.vertical,
    },
  };

  const variants = {
    primary: {
      backgroundColor: themeColors.primary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: themeColors.secondary,
      borderWidth: 0,
    },
    success: {
      backgroundColor: themeColors.success,
      borderWidth: 0,
    },
    warning: {
      backgroundColor: themeColors.warning,
      borderWidth: 0,
    },
    error: {
      backgroundColor: themeColors.error,
      borderWidth: 0,
    },
    info: {
      backgroundColor: themeColors.info,
      borderWidth: 0,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  };

  return { sizes, variants };
};

// Input variants
export const createInputVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseInput = {
    borderRadius: input.borderRadius,
    paddingHorizontal: input.padding.horizontal,
    paddingVertical: input.padding.vertical,
    fontSize: typography.input.fontSize,
    fontFamily: typography.input.fontFamily,
    color: themeColors.text,
  };

  const variants = {
    default: {
      ...baseInput,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    filled: {
      ...baseInput,
      backgroundColor: themeColors.backgroundSecondary,
      borderWidth: 0,
    },
    underlined: {
      ...baseInput,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      borderRadius: 0,
      paddingHorizontal: 0,
    },
    error: {
      ...baseInput,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.error,
    },
    success: {
      ...baseInput,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.success,
    },
  };

  const states = {
    focused: {
      borderColor: themeColors.primary,
      borderWidth: 2,
    },
    disabled: {
      backgroundColor: themeColors.backgroundTertiary,
      borderColor: themeColors.borderLight,
      color: themeColors.textDisabled,
    },
  };

  return { variants, states };
};

// Card variants
export const createCardVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseCard = {
    borderRadius: card.borderRadius,
    padding: card.padding.horizontal,
  };

  const variants = {
    default: {
      ...baseCard,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    elevated: {
      ...baseCard,
      backgroundColor: themeColors.surface,
      shadowColor: themeColors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    outlined: {
      ...baseCard,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    filled: {
      ...baseCard,
      backgroundColor: themeColors.backgroundSecondary,
      borderWidth: 0,
    },
    gradient: {
      ...baseCard,
      borderWidth: 0,
      // Gradient will be applied using LinearGradient component
    },
  };

  const specialCards = {
    vocabCard: {
      ...variants.elevated,
      padding: spacing.lg,
      minHeight: scale(120),
    },
    quizCard: {
      ...variants.elevated,
      padding: spacing.xl,
      alignItems: 'center' as const,
    },
    progressCard: {
      ...variants.default,
      padding: spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
  };

  return { variants, specialCards };
};

// Text variants
export const createTextVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const variants = {
    primary: {
      color: themeColors.text,
    },
    secondary: {
      color: themeColors.textSecondary,
    },
    tertiary: {
      color: themeColors.textTertiary,
    },
    inverse: {
      color: themeColors.textInverse,
    },
    disabled: {
      color: themeColors.textDisabled,
    },
    error: {
      color: themeColors.error,
    },
    success: {
      color: themeColors.success,
    },
    warning: {
      color: themeColors.warning,
    },
    info: {
      color: themeColors.info,
    },
    link: {
      color: themeColors.link,
      textDecorationLine: 'underline' as const,
    },
  };

  return variants;
};

// Badge variants
export const createBadgeVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseBadge = {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: scale(12),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: scale(24),
    minHeight: scale(24),
  };

  const variants = {
    primary: {
      ...baseBadge,
      backgroundColor: themeColors.primary,
    },
    secondary: {
      ...baseBadge,
      backgroundColor: themeColors.secondary,
    },
    success: {
      ...baseBadge,
      backgroundColor: themeColors.success,
    },
    warning: {
      ...baseBadge,
      backgroundColor: themeColors.warning,
    },
    error: {
      ...baseBadge,
      backgroundColor: themeColors.error,
    },
    info: {
      ...baseBadge,
      backgroundColor: themeColors.info,
    },
    outline: {
      ...baseBadge,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    dot: {
      width: scale(8),
      height: scale(8),
      borderRadius: scale(4),
      backgroundColor: themeColors.error,
      padding: 0,
      minWidth: 0,
      minHeight: 0,
    },
  };

  const sizes = {
    small: {
      paddingHorizontal: spacing.xs,
      paddingVertical: scale(2),
      minHeight: scale(16),
    },
    medium: baseBadge,
    large: {
      ...baseBadge,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: scale(32),
    },
  };

  return { variants, sizes };
};

// Avatar variants
export const createAvatarVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseAvatar = {
    borderRadius: scale(25),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: themeColors.backgroundSecondary,
  };

  const sizes = {
    small: {
      ...baseAvatar,
      width: scale(32),
      height: scale(32),
      borderRadius: scale(16),
    },
    medium: {
      ...baseAvatar,
      width: scale(50),
      height: scale(50),
    },
    large: {
      ...baseAvatar,
      width: scale(80),
      height: scale(80),
      borderRadius: scale(40),
    },
    xlarge: {
      ...baseAvatar,
      width: scale(120),
      height: scale(120),
      borderRadius: scale(60),
    },
  };

  return { sizes };
};

// Alert variants
export const createAlertVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const baseAlert = {
    padding: spacing.md,
    borderRadius: scale(8),
    borderLeftWidth: 4,
    marginVertical: spacing.sm,
  };

  const variants = {
    info: {
      ...baseAlert,
      backgroundColor: themeColors.infoLight,
      borderLeftColor: themeColors.info,
    },
    success: {
      ...baseAlert,
      backgroundColor: themeColors.successLight,
      borderLeftColor: themeColors.success,
    },
    warning: {
      ...baseAlert,
      backgroundColor: themeColors.warningLight,
      borderLeftColor: themeColors.warning,
    },
    error: {
      ...baseAlert,
      backgroundColor: themeColors.errorLight,
      borderLeftColor: themeColors.error,
    },
  };

  return variants;
};

// Language learning specific variants
export const createLearningVariants = (theme: ThemeMode = 'light') => {
  const themeColors = theme === 'light' ? lightColors : darkColors;
  
  const cefrLevelCards = {
    A1: {
      backgroundColor: themeColors.level.A1,
      borderColor: themeColors.level.A1,
    },
    A2: {
      backgroundColor: themeColors.level.A2,
      borderColor: themeColors.level.A2,
    },
    B1: {
      backgroundColor: themeColors.level.B1,
      borderColor: themeColors.level.B1,
    },
    B2: {
      backgroundColor: themeColors.level.B2,
      borderColor: themeColors.level.B2,
    },
    C1: {
      backgroundColor: themeColors.level.C1,
      borderColor: themeColors.level.C1,
    },
    C2: {
      backgroundColor: themeColors.level.C2,
      borderColor: themeColors.level.C2,
    },
  };

  const masteryStates = {
    new: {
      backgroundColor: themeColors.backgroundSecondary,
      borderColor: themeColors.border,
    },
    learning: {
      backgroundColor: themeColors.warningLight,
      borderColor: themeColors.warning,
    },
    reviewing: {
      backgroundColor: themeColors.infoLight,
      borderColor: themeColors.info,
    },
    mastered: {
      backgroundColor: themeColors.successLight,
      borderColor: themeColors.success,
    },
    burned: {
      backgroundColor: themeColors.backgroundTertiary,
      borderColor: themeColors.textTertiary,
    },
  };

  const answerButtons = {
    correct: {
      backgroundColor: themeColors.success,
      borderColor: themeColors.success,
    },
    incorrect: {
      backgroundColor: themeColors.error,
      borderColor: themeColors.error,
    },
    skip: {
      backgroundColor: themeColors.backgroundSecondary,
      borderColor: themeColors.border,
    },
  };

  return {
    cefrLevelCards,
    masteryStates,
    answerButtons,
  };
};

// Export all variant creators
export const variants = {
  createButtonVariants,
  createInputVariants,
  createCardVariants,
  createTextVariants,
  createBadgeVariants,
  createAvatarVariants,
  createAlertVariants,
  createLearningVariants,
};

// Create default variants for light theme
export const lightVariants = {
  button: createButtonVariants('light'),
  input: createInputVariants('light'),
  card: createCardVariants('light'),
  text: createTextVariants('light'),
  badge: createBadgeVariants('light'),
  avatar: createAvatarVariants('light'),
  alert: createAlertVariants('light'),
  learning: createLearningVariants('light'),
};

// Create default variants for dark theme
export const darkVariants = {
  button: createButtonVariants('dark'),
  input: createInputVariants('dark'),
  card: createCardVariants('dark'),
  text: createTextVariants('dark'),
  badge: createBadgeVariants('dark'),
  avatar: createAvatarVariants('dark'),
  alert: createAlertVariants('dark'),
  learning: createLearningVariants('dark'),
};

// Utility function to get component variant
export const getVariant = (
  component: keyof typeof lightVariants,
  variant: string,
  size?: string,
  theme: ThemeMode = 'light'
) => {
  const themeVariants = theme === 'light' ? lightVariants : darkVariants;
  const componentVariants = themeVariants[component];
  
  if (!componentVariants) return {};
  
  // @ts-ignore - Dynamic access is necessary here
  const variantStyles = componentVariants.variants?.[variant] || {};
  // @ts-ignore - Dynamic access is necessary here
  const sizeStyles = size && componentVariants.sizes?.[size] || {};
  
  return {
    ...variantStyles,
    ...sizeStyles,
  };
};

// Export default
export default variants;