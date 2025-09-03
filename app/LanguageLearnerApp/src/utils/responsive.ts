// src/utils/responsive.ts
// 반응형 스타일링 유틸리티

import { Dimensions, PixelRatio, Platform } from 'react-native';

// Device dimensions
const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro)
const baseWidth = 375;
const baseHeight = 812;

// Device types
export const deviceInfo = {
  width: deviceWidth,
  height: deviceHeight,
  isSmall: deviceWidth < 375,
  isMedium: deviceWidth >= 375 && deviceWidth < 414,
  isLarge: deviceWidth >= 414,
  isTablet: deviceWidth >= 768,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  hasNotch: deviceHeight >= 812,
  pixelRatio: PixelRatio.get(),
  fontScale: PixelRatio.getFontScale(),
};

// Screen size categories
export type ScreenSize = 'small' | 'medium' | 'large' | 'tablet';

export const getScreenSize = (): ScreenSize => {
  if (deviceInfo.isTablet) return 'tablet';
  if (deviceInfo.isLarge) return 'large';
  if (deviceInfo.isMedium) return 'medium';
  return 'small';
};

// Scaling functions
export const scale = (size: number): number => {
  const ratio = deviceWidth / baseWidth;
  return Math.round(PixelRatio.roundToNearestPixel(size * ratio));
};

export const verticalScale = (size: number): number => {
  const ratio = deviceHeight / baseHeight;
  return Math.round(PixelRatio.roundToNearestPixel(size * ratio));
};

export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor));
};

// Font scaling with accessibility support
export const fontScale = (size: number): number => {
  const scaled = moderateScale(size, 0.3);
  const maxScale = Math.min(deviceInfo.fontScale, 1.3); // Limit font scaling
  return Math.round(scaled * maxScale);
};

// Responsive spacing
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(40),
  xxxl: scale(48),
};

// Responsive border radius
export const borderRadius = {
  xs: scale(2),
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(16),
  xxl: scale(24),
  full: scale(9999),
};

// Responsive icon sizes
export const iconSize = {
  xs: scale(12),
  sm: scale(16),
  md: scale(20),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(40),
};

// Screen-specific values
export const responsive = <T>(values: {
  small?: T;
  medium?: T;
  large?: T;
  tablet?: T;
  default: T;
}): T => {
  const screenSize = getScreenSize();
  return values[screenSize] ?? values.default;
};

// Breakpoint-based responsive function
export const breakpoints = {
  xs: 0,
  sm: 375,
  md: 414,
  lg: 768,
  xl: 1024,
} as const;

export const mediaQuery = {
  up: (breakpoint: keyof typeof breakpoints) => deviceWidth >= breakpoints[breakpoint],
  down: (breakpoint: keyof typeof breakpoints) => deviceWidth < breakpoints[breakpoint],
  between: (min: keyof typeof breakpoints, max: keyof typeof breakpoints) =>
    deviceWidth >= breakpoints[min] && deviceWidth < breakpoints[max],
  only: (breakpoint: keyof typeof breakpoints) => {
    const bps = Object.keys(breakpoints) as Array<keyof typeof breakpoints>;
    const index = bps.indexOf(breakpoint);
    if (index === -1) return false;
    
    const min = breakpoints[breakpoint];
    const max = index < bps.length - 1 ? breakpoints[bps[index + 1]] : Infinity;
    
    return deviceWidth >= min && deviceWidth < max;
  },
};

// Platform-specific scaling
export const platformScale = (ios: number, android: number = ios): number => {
  return Platform.select({ ios, android }) || ios;
};

// Safe area helpers
export const safeArea = {
  top: deviceInfo.hasNotch ? (deviceInfo.isIOS ? 44 : 24) : 20,
  bottom: deviceInfo.hasNotch ? (deviceInfo.isIOS ? 34 : 0) : 0,
  horizontal: 0,
};

// Layout dimensions
export const layout = {
  window: {
    width: deviceWidth,
    height: deviceHeight,
  },
  screen: Dimensions.get('screen'),
  headerHeight: platformScale(44, 56),
  tabBarHeight: platformScale(83, 56),
  statusBarHeight: safeArea.top,
  navigationBarHeight: safeArea.bottom,
};

// Common responsive patterns
export const getResponsivePadding = (size: 'small' | 'medium' | 'large' = 'medium') => {
  const basePadding = {
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  };
  
  return responsive({
    small: basePadding.small,
    medium: basePadding[size],
    large: basePadding.large,
    tablet: spacing.xl,
    default: basePadding[size],
  });
};

export const getResponsiveMargin = (size: 'small' | 'medium' | 'large' = 'medium') => {
  const baseMargin = {
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  };
  
  return responsive({
    small: baseMargin.small,
    medium: baseMargin[size],
    large: baseMargin.large,
    tablet: spacing.xl,
    default: baseMargin[size],
  });
};

// Component-specific responsive helpers
export const cardResponsive = {
  padding: getResponsivePadding(),
  margin: getResponsiveMargin('small'),
  borderRadius: responsive({
    small: borderRadius.sm,
    medium: borderRadius.md,
    large: borderRadius.lg,
    tablet: borderRadius.xl,
    default: borderRadius.md,
  }),
};

export const buttonResponsive = {
  height: responsive({
    small: scale(40),
    medium: scale(44),
    large: scale(48),
    tablet: scale(52),
    default: scale(44),
  }),
  padding: responsive({
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
    tablet: spacing.xl,
    default: spacing.md,
  }),
  borderRadius: responsive({
    small: borderRadius.sm,
    medium: borderRadius.md,
    large: borderRadius.lg,
    tablet: borderRadius.xl,
    default: borderRadius.md,
  }),
};

export const inputResponsive = {
  height: responsive({
    small: scale(40),
    medium: scale(44),
    large: scale(48),
    tablet: scale(52),
    default: scale(44),
  }),
  padding: responsive({
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.md,
    tablet: spacing.lg,
    default: spacing.md,
  }),
  fontSize: responsive({
    small: fontScale(14),
    medium: fontScale(16),
    large: fontScale(16),
    tablet: fontScale(18),
    default: fontScale(16),
  }),
};

// Utility functions for common use cases
export const getFlexDirection = (orientation?: 'portrait' | 'landscape') => {
  const isLandscape = deviceWidth > deviceHeight;
  if (orientation === 'landscape' || isLandscape) {
    return responsive({
      small: 'column' as const,
      medium: 'row' as const,
      large: 'row' as const,
      tablet: 'row' as const,
      default: 'column' as const,
    });
  }
  return 'column' as const;
};

export const getColumns = (minItemWidth: number = 150): number => {
  return Math.floor(deviceWidth / minItemWidth);
};

export const getGridItemWidth = (columns: number, spacing: number = 16): number => {
  return (deviceWidth - spacing * (columns + 1)) / columns;
};

// Debug helpers
export const getDeviceInfo = () => ({
  ...deviceInfo,
  screenSize: getScreenSize(),
  safeArea,
  layout,
  breakpoints: Object.entries(breakpoints).map(([key, value]) => ({
    name: key,
    width: value,
    active: mediaQuery.only(key as keyof typeof breakpoints),
  })),
});

// Export default responsive object
export default {
  scale,
  verticalScale,
  moderateScale,
  fontScale,
  spacing,
  borderRadius,
  iconSize,
  responsive,
  mediaQuery,
  deviceInfo,
  getScreenSize,
  safeArea,
  layout,
  cardResponsive,
  buttonResponsive,
  inputResponsive,
  getResponsivePadding,
  getResponsiveMargin,
  getFlexDirection,
  getColumns,
  getGridItemWidth,
  getDeviceInfo,
};