// src/theme/components.ts
// 컴포넌트별 테마 스타일 정의

import { Theme } from './index';
import { scale } from '../utils/responsive';

// 공통 컴포넌트 스타일 생성 함수들
export const createCommonStyles = (theme: Theme) => {
  const { colors, typography, spacing } = theme;

  return {
    // Container styles
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    
    safeContainer: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: spacing.safeArea.top,
      paddingBottom: spacing.safeArea.bottom,
    },
    
    screenContainer: {
      ...spacing.patterns.screenContainer,
      backgroundColor: colors.background,
    },
    
    centerContainer: {
      ...spacing.patterns.centerAll,
      backgroundColor: colors.background,
    },

    // Card styles
    card: {
      ...spacing.patterns.cardContainer,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    
    elevatedCard: {
      backgroundColor: colors.surface,
      borderRadius: spacing.card.borderRadius,
      padding: spacing.card.padding.horizontal,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },

    // Text styles
    heading: {
      ...typography.h1,
      color: colors.text,
    },
    
    subheading: {
      ...typography.h2,
      color: colors.text,
    },
    
    bodyText: {
      ...typography.body1,
      color: colors.text,
    },
    
    captionText: {
      ...typography.caption,
      color: colors.textSecondary,
    },

    // Button styles
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: spacing.button.borderRadius,
      paddingHorizontal: spacing.button.padding.medium.horizontal,
      paddingVertical: spacing.button.padding.medium.vertical,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: spacing.button.height.medium,
    },
    
    primaryButtonText: {
      ...typography.button,
      color: colors.textInverse,
    },
    
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.button.borderRadius,
      paddingHorizontal: spacing.button.padding.medium.horizontal,
      paddingVertical: spacing.button.padding.medium.vertical,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: spacing.button.height.medium,
    },
    
    secondaryButtonText: {
      ...typography.button,
      color: colors.primary,
    },

    // Input styles
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.input.borderRadius,
      paddingHorizontal: spacing.input.padding.horizontal,
      paddingVertical: spacing.input.padding.vertical,
      fontSize: typography.input.fontSize,
      fontFamily: typography.input.fontFamily,
      color: colors.text,
      minHeight: spacing.input.height,
    },
    
    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    
    inputError: {
      borderColor: colors.error,
    },

    // List styles
    listItem: {
      backgroundColor: colors.surface,
      padding: spacing.listItem.padding.horizontal,
      marginVertical: spacing.listItem.margin.vertical,
      borderRadius: scale(8),
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    
    listItemPressed: {
      backgroundColor: colors.backgroundSecondary,
    },

    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: spacing.modal.padding,
    },
    
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: spacing.modal.borderRadius,
      padding: spacing.modal.padding,
      width: '90%',
      maxWidth: 400,
    },
    
    modalHeader: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingBottom: spacing.md,
      marginBottom: spacing.lg,
    },
    
    modalTitle: {
      ...typography.h3,
      color: colors.text,
      textAlign: 'center' as const,
    },

    // Loading styles
    loadingContainer: {
      ...spacing.patterns.centerAll,
      backgroundColor: colors.background,
    },
    
    loadingText: {
      ...typography.body1,
      color: colors.textSecondary,
      marginTop: spacing.md,
      textAlign: 'center' as const,
    },

    // Error styles
    errorContainer: {
      backgroundColor: colors.errorLight,
      padding: spacing.md,
      borderRadius: scale(8),
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
      margin: spacing.sm,
    },
    
    errorText: {
      ...typography.body2,
      color: colors.error,
    },

    // Success styles
    successContainer: {
      backgroundColor: colors.successLight,
      padding: spacing.md,
      borderRadius: scale(8),
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      margin: spacing.sm,
    },
    
    successText: {
      ...typography.body2,
      color: colors.success,
    },

    // Separator
    separator: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: spacing.md,
    },
    
    // Badge styles
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: scale(12),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    
    badgeText: {
      ...typography.caption,
      color: colors.textInverse,
      fontWeight: typography.fontWeight.medium,
    },

    // Tab styles
    tabBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      height: spacing.navigation.tabBar.height,
      paddingBottom: spacing.safeArea.bottom,
    },
    
    tabItem: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: spacing.sm,
    },
    
    tabLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    
    tabLabelActive: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: typography.fontWeight.semiBold,
    },

    // Header styles
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.header.padding.horizontal,
      paddingVertical: spacing.header.padding.vertical,
      height: spacing.header.height,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    
    headerTitle: {
      ...typography.h3,
      color: colors.text,
    },
    
    headerButton: {
      padding: spacing.sm,
      borderRadius: scale(8),
    },
    
    headerButtonPressed: {
      backgroundColor: colors.backgroundSecondary,
    },
  };
};

// Export default styles creator
export default createCommonStyles;