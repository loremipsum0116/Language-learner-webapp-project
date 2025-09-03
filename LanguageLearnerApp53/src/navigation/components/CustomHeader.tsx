// src/navigation/components/CustomHeader.tsx
// 커스텀 헤더 컴포넌트

import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';

interface CustomHeaderProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  onBackPress?: () => void;
  backgroundColor?: string;
  titleColor?: string;
  statusBarStyle?: 'default' | 'light-content' | 'dark-content';
  elevation?: number;
  borderBottomWidth?: number;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({
  title,
  subtitle,
  showBackButton = true,
  rightComponent,
  leftComponent,
  onBackPress,
  backgroundColor,
  titleColor,
  statusBarStyle,
  elevation = 4,
  borderBottomWidth = 1,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const headerBackgroundColor = backgroundColor || colors.surface;
  const headerTitleColor = titleColor || colors.text;
  const statusStyle = statusBarStyle || (colors.surface === '#ffffff' ? 'dark-content' : 'light-content');

  return (
    <>
      <StatusBar
        backgroundColor={headerBackgroundColor}
        barStyle={statusStyle}
        translucent={false}
      />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            backgroundColor: headerBackgroundColor,
            elevation: Platform.OS === 'android' ? elevation : 0,
            shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
            borderBottomWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.content}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            {leftComponent || (showBackButton && navigation.canGoBack() && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="뒤로가기"
                accessibilityRole="button"
              >
                <Text style={[styles.backIcon, { color: headerTitleColor }]}>
                  ←
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Center Section */}
          <View style={styles.centerSection}>
            {title && (
              <Text
                style={[styles.title, { color: headerTitleColor }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[styles.subtitle, { color: headerTitleColor }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            )}
          </View>

          {/* Right Section */}
          <View style={styles.rightSection}>
            {rightComponent}
          </View>
        </View>
      </View>
    </>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.spacing.header.height,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  centerSection: {
    flex: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rightSection: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: '600' as const,
  },
  title: {
    ...theme.typography.h4,
    textAlign: 'center' as const,
  },
  subtitle: {
    ...theme.typography.caption,
    textAlign: 'center' as const,
    marginTop: 2,
    opacity: 0.8,
  },
});

export default CustomHeader;