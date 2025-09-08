// src/components/common/Button.tsx
// 공통 버튼 컴포넌트

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { ButtonProps } from '../../types';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { ComponentSize, ComponentVariant } from '../../theme/variants';

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const buttonStyle = [
    styles.button,
    styles[size],
    styles[variant],
    disabled && styles.disabled,
    style
  ] as ViewStyle[];

  const textStyle = [
    styles.text,
    styles[`${size}Text` as keyof typeof styles],
    styles[`${variant}Text` as keyof typeof styles],
    disabled && styles.disabledText
  ] as TextStyle[];

  const getLoadingColor = () => {
    if (disabled) return colors.textDisabled;
    if (variant === 'secondary' || variant === 'ghost' || variant === 'outline') {
      return colors.primary;
    }
    return colors.textInverse;
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={getLoadingColor()}
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => {
  const { colors, variants, typography, spacing } = theme;
  const buttonVariants = variants.button;

  return {
    button: {
      ...buttonVariants.sizes.medium,
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    
    // Sizes
    small: buttonVariants.sizes.small,
    medium: buttonVariants.sizes.medium,
    large: buttonVariants.sizes.large,
    
    // Variants
    primary: buttonVariants.variants.primary,
    secondary: buttonVariants.variants.secondary,
    success: buttonVariants.variants.success,
    error: buttonVariants.variants.error,
    warning: buttonVariants.variants.warning,
    info: buttonVariants.variants.info,
    outline: buttonVariants.variants.outline,
    ghost: buttonVariants.variants.ghost,
    
    // Disabled state
    disabled: {
      backgroundColor: colors.interactiveDisabled,
      borderColor: colors.interactiveDisabled,
      opacity: 0.6,
    },
    
    // Text styles
    text: {
      ...typography.button,
      textAlign: 'center' as const,
    },
    
    // Text sizes
    smallText: {
      fontSize: typography.sm.fontSize,
      lineHeight: typography.sm.lineHeight,
    },
    mediumText: {
      fontSize: typography.button.fontSize,
      lineHeight: typography.button.lineHeight,
    },
    largeText: {
      fontSize: typography.md.fontSize,
      lineHeight: typography.md.lineHeight,
    },
    
    // Text variants
    primaryText: {
      color: colors.textInverse,
    },
    secondaryText: {
      color: colors.textInverse,
    },
    successText: {
      color: colors.textInverse,
    },
    errorText: {
      color: colors.textInverse,
    },
    warningText: {
      color: colors.textInverse,
    },
    infoText: {
      color: colors.textInverse,
    },
    outlineText: {
      color: colors.primary,
    },
    ghostText: {
      color: colors.primary,
    },
    disabledText: {
      color: colors.textDisabled,
    },
  };
};

export default Button;