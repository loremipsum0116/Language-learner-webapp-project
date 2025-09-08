// src/components/offline/OfflineIndicator.tsx
// 오프라인 상태 표시 컴포넌트

import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useOfflineStatus, useSyncStatus } from '../../hooks/useOfflineStatus';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { syncService } from '../../services/SyncService';

interface OfflineIndicatorProps {
  style?: any;
  showDetails?: boolean;
  onPress?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  style,
  showDetails = false,
  onPress,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const offlineStatus = useOfflineStatus();
  const syncStatus = useSyncStatus();

  const getIndicatorStyle = () => {
    if (offlineStatus.isConnecting) {
      return [styles.indicator, styles.connectingIndicator];
    } else if (offlineStatus.isOffline) {
      return [styles.indicator, styles.offlineIndicator];
    } else if (!offlineStatus.hasStableConnection) {
      return [styles.indicator, styles.unstableIndicator];
    } else if (syncStatus.needsSync) {
      return [styles.indicator, styles.syncPendingIndicator];
    }
    return [styles.indicator, styles.onlineIndicator];
  };

  const getIndicatorText = () => {
    if (offlineStatus.isConnecting) return '연결 중';
    if (offlineStatus.isOffline) return '오프라인';
    if (!offlineStatus.hasStableConnection) return '연결 불안정';
    if (syncStatus.needsSync) return '동기화 필요';
    return '온라인';
  };

  const getConnectionIcon = () => {
    if (offlineStatus.isConnecting) return '🔄';
    if (offlineStatus.isOffline) return '📱';
    if (!offlineStatus.hasStableConnection) return '📶';
    if (syncStatus.needsSync) return '⏳';
    return '🌐';
  };

  const handlePress = async () => {
    if (onPress) {
      onPress();
    } else if (syncStatus.canSync && syncStatus.needsSync) {
      try {
        await syncService.syncNow();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  if (offlineStatus.isOnline && !syncStatus.needsSync && offlineStatus.hasStableConnection) {
    return null; // Don't show indicator when everything is normal
  }

  return (
    <TouchableOpacity
      style={[getIndicatorStyle(), style]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.indicatorContent}>
        <Text style={styles.indicatorIcon}>
          {getConnectionIcon()}
        </Text>
        <Text style={styles.indicatorText}>
          {getIndicatorText()}
        </Text>
        {showDetails && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsText}>
              연결: {offlineStatus.connectionType || '알 수 없음'}
            </Text>
            {syncStatus.pendingChanges > 0 && (
              <Text style={styles.detailsText}>
                대기 중: {syncStatus.pendingChanges}개
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => ({
  indicator: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 32,
  },
  indicatorContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  indicatorIcon: {
    fontSize: 14,
  },
  indicatorText: {
    ...theme.typography.caption,
    fontWeight: theme.typography.fontWeight.medium,
  },
  detailsContainer: {
    marginLeft: theme.spacing.sm,
  },
  detailsText: {
    ...theme.typography.xs,
    opacity: 0.8,
  },
  onlineIndicator: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.success,
    borderWidth: 1,
  },
  offlineIndicator: {
    backgroundColor: theme.colors.errorLight,
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  connectingIndicator: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
    borderWidth: 1,
  },
  unstableIndicator: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
    borderWidth: 1,
  },
  syncPendingIndicator: {
    backgroundColor: theme.colors.infoLight,
    borderColor: theme.colors.info,
    borderWidth: 1,
  },
});

export default OfflineIndicator;