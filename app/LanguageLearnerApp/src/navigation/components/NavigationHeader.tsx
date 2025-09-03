// src/navigation/components/NavigationHeader.tsx
// 네비게이션 헤더 래퍼 컴포넌트

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';

interface NavigationHeaderProps {
  title: string;
  showBack?: boolean;
  rightButton?: {
    title?: string;
    icon?: string;
    onPress: () => void;
    disabled?: boolean;
  };
  subtitle?: string;
  style?: any;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  title,
  showBack = true,
  rightButton,
  subtitle,
  style,
}) => {
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {showBack && navigation.canGoBack() && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="뒤로가기"
              accessibilityRole="button"
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Center Section */}
        <View style={styles.centerSection}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightButton && (
            <TouchableOpacity
              style={[
                styles.rightButton,
                rightButton.disabled && styles.disabledButton,
              ]}
              onPress={rightButton.onPress}
              disabled={rightButton.disabled}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
            >
              {rightButton.icon && (
                <Text style={[
                  styles.rightButtonIcon,
                  rightButton.disabled && styles.disabledText,
                ]}>
                  {rightButton.icon}
                </Text>
              )}
              {rightButton.title && (
                <Text style={[
                  styles.rightButtonText,
                  rightButton.disabled && styles.disabledText,
                ]}>
                  {rightButton.title}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 56,
  },
  leftSection: {
    width: 44,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.sm,
  },
  rightSection: {
    width: 80,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  backIcon: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: theme.colors.primary,
  },
  title: {
    ...theme.typography.h4,
    color: theme.colors.text,
    textAlign: 'center' as const,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  rightButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.xs,
  },
  rightButtonIcon: {
    fontSize: 16,
    color: theme.colors.primary,
    marginRight: 4,
  },
  rightButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: theme.colors.textDisabled,
  },
});

export default NavigationHeader;