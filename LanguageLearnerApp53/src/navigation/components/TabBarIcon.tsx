// src/navigation/components/TabBarIcon.tsx
// 탭바 아이콘 컴포넌트

import React from 'react';
import { View, Text } from 'react-native';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { TabIconName } from '../types';

interface TabBarIconProps {
  name: TabIconName;
  focused: boolean;
  color: string;
  size: number;
  badge?: {
    count?: number;
    showDot?: boolean;
  };
}

// Icon mapping
const iconMap: Record<TabIconName, { focused: string; unfocused: string }> = {
  home: {
    focused: '🏠',
    unfocused: '🏡',
  },
  study: {
    focused: '📚',
    unfocused: '📖',
  },
  progress: {
    focused: '📊',
    unfocused: '📈',
  },
  settings: {
    focused: '⚙️',
    unfocused: '⚪',
  },
};

const TabBarIcon: React.FC<TabBarIconProps> = ({
  name,
  focused,
  color,
  size,
  badge,
}) => {
  const styles = useThemedStyles(createStyles);
  
  const iconEmoji = iconMap[name]
    ? iconMap[name][focused ? 'focused' : 'unfocused']
    : '❓';

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={[styles.icon, { fontSize: size, color }]}>
          {iconEmoji}
        </Text>
        
        {/* Badge */}
        {badge && (badge.count || badge.showDot) && (
          <View
            style={[
              styles.badge,
              badge.showDot && styles.dotBadge,
              !badge.showDot && styles.countBadge,
            ]}
          >
            {!badge.showDot && badge.count && (
              <Text style={styles.badgeText}>
                {badge.count > 99 ? '99+' : badge.count}
              </Text>
            )}
          </View>
        )}
        
        {/* Focus indicator */}
        {focused && (
          <View style={styles.focusIndicator} />
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconContainer: {
    position: 'relative' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 32,
    height: 32,
  },
  icon: {
    textAlign: 'center' as const,
  },
  badge: {
    position: 'absolute' as const,
    right: -6,
    top: -3,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  dotBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    minWidth: 8,
  },
  countBadge: {
    minWidth: 16,
    paddingHorizontal: 4,
  },
  badgeText: {
    ...theme.typography.xs,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center' as const,
  },
  focusIndicator: {
    position: 'absolute' as const,
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
});

export default TabBarIcon;