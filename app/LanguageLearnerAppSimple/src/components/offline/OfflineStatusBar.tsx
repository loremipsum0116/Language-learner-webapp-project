// src/components/offline/OfflineStatusBar.tsx
// 오프라인 모드 상태 표시 바

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { useOfflineStatus, useSyncStatus } from '../../hooks/useOfflineStatus';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import useSyncManager from '../../hooks/useSyncManager';

interface OfflineStatusBarProps {
  position?: 'top' | 'bottom';
  showDetailedInfo?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  onPress?: () => void;
}

const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({
  position = 'top',
  showDetailedInfo = false,
  autoHide = false,
  autoHideDelay = 5000,
  onPress,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const offlineStatus = useOfflineStatus();
  const syncStatus = useSyncStatus();
  const [syncState] = useSyncManager();
  
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    const shouldShow = offlineStatus.isOffline || 
                     !offlineStatus.hasStableConnection || 
                     syncState.isSyncing ||
                     syncState.activeAlerts.length > 0;

    if (shouldShow && !isVisible) {
      setIsVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (autoHide && autoHideDelay > 0 && !offlineStatus.isOffline) {
        const timer = setTimeout(() => {
          hideStatusBar();
        }, autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else if (!shouldShow && isVisible) {
      hideStatusBar();
    }
  }, [
    offlineStatus.isOffline,
    offlineStatus.hasStableConnection,
    syncState.isSyncing,
    syncState.activeAlerts.length,
    isVisible,
    autoHide,
    autoHideDelay
  ]);

  const hideStatusBar = () => {
    Animated.timing(slideAnim, {
      toValue: position === 'top' ? -100 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  };

  const getStatusInfo = () => {
    if (syncState.isSyncing) {
      return {
        icon: '🔄',
        title: '동기화 중',
        message: `${syncState.syncProgress}% 완료`,
        type: 'syncing' as const,
        color: colors.info,
      };
    }

    if (offlineStatus.isOffline) {
      return {
        icon: '📱',
        title: '오프라인 모드',
        message: '인터넷 연결 없이 학습 가능',
        type: 'offline' as const,
        color: colors.warning,
      };
    }

    if (offlineStatus.isConnecting) {
      return {
        icon: '🔄',
        title: '연결 중',
        message: '인터넷에 연결하고 있습니다',
        type: 'connecting' as const,
        color: colors.info,
      };
    }

    if (!offlineStatus.hasStableConnection) {
      return {
        icon: '📶',
        title: '불안정한 연결',
        message: '일부 기능이 제한될 수 있습니다',
        type: 'unstable' as const,
        color: colors.warning,
      };
    }

    if (syncStatus.needsSync) {
      return {
        icon: '⏳',
        title: '동기화 필요',
        message: `${syncStatus.pendingChanges}개 항목 대기`,
        type: 'sync_needed' as const,
        color: colors.info,
      };
    }

    return null;
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (showDetailedInfo) {
      setShowDetails(true);
    }
  };

  const statusInfo = getStatusInfo();

  if (!isVisible || !statusInfo) {
    return null;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          position === 'bottom' ? styles.bottomPosition : styles.topPosition,
          { backgroundColor: statusInfo.color },
          {
            transform: [{
              translateY: slideAnim
            }]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.statusSection}>
            <Text style={styles.icon}>{statusInfo.icon}</Text>
            <View style={styles.textSection}>
              <Text style={styles.title}>{statusInfo.title}</Text>
              <Text style={styles.message}>{statusInfo.message}</Text>
            </View>
          </View>

          {syncState.activeAlerts.length > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertCount}>
                {syncState.activeAlerts.length}
              </Text>
            </View>
          )}

          {showDetailedInfo && (
            <Text style={styles.detailIndicator}>ⓘ</Text>
          )}
        </TouchableOpacity>

        {syncState.isSyncing && (
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar,
                { width: `${syncState.syncProgress}%` }
              ]}
            />
          </View>
        )}
      </Animated.View>

      {/* Detailed Info Modal */}
      <Modal
        visible={showDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetails(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDetails(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>연결 상태 상세 정보</Text>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>연결 상태:</Text>
              <Text style={styles.detailValue}>
                {offlineStatus.isOnline ? '온라인' : '오프라인'}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>연결 타입:</Text>
              <Text style={styles.detailValue}>
                {offlineStatus.connectionType || '알 수 없음'}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>마지막 온라인:</Text>
              <Text style={styles.detailValue}>
                {new Date(offlineStatus.lastOnlineTime).toLocaleString('ko-KR')}
              </Text>
            </View>

            {syncStatus.pendingChanges > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>동기화 대기:</Text>
                <Text style={styles.detailValue}>
                  {syncStatus.pendingChanges}개 항목
                </Text>
              </View>
            )}

            {syncState.healthMetrics.successRate > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>동기화 성공률:</Text>
                <Text style={styles.detailValue}>
                  {(syncState.healthMetrics.successRate * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            {syncState.activeAlerts.length > 0 && (
              <View style={styles.alertsSection}>
                <Text style={styles.alertsTitle}>활성 알림:</Text>
                {syncState.activeAlerts.slice(0, 3).map((alert, index) => (
                  <View key={alert.id} style={styles.alertItem}>
                    <Text style={[
                      styles.alertText,
                      { color: alert.severity === 'critical' ? colors.error : colors.warning }
                    ]}>
                      • {alert.title}
                    </Text>
                  </View>
                ))}
                {syncState.activeAlerts.length > 3 && (
                  <Text style={styles.moreAlertsText}>
                    +{syncState.activeAlerts.length - 3}개 더
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetails(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  topPosition: {
    top: 0,
    paddingTop: 50, // Account for status bar
  },
  bottomPosition: {
    bottom: 0,
    paddingBottom: 20,
  },
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statusSection: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  textSection: {
    flex: 1,
  },
  title: {
    ...theme.typography.subtitle2,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.fontWeight.bold,
  },
  message: {
    ...theme.typography.caption,
    color: theme.colors.textInverse,
    opacity: 0.9,
  },
  alertBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: theme.spacing.sm,
  },
  alertCount: {
    ...theme.typography.caption,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.fontWeight.bold,
  },
  detailIndicator: {
    ...theme.typography.body1,
    color: theme.colors.textInverse,
    opacity: 0.8,
    marginLeft: theme.spacing.sm,
  },
  progressContainer: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.md,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.lg,
  },
  detailSection: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...theme.typography.body2,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right' as const,
  },
  alertsSection: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.spacing.xs,
  },
  alertsTitle: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  alertItem: {
    paddingVertical: theme.spacing.xs,
  },
  alertText: {
    ...theme.typography.caption,
  },
  moreAlertsText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    alignItems: 'center' as const,
  },
  closeButtonText: {
    ...theme.typography.button,
    color: theme.colors.textInverse,
  },
});

export default OfflineStatusBar;