// src/theme/spacing.ts
// 간격/레이아웃 시스템 정의

import { scale, verticalScale, responsive, deviceInfo } from '../utils/responsive';

// Base spacing values
export const baseSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

// Responsive spacing
export const spacing = {
  xs: scale(baseSpacing.xs),
  sm: scale(baseSpacing.sm),
  md: scale(baseSpacing.md),
  lg: scale(baseSpacing.lg),
  xl: scale(baseSpacing.xl),
  xxl: scale(baseSpacing.xxl),
  xxxl: scale(baseSpacing.xxxl),
} as const;

// Vertical spacing (for margins between sections)
export const verticalSpacing = {
  xs: verticalScale(baseSpacing.xs),
  sm: verticalScale(baseSpacing.sm),
  md: verticalScale(baseSpacing.md),
  lg: verticalScale(baseSpacing.lg),
  xl: verticalScale(baseSpacing.xl),
  xxl: verticalScale(baseSpacing.xxl),
  xxxl: verticalScale(baseSpacing.xxxl),
} as const;

// Container padding/margins
export const container = {
  padding: responsive({
    small: spacing.md,
    medium: spacing.lg,
    large: spacing.xl,
    tablet: spacing.xxl,
    default: spacing.lg,
  }),
  margin: responsive({
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
    tablet: spacing.xl,
    default: spacing.md,
  }),
  maxWidth: responsive({
    small: deviceInfo.width - (spacing.md * 2),
    medium: deviceInfo.width - (spacing.lg * 2),
    large: deviceInfo.width - (spacing.xl * 2),
    tablet: Math.min(800, deviceInfo.width - (spacing.xxl * 2)),
    default: deviceInfo.width - (spacing.lg * 2),
  }),
} as const;

// Card spacing
export const card = {
  padding: {
    horizontal: spacing.md,
    vertical: spacing.md,
  },
  margin: {
    horizontal: spacing.sm,
    vertical: spacing.sm,
  },
  gap: spacing.md,
  borderRadius: responsive({
    small: scale(8),
    medium: scale(12),
    large: scale(16),
    tablet: scale(20),
    default: scale(12),
  }),
} as const;

// Button spacing
export const button = {
  padding: {
    small: {
      horizontal: spacing.sm,
      vertical: spacing.xs,
    },
    medium: {
      horizontal: spacing.md,
      vertical: spacing.sm,
    },
    large: {
      horizontal: spacing.lg,
      vertical: spacing.md,
    },
  },
  margin: spacing.sm,
  gap: spacing.sm,
  borderRadius: responsive({
    small: scale(6),
    medium: scale(8),
    large: scale(10),
    tablet: scale(12),
    default: scale(8),
  }),
  height: {
    small: scale(32),
    medium: scale(44),
    large: scale(52),
  },
} as const;

// Input field spacing
export const input = {
  padding: {
    horizontal: spacing.md,
    vertical: responsive({
      small: spacing.sm,
      medium: spacing.md,
      large: spacing.md,
      tablet: spacing.lg,
      default: spacing.md,
    }),
  },
  margin: spacing.sm,
  borderRadius: responsive({
    small: scale(6),
    medium: scale(8),
    large: scale(10),
    tablet: scale(12),
    default: scale(8),
  }),
  height: responsive({
    small: scale(40),
    medium: scale(44),
    large: scale(48),
    tablet: scale(52),
    default: scale(44),
  }),
} as const;

// List item spacing
export const listItem = {
  padding: {
    horizontal: spacing.md,
    vertical: spacing.md,
  },
  margin: {
    horizontal: 0,
    vertical: spacing.xs,
  },
  gap: spacing.sm,
  minHeight: scale(56),
} as const;

// Section spacing
export const section = {
  padding: {
    horizontal: container.padding,
    vertical: verticalSpacing.lg,
  },
  margin: {
    bottom: verticalSpacing.xl,
  },
  gap: verticalSpacing.md,
} as const;

// Header spacing
export const header = {
  height: responsive({
    small: scale(56),
    medium: scale(60),
    large: scale(64),
    tablet: scale(72),
    default: scale(60),
  }),
  padding: {
    horizontal: spacing.md,
    vertical: spacing.sm,
  },
  titleMargin: spacing.sm,
} as const;

// Navigation spacing
export const navigation = {
  tabBar: {
    height: responsive({
      small: scale(60),
      medium: scale(65),
      large: scale(70),
      tablet: scale(75),
      default: scale(65),
    }),
    padding: spacing.sm,
  },
  drawer: {
    width: responsive({
      small: deviceInfo.width * 0.8,
      medium: deviceInfo.width * 0.75,
      large: deviceInfo.width * 0.7,
      tablet: 320,
      default: deviceInfo.width * 0.75,
    }),
    itemPadding: {
      horizontal: spacing.lg,
      vertical: spacing.md,
    },
  },
} as const;

// Modal spacing
export const modal = {
  padding: spacing.lg,
  margin: spacing.md,
  borderRadius: responsive({
    small: scale(12),
    medium: scale(16),
    large: scale(20),
    tablet: scale(24),
    default: scale(16),
  }),
  backdrop: {
    padding: spacing.md,
  },
} as const;

// Grid/Flex layout
export const layout = {
  gap: {
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  },
  columns: {
    2: {
      gap: spacing.sm,
      itemWidth: (deviceInfo.width - container.padding * 2 - spacing.sm) / 2,
    },
    3: {
      gap: spacing.xs,
      itemWidth: (deviceInfo.width - container.padding * 2 - spacing.xs * 2) / 3,
    },
  },
} as const;

// Language learning specific spacing
export const learning = {
  vocabCard: {
    padding: spacing.lg,
    margin: spacing.md,
    gap: spacing.md,
    borderRadius: card.borderRadius,
    minHeight: scale(120),
  },
  quiz: {
    questionPadding: spacing.xl,
    answerPadding: spacing.lg,
    buttonGap: spacing.md,
    progressMargin: spacing.sm,
  },
  lesson: {
    headerPadding: spacing.lg,
    contentPadding: spacing.md,
    sectionGap: verticalSpacing.lg,
  },
  progress: {
    barHeight: scale(8),
    barMargin: spacing.sm,
    labelGap: spacing.xs,
  },
} as const;

// Safe area adjustments
export const safeArea = {
  top: deviceInfo.hasNotch ? (deviceInfo.isIOS ? 44 : 24) : 20,
  bottom: deviceInfo.hasNotch ? (deviceInfo.isIOS ? 34 : 0) : 0,
  horizontal: 0,
} as const;

// Screen padding (includes safe area)
export const screen = {
  padding: {
    horizontal: container.padding,
    vertical: spacing.md,
  },
  paddingWithSafeArea: {
    horizontal: container.padding,
    top: safeArea.top + spacing.md,
    bottom: safeArea.bottom + spacing.md,
  },
} as const;

// Common layout patterns
export const patterns = {
  // Center content both horizontally and vertically
  centerAll: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: container.padding,
  },
  
  // Standard screen layout
  screenContainer: {
    flex: 1,
    paddingHorizontal: screen.padding.horizontal,
    paddingTop: screen.paddingWithSafeArea.top,
    paddingBottom: screen.paddingWithSafeArea.bottom,
  },
  
  // Card container
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: card.borderRadius,
    padding: card.padding.horizontal,
    marginHorizontal: card.margin.horizontal,
    marginVertical: card.margin.vertical,
  },
  
  // Form container
  formContainer: {
    padding: container.padding,
    gap: spacing.lg,
  },
  
  // List container
  listContainer: {
    paddingHorizontal: container.padding,
    paddingVertical: spacing.md,
  },
  
  // Row layout with gap
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  
  // Column layout with gap
  column: {
    flexDirection: 'column' as const,
    gap: spacing.md,
  },
} as const;

// Utility functions
export const createSpacing = (multiplier: number) => ({
  xs: spacing.xs * multiplier,
  sm: spacing.sm * multiplier,
  md: spacing.md * multiplier,
  lg: spacing.lg * multiplier,
  xl: spacing.xl * multiplier,
  xxl: spacing.xxl * multiplier,
  xxxl: spacing.xxxl * multiplier,
});

export const getSpacing = (size: keyof typeof spacing) => spacing[size];

export const getVerticalSpacing = (size: keyof typeof verticalSpacing) => verticalSpacing[size];

// Helper for creating consistent margins
export const margins = (
  top?: keyof typeof spacing,
  right?: keyof typeof spacing,
  bottom?: keyof typeof spacing,
  left?: keyof typeof spacing
) => ({
  marginTop: top ? spacing[top] : 0,
  marginRight: right ? spacing[right] : 0,
  marginBottom: bottom ? spacing[bottom] : 0,
  marginLeft: left ? spacing[left] : 0,
});

// Helper for creating consistent paddings
export const paddings = (
  top?: keyof typeof spacing,
  right?: keyof typeof spacing,
  bottom?: keyof typeof spacing,
  left?: keyof typeof spacing
) => ({
  paddingTop: top ? spacing[top] : 0,
  paddingRight: right ? spacing[right] : 0,
  paddingBottom: bottom ? spacing[bottom] : 0,
  paddingLeft: left ? spacing[left] : 0,
});

// Edge insets helper (for safe area)
export const insets = {
  screen: {
    top: safeArea.top,
    right: 0,
    bottom: safeArea.bottom,
    left: 0,
  },
  modal: {
    top: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    left: spacing.lg,
  },
};

// Export default spacing object
export default {
  spacing,
  verticalSpacing,
  container,
  card,
  button,
  input,
  listItem,
  section,
  header,
  navigation,
  modal,
  layout,
  learning,
  safeArea,
  screen,
  patterns,
  createSpacing,
  getSpacing,
  getVerticalSpacing,
  margins,
  paddings,
  insets,
};